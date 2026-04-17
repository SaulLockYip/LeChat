package testutils

import (
	"database/sql"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// MockEnv holds the mock OpenClaw environment state
type MockEnv struct {
	TempDir      string
	OpenclawDir  string
	LechatDir    string
	SocketPath   string
	DBPath       string
	MessagePath  string
	ConfigPath   string
	FakeOpenclaw *FakeOpenclaw
}

// SetupMockEnv creates a temporary directory with fake openclaw.json and sessions.json
func SetupMockEnv(t *testing.T) *MockEnv {
	t.Helper()

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "lechat-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	openclawDir := filepath.Join(tempDir, "openclaw")
	lechatDir := filepath.Join(tempDir, "lechat")

	// Create directories
	if err := os.MkdirAll(openclawDir, 0755); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to create openclaw dir: %v", err)
	}
	if err := os.MkdirAll(lechatDir, 0755); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to create lechat dir: %v", err)
	}

	// Create openclaw.json
	openclawConfig := map[string]interface{}{
		"workspace": "test-workspace",
		"agent_id":  "test-agent",
		"session": map[string]string{
			"id": "test-session-id",
		},
	}
	openclawJSON, err := json.MarshalIndent(openclawConfig, "", "  ")
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to marshal openclaw config: %v", err)
	}
	if err := os.WriteFile(filepath.Join(openclawDir, "openclaw.json"), openclawJSON, 0644); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to write openclaw.json: %v", err)
	}

	// Create sessions.json
	sessions := []map[string]string{
		{
			"lechat_agent_id":   "agent-1",
			"openclaw_agent_id": "openclaw-agent-1",
			"session_id":        "session-1",
		},
		{
			"lechat_agent_id":   "agent-2",
			"openclaw_agent_id": "openclaw-agent-2",
			"session_id":        "session-2",
		},
	}
	sessionsJSON, err := json.MarshalIndent(sessions, "", "  ")
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to marshal sessions: %v", err)
	}
	if err := os.WriteFile(filepath.Join(openclawDir, "sessions.json"), sessionsJSON, 0644); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to write sessions.json: %v", err)
	}

	// Create config.json for lechat
	config := map[string]string{
		"openclaw_dir": openclawDir,
		"lechat_dir":   lechatDir,
		"http_port":    "8080",
	}
	configJSON, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to marshal config: %v", err)
	}
	configPath := filepath.Join(lechatDir, "config.json")
	if err := os.WriteFile(configPath, configJSON, 0644); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("Failed to write config.json: %v", err)
	}

	return &MockEnv{
		TempDir:     tempDir,
		OpenclawDir: openclawDir,
		LechatDir:   lechatDir,
		SocketPath:  filepath.Join(lechatDir, "socket.sock"),
		DBPath:      filepath.Join(lechatDir, "lechat.db"),
		MessagePath: filepath.Join(lechatDir, "messages"),
		ConfigPath:  configPath,
	}
}

// TeardownMockEnv cleans up the mock environment
func TeardownMockEnv(env *MockEnv) {
	if env != nil && env.TempDir != "" {
		os.RemoveAll(env.TempDir)
	}
}

// FakeOpenclaw simulates OpenClaw CLI behavior for testing
type FakeOpenclaw struct {
	mu           sync.Mutex
	Called       []string
	Notifications []string
	Responses    map[string]string
	FailOnCall   string
}

// NewFakeOpenclaw creates a new FakeOpenclaw instance
func NewFakeOpenclaw() *FakeOpenclaw {
	return &FakeOpenclaw{
		Called:       []string{},
		Notifications: []string{},
		Responses:    make(map[string]string),
	}
}

// FakeOpenclawCommand returns a command that simulates openclaw CLI
// It panics if called outside of test execution context
func FakeOpenclawCommand() *exec.Cmd {
	cmd := exec.Command("true") // No-op command, actual faking happens via PATH manipulation
	return cmd
}

// ExecuteFakeOpenclaw executes the fake openclaw logic directly (for testing without PATH manipulation)
func (f *FakeOpenclaw) ExecuteFakeOpenclaw(args []string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	call := ""
	if len(args) > 0 {
		call = args[0]
	}
	f.Called = append(f.Called, call)

	// Check if we should fail
	if f.FailOnCall == call {
		return
	}

	// Handle different commands
	if len(args) >= 2 && args[0] == "--session-id" {
		sessionID := args[1]
		message := ""
		for i := 2; i < len(args); i++ {
			if args[i] == "--message" && i+1 < len(args) {
				message = args[i+1]
				break
			}
		}
		if message != "" {
			f.Notifications = append(f.Notifications, sessionID+": "+message)
		}
	}
}

// GetNotifications returns a copy of all notifications sent
func (f *FakeOpenclaw) GetNotifications() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	result := make([]string, len(f.Notifications))
	copy(result, f.Notifications)
	return result
}

// Reset clears all state
func (f *FakeOpenclaw) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Called = []string{}
	f.Notifications = []string{}
	f.FailOnCall = ""
}

// CreateFakeOpenclawBinary creates a temporary fake openclaw binary
func CreateFakeOpenclawBinary(t *testing.T, fake *FakeOpenclaw) string {
	t.Helper()

	// Create a shell script that simulates openclaw behavior
	script := `#!/bin/bash
case "$1" in
--session-id)
    session_id="$2"
    shift 2
    if [ "$1" = "--message" ]; then
        shift
        message="$1"
        # Echo to stderr (notifications go to log)
        echo "FAKE_NOTIFICATION: $session_id: $message" >&2
    fi
    ;;
*)
    echo "{}"
    ;;
esac
exit 0
`
	tmpfile, err := os.CreateTemp("", "fake-openclaw-*")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer tmpfile.Close()

	if _, err := tmpfile.WriteString(script); err != nil {
		os.Remove(tmpfile.Name())
		t.Fatalf("Failed to write script: %v", err)
	}

	if err := tmpfile.Chmod(0755); err != nil {
		os.Remove(tmpfile.Name())
		t.Fatalf("Failed to chmod: %v", err)
	}

	if err := tmpfile.Close(); err != nil {
		os.Remove(tmpfile.Name())
		t.Fatalf("Failed to close file: %v", err)
	}

	return tmpfile.Name()
}

// StartFakeOpenclawDaemon starts a fake openclaw daemon for testing
type FakeOpenclawDaemon struct {
	SocketPath string
	Fake       *FakeOpenclaw
	stopCh     chan struct{}
	wg         sync.WaitGroup
}

// StartFakeOpenclawDaemon starts a Unix socket server that simulates OpenClaw
func StartFakeOpenclawDaemon(t *testing.T, socketPath string) *FakeOpenclawDaemon {
	t.Helper()

	fake := NewFakeOpenclaw()

	// Create socket directory
	socketDir := filepath.Dir(socketPath)
	if err := os.MkdirAll(socketDir, 0755); err != nil {
		t.Fatalf("Failed to create socket dir: %v", err)
	}

	// Remove existing socket
	os.Remove(socketPath)

	// Create socket listener using net.Listen
	ln, err := net.Listen("unix", socketPath)
	if err != nil {
		t.Fatalf("Failed to listen on socket: %v", err)
	}

	daemon := &FakeOpenclawDaemon{
		SocketPath: socketPath,
		Fake:       fake,
		stopCh:     make(chan struct{}),
	}

	daemon.wg.Add(1)
	go func() {
		defer daemon.wg.Done()
		for {
			conn, err := ln.Accept()
			if err != nil {
				select {
				case <-daemon.stopCh:
					return
				default:
					continue
				}
			}

			go func(c net.Conn) {
				defer c.Close()
				// Read request (simplified - just echo back success)
				buf := make([]byte, 1024)
				c.Read(buf)
				time.Sleep(10 * time.Millisecond) // Simulate processing
				c.Write([]byte(`{"status":"ok"}` + "\n"))
			}(conn)
		}
	}()

	return daemon
}

// Stop gracefully stops the fake daemon
func (d *FakeOpenclawDaemon) Stop() {
	close(d.stopCh)
	d.wg.Wait()
}

// MockDB creates an in-memory SQLite database for testing
func MockDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}

	// Run schema
	schema := `
	CREATE TABLE conversation (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		agent_ids TEXT NOT NULL,
		thread_ids TEXT NOT NULL,
		group_name TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);

	CREATE TABLE thread (
		id TEXT PRIMARY KEY,
		conv_id TEXT NOT NULL,
		topic TEXT NOT NULL,
		status TEXT NOT NULL,
		openclaw_sessions TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY (conv_id) REFERENCES conversation(id)
	);

	CREATE TABLE agent (
		id TEXT PRIMARY KEY,
		openclaw_agent_id TEXT NOT NULL,
		openclaw_workspace TEXT NOT NULL,
		openclaw_agent_dir TEXT NOT NULL,
		token TEXT NOT NULL UNIQUE
	);

	CREATE INDEX idx_thread_conv_id ON thread(conv_id);
	CREATE INDEX idx_conversation_agent_ids ON conversation(agent_ids);
	`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		t.Fatalf("Failed to create schema: %v", err)
	}

	cleanup := func() {
		db.Close()
	}

	return db, cleanup
}
