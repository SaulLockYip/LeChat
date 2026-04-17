package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/lechat/pkg/config"
	"github.com/spf13/cobra"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Manage LeChat server",
}

var serverStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the LeChat server",
	RunE:  runServerStart,
}

var serverStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the LeChat server",
	RunE:  runServerStop,
}

var serverRestartCmd = &cobra.Command{
	Use:   "restart",
	Short: "Restart the LeChat server",
	RunE:  runServerRestart,
}

var (
	listenFlag bool
	debugFlag  bool
)

func init() {
	serverCmd.AddCommand(serverStartCmd)
	serverCmd.AddCommand(serverStopCmd)
	serverCmd.AddCommand(serverRestartCmd)

	serverStartCmd.Flags().BoolVar(&listenFlag, "listen", false, "Run in foreground")
	serverStartCmd.Flags().BoolVar(&debugFlag, "debug", false, "Enable debug logging")
}

func runServerStart(cmd *cobra.Command, args []string) error {
	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Check if server is already running
	if isServerRunning(cfg) {
		return fmt.Errorf("server is already running")
	}

	// Build server binary path
	serverBinary := filepath.Join(cfg.LechatDir, "lechat-server")

	// Check if server binary exists
	if _, err := os.Stat(serverBinary); os.IsNotExist(err) {
		return fmt.Errorf("server binary not found at %s", serverBinary)
	}

	// Build args
	serverArgs := []string{}
	if debugFlag {
		serverArgs = append(serverArgs, "--debug")
	}
	if listenFlag {
		serverArgs = append(serverArgs, "--listen")
	}

	if listenFlag {
		// Run in foreground
		execCmd := exec.Command(serverBinary, serverArgs...)
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr
		return execCmd.Run()
	}

	// Run in background
	execCmd := exec.Command(serverBinary, serverArgs...)
	execCmd.Start()

	fmt.Println("Server started")
	return nil
}

func runServerStop(cmd *cobra.Command, args []string) error {
	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Check if server is running
	if !isServerRunning(cfg) {
		return fmt.Errorf("server is not running")
	}

	// Connect to server via Unix Socket and send stop signal
	socketPath := cfg.SocketPath()

	type StopMessage struct {
		Type    string `json:"type"`
		Version string `json:"version"`
	}

	stopMsg := StopMessage{
		Type:    "server_stop",
		Version: "1.0",
	}

	msgBytes, err := json.Marshal(stopMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal stop message: %w", err)
	}

	conn, err := net.DialTimeout("unix", socketPath, 5*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer conn.Close()

	_, err = conn.Write(append(msgBytes, '\n'))
	if err != nil {
		return fmt.Errorf("failed to send stop signal: %w", err)
	}

	fmt.Println("Server stopped")
	return nil
}

func runServerRestart(cmd *cobra.Command, args []string) error {
	// Try to stop first (ignore error if not running)
	runServerStop(cmd, args)

	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Wait a moment for server to fully stop
	time.Sleep(1 * time.Second)

	// Build server binary path
	serverBinary := filepath.Join(cfg.LechatDir, "lechat-server")

	// Check if server binary exists
	if _, err := os.Stat(serverBinary); os.IsNotExist(err) {
		return fmt.Errorf("server binary not found at %s", serverBinary)
	}

	// Start server
	execCmd := exec.Command(serverBinary)
	execCmd.Start()

	fmt.Println("Server restarted")
	return nil
}

func isServerRunning(cfg *config.Config) bool {
	socketPath := cfg.SocketPath()

	// Try to connect to the socket
	conn, err := net.DialTimeout("unix", socketPath, 1*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// Check if server HTTP is responding (alternative method)
func isServerResponding(cfg *config.Config) bool {
	url := fmt.Sprintf("http://localhost:%d/health", cfg.Port)
	client := &http.Client{Timeout: 2 * time.Second}

	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}
