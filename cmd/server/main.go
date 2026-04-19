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
	"github.com/lechat/pkg/models"
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

	// Initialize user repository and load user from config
	userRepo := db.NewUserRepository(database)
	user, err := userRepo.GetUser()
	if err != nil {
		log.Fatalf("Failed to get user: %v", err)
	}

	if user == nil {
		if cfg.User.Token != "" {
			newUser := &models.User{
				ID:        cfg.User.ID,
				Name:      cfg.User.Name,
				Title:     cfg.User.Title,
				Token:     cfg.User.Token,
				CreatedAt: time.Now().UTC().Format(time.RFC3339),
				UpdatedAt: time.Now().UTC().Format(time.RFC3339),
			}
			if err := userRepo.CreateUser(newUser); err != nil {
				log.Printf("Warning: Failed to create user: %v", err)
			} else {
				log.Println("User created from config.json")
			}
		} else {
			log.Println("No user found in database. Run setup.sh to create a user.")
		}
	} else if user.Token == "" {
		if cfg.User.Token != "" {
			if err := userRepo.PopulateTokenFromConfig(cfg.User.Token); err != nil {
				log.Printf("Warning: Failed to populate user token from config: %v", err)
			} else {
				log.Println("User token populated from config.json")
			}
		}
	}

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

	// Create quit channel before socket server so callback can reference it
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

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
			log.Println("Received server_stop signal via socket, shutting down...")
			quit <- syscall.SIGTERM
		},
	)

	if err := socketServer.Start(); err != nil {
		log.Fatalf("Failed to start socket server: %v", err)
	}
	defer socketServer.Stop()

	// Setup HTTP server
	mux := handler.SetupRouter(database, jsonlManager, sseBroadcaster, writeQueue, notifyQueue)

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

	// Wait for shutdown signal (from OS signal or socket stop command)
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
