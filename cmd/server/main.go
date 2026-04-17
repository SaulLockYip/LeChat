package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/lechat/internal/config"
	"github.com/lechat/internal/db"
	"github.com/lechat/internal/handler"
	"github.com/lechat/internal/notification"
	"github.com/lechat/internal/queue"
	"github.com/lechat/internal/socket"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting LeChat Server...")

	// Determine config path
	configPath := os.Getenv("LECHAT_CONFIG")
	if configPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		configPath = fmt.Sprintf("%s/.lechat/config.json", home)
	}

	// Load configuration
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Ensure directories exist
	if err := cfg.EnsureDirectories(); err != nil {
		log.Fatalf("Failed to create directories: %v", err)
	}

	// Initialize database
	database, err := db.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()
	log.Printf("Database initialized at %s", cfg.DBPath)

	// Initialize JSONL manager
	jsonlManager := db.NewJSONLManager(cfg.GetMessagesDir())

	// Initialize SSE broadcaster (auto-started by NewSSEBroadcaster)
	sseBroadcaster := handler.NewSSEBroadcaster()
	defer sseBroadcaster.Stop()

	// Initialize write queue
	writeQueue := queue.NewWriteQueue(jsonlManager)
	writeQueue.StartWorkers()
	defer writeQueue.Stop()

	// Initialize notification queue
	notifyQueue := notification.NewNotificationQueue(database)
	notifyQueue.StartWorkers()
	defer notifyQueue.Stop()

	// Initialize Unix socket server
	socketServer := socket.NewServer(
		cfg.SocketPath,
		jsonlManager,
		db.NewConversationRepository(database),
		db.NewThreadRepository(database),
		db.NewAgentRepository(database),
		writeQueue,
		notifyQueue,
		sseBroadcaster,
		func() {
			log.Println("Received server_stop signal via socket")
		},
	)

	if err := socketServer.Start(); err != nil {
		log.Fatalf("Failed to start socket server: %v", err)
	}
	defer socketServer.Stop()

	// Setup HTTP server
	mux := handler.SetupRouter(database, jsonlManager, sseBroadcaster)

	server := &http.Server{
		Addr:    ":" + cfg.HTTPPort,
		Handler: mux,
	}

	// Start HTTP server in goroutine
	go func() {
		log.Printf("HTTP server listening on port %s", cfg.HTTPPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Graceful shutdown sequence

	// 1. Stop accepting new HTTP connections
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// 2. Stop socket server
	socketServer.Stop()

	// 3. Stop notification queue (drains remaining tasks)
	notifyQueue.Stop()

	// 4. Stop write queue (drains remaining tasks)
	writeQueue.Stop()

	log.Println("Server stopped")
}
