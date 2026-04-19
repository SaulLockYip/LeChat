package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	dbpkg "github.com/lechat/internal/db"
	"github.com/lechat/internal/notification"
	"github.com/lechat/internal/queue"
	"github.com/lechat/pkg/models"
)

// setupTestHandler creates a Handler with in-memory SQLite DB and returns it along with cleanup func
func setupTestHandler(t *testing.T) (*Handler, *sql.DB, func()) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}

	schema := `
	CREATE TABLE conversation (
		id TEXT PRIMARY KEY,
		type TEXT NOT NULL,
		agent_ids TEXT NOT NULL,
		thread_ids TEXT NOT NULL DEFAULT '[]',
		group_name TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE thread (
		id TEXT PRIMARY KEY,
		conv_id TEXT NOT NULL,
		topic TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'active',
		openclaw_sessions TEXT NOT NULL DEFAULT '[]',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		FOREIGN KEY (conv_id) REFERENCES conversation(id) ON DELETE CASCADE
	);
	CREATE TABLE agent (
		id TEXT PRIMARY KEY,
		openclaw_agent_id TEXT NOT NULL,
		openclaw_workspace TEXT NOT NULL,
		openclaw_agent_dir TEXT NOT NULL,
		token TEXT NOT NULL
	);
	CREATE TABLE user (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		title TEXT,
		token TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	`
	// Enable foreign keys for cascade delete support
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		db.Close()
		t.Fatalf("Failed to enable foreign keys: %v", err)
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		t.Fatalf("Failed to create schema: %v", err)
	}

	tempDir, err := os.MkdirTemp("", "lechat-handler-test-*")
	if err != nil {
		db.Close()
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	jsonl := dbpkg.NewJSONLManager(tempDir)
	sseBroadcaster := NewSSEBroadcaster()
	writeQueue := queue.NewWriteQueue(jsonl)
	notifyQueue := notification.NewNotificationQueue(db)

	userRepo := dbpkg.NewUserRepository(db)
	handler := NewHandler(db, jsonl, NewSSEHandler(sseBroadcaster, userRepo), writeQueue, notifyQueue)

	cleanup := func() {
		sseBroadcaster.Stop()
		writeQueue.Stop()
		db.Close()
		os.RemoveAll(tempDir)
	}

	return handler, db, cleanup
}

// createTestUser creates a user in the database for testing
func createTestUser(t *testing.T, db *sql.DB, id, name, token string) {
	t.Helper()
	_, err := db.Exec(
		"INSERT INTO user (id, name, title, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		id, name, "", token, "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z",
	)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
}

// createTestConversation creates a conversation in the database for testing
func createTestConversation(t *testing.T, db *sql.DB, conv *models.Conversation) {
	t.Helper()
	_, err := db.Exec(
		"INSERT INTO conversation (id, type, agent_ids, thread_ids, group_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		conv.ID, conv.Type, `[`+joinAgentIDs(conv.AgentIDs)+`]`, `[]`, conv.GroupName, conv.CreatedAt, conv.UpdatedAt,
	)
	if err != nil {
		t.Fatalf("Failed to create test conversation: %v", err)
	}
}

// createTestThread creates a thread in the database for testing
func createTestThread(t *testing.T, db *sql.DB, thread *models.Thread) {
	t.Helper()
	_, err := db.Exec(
		"INSERT INTO thread (id, conv_id, topic, status, openclaw_sessions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		thread.ID, thread.ConvID, thread.Topic, thread.Status, `[]`, thread.CreatedAt, thread.UpdatedAt,
	)
	if err != nil {
		t.Fatalf("Failed to create test thread: %v", err)
	}
}

// joinAgentIDs joins agent IDs for JSON encoding
func joinAgentIDs(ids []string) string {
	result := ""
	for i, id := range ids {
		if i > 0 {
			result += ","
		}
		result += `"` + id + `"`
	}
	return result
}

// helper for nullable string pointer
func stringPtr(s string) *string {
	return &s
}

// =============================================================================
// Auth Middleware Tests
// =============================================================================

func TestAuthMiddleware_ValidToken(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	// Create a test user with a known token
	createTestUser(t, db, "user-1", "Test User", "valid-token-123")

	// Create request with valid Bearer token
	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	req.Header.Set("Authorization", "Bearer valid-token-123")

	rr := httptest.NewRecorder()

	// Use the auth middleware directly
	authMux := handler.auth.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := GetUserFromContext(r)
		if user == nil {
			t.Error("Expected user in context")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if user.ID != "user-1" {
			t.Errorf("Expected user ID 'user-1', got '%s'", user.ID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}
}

func TestAuthMiddleware_MissingAuthHeader(t *testing.T) {
	handler, _, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	// No Authorization header

	rr := httptest.NewRecorder()

	authMux := handler.auth.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "auth_required" {
		t.Errorf("Expected error code 'auth_required', got '%s'", errResp.Code)
	}
}

func TestAuthMiddleware_InvalidAuthFormat(t *testing.T) {
	handler, _, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	req.Header.Set("Authorization", "InvalidFormat")

	rr := httptest.NewRecorder()

	authMux := handler.auth.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_auth" {
		t.Errorf("Expected error code 'invalid_auth', got '%s'", errResp.Code)
	}
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	// Create a user with a different token
	createTestUser(t, db, "user-1", "Test User", "valid-token")

	req := httptest.NewRequest(http.MethodGet, "/api/conversations", nil)
	req.Header.Set("Authorization", "Bearer wrong-token")

	rr := httptest.NewRecorder()

	authMux := handler.auth.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_token" {
		t.Errorf("Expected error code 'invalid_token', got '%s'", errResp.Code)
	}
}

// =============================================================================
// POST /api/conversations Tests
// =============================================================================

func TestCreateConversation_Success(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"type":"group","agent_ids":["agent-1","agent-2"],"group_name":"Test Group"}`
	req := httptest.NewRequest(http.MethodPost, "/api/conversations", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	// Create router with auth
	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations", handler.CreateConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, rr.Code, rr.Body.String())
	}

	var conv models.Conversation
	if err := json.NewDecoder(rr.Body).Decode(&conv); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if conv.Type != "group" {
		t.Errorf("Expected type 'group', got '%s'", conv.Type)
	}
	if conv.GroupName == nil || *conv.GroupName != "Test Group" {
		t.Error("Expected group_name 'Test Group'")
	}
	if len(conv.AgentIDs) != 2 {
		t.Errorf("Expected 2 agent IDs, got %d", len(conv.AgentIDs))
	}
}

func TestCreateConversation_InvalidType(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"type":"dm","agent_ids":["agent-1"],"group_name":"Test Group"}`
	req := httptest.NewRequest(http.MethodPost, "/api/conversations", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations", handler.CreateConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_type" {
		t.Errorf("Expected error code 'invalid_type', got '%s'", errResp.Code)
	}
}

func TestCreateConversation_MissingGroupName(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"type":"group","agent_ids":["agent-1"]}`
	req := httptest.NewRequest(http.MethodPost, "/api/conversations", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations", handler.CreateConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_group_name" {
		t.Errorf("Expected error code 'invalid_group_name', got '%s'", errResp.Code)
	}
}

func TestCreateConversation_MissingAgentIDs(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"type":"group","group_name":"Test Group"}`
	req := httptest.NewRequest(http.MethodPost, "/api/conversations", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations", handler.CreateConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_agent_ids" {
		t.Errorf("Expected error code 'invalid_agent_ids', got '%s'", errResp.Code)
	}
}

// =============================================================================
// POST /api/threads Tests
// =============================================================================

func TestCreateThread_Success(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	// Create a conversation first
	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	body := `{"conv_id":"conv-1","topic":"Test Thread"}`
	req := httptest.NewRequest(http.MethodPost, "/api/threads", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads", handler.CreateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, rr.Code, rr.Body.String())
	}

	var thread models.Thread
	if err := json.NewDecoder(rr.Body).Decode(&thread); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if thread.ConvID != "conv-1" {
		t.Errorf("Expected conv_id 'conv-1', got '%s'", thread.ConvID)
	}
	if thread.Topic != "Test Thread" {
		t.Errorf("Expected topic 'Test Thread', got '%s'", thread.Topic)
	}
	if thread.Status != "active" {
		t.Errorf("Expected status 'active', got '%s'", thread.Status)
	}

	// Verify thread was added to conversation
	conv, _ := handler.convRepo.GetConversation("conv-1")
	if len(conv.ThreadIDs) != 1 {
		t.Errorf("Expected 1 thread in conversation, got %d", len(conv.ThreadIDs))
	}
}

func TestCreateThread_ConversationNotFound(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"conv_id":"non-existent","topic":"Test Thread"}`
	req := httptest.NewRequest(http.MethodPost, "/api/threads", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads", handler.CreateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "conv_not_found" {
		t.Errorf("Expected error code 'conv_not_found', got '%s'", errResp.Code)
	}
}

func TestCreateThread_MissingTopic(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	body := `{"conv_id":"conv-1"}`
	req := httptest.NewRequest(http.MethodPost, "/api/threads", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads", handler.CreateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_topic" {
		t.Errorf("Expected error code 'invalid_topic', got '%s'", errResp.Code)
	}
}

// =============================================================================
// PUT /api/threads/:id Tests
// =============================================================================

func TestUpdateThread_UpdateTopic(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	createTestThread(t, db, &models.Thread{
		ID:        "thread-1",
		ConvID:    "conv-1",
		Topic:     "Original Topic",
		Status:    "active",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	body := `{"topic":"Updated Topic"}`
	req := httptest.NewRequest(http.MethodPut, "/api/threads/thread-1", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads/", handler.UpdateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var thread models.Thread
	if err := json.NewDecoder(rr.Body).Decode(&thread); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if thread.Topic != "Updated Topic" {
		t.Errorf("Expected topic 'Updated Topic', got '%s'", thread.Topic)
	}
}

func TestUpdateThread_UpdateStatus(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	createTestThread(t, db, &models.Thread{
		ID:        "thread-1",
		ConvID:    "conv-1",
		Topic:     "Test Topic",
		Status:    "active",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	body := `{"status":"closed"}`
	req := httptest.NewRequest(http.MethodPut, "/api/threads/thread-1", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads/", handler.UpdateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var thread models.Thread
	if err := json.NewDecoder(rr.Body).Decode(&thread); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if thread.Status != "closed" {
		t.Errorf("Expected status 'closed', got '%s'", thread.Status)
	}
}

func TestUpdateThread_UpdateClosedThread(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	// Create a thread that is already closed
	createTestThread(t, db, &models.Thread{
		ID:        "thread-closed",
		ConvID:    "conv-1",
		Topic:     "Closed Thread",
		Status:    "closed",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	// Update the closed thread - this should still succeed (updating closed thread is allowed)
	body := `{"topic":"Reopened Thread","status":"active"}`
	req := httptest.NewRequest(http.MethodPut, "/api/threads/thread-closed", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads/", handler.UpdateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	var thread models.Thread
	if err := json.NewDecoder(rr.Body).Decode(&thread); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if thread.Status != "active" {
		t.Errorf("Expected status 'active', got '%s'", thread.Status)
	}
	if thread.Topic != "Reopened Thread" {
		t.Errorf("Expected topic 'Reopened Thread', got '%s'", thread.Topic)
	}
}

func TestUpdateThread_ThreadNotFound(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	body := `{"topic":"Updated Topic"}`
	req := httptest.NewRequest(http.MethodPut, "/api/threads/non-existent", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads/", handler.UpdateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "thread_not_found" {
		t.Errorf("Expected error code 'thread_not_found', got '%s'", errResp.Code)
	}
}

func TestUpdateThread_InvalidStatus(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1"},
		ThreadIDs: []string{},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	createTestThread(t, db, &models.Thread{
		ID:        "thread-1",
		ConvID:    "conv-1",
		Topic:     "Test Topic",
		Status:    "active",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	body := `{"status":"invalid-status"}`
	req := httptest.NewRequest(http.MethodPut, "/api/threads/thread-1", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/threads/", handler.UpdateThread)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_status" {
		t.Errorf("Expected error code 'invalid_status', got '%s'", errResp.Code)
	}
}

// =============================================================================
// DELETE /api/conversations/:id Tests
// =============================================================================

func TestDeleteConversation_Success(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	// Create a group conversation
	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-group-1",
		Type:      "group",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{"thread-1"},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	// Create a thread in the conversation
	createTestThread(t, db, &models.Thread{
		ID:        "thread-1",
		ConvID:    "conv-group-1",
		Topic:     "Test Thread",
		Status:    "active",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/conversations/conv-group-1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations/", handler.DeleteConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}

	// Verify conversation was deleted
	conv, _ := handler.convRepo.GetConversation("conv-group-1")
	if conv != nil {
		t.Error("Expected conversation to be deleted")
	}

	// Verify thread was also deleted (cascade)
	thread, _ := handler.threadRepo.GetThread("thread-1")
	if thread != nil {
		t.Error("Expected thread to be deleted (cascade)")
	}
}

func TestDeleteConversation_DMNotAllowed(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	// Create a DM conversation
	createTestConversation(t, db, &models.Conversation{
		ID:        "conv-dm-1",
		Type:      "dm",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{},
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/conversations/conv-dm-1", nil)
	req.Header.Set("Authorization", "Bearer valid-token")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations/", handler.DeleteConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "invalid_type" {
		t.Errorf("Expected error code 'invalid_type', got '%s'", errResp.Code)
	}

	// Verify DM was NOT deleted
	conv, _ := handler.convRepo.GetConversation("conv-dm-1")
	if conv == nil {
		t.Error("DM conversation should NOT be deleted")
	}
}

func TestDeleteConversation_NotFound(t *testing.T) {
	handler, db, cleanup := setupTestHandler(t)
	defer cleanup()

	createTestUser(t, db, "user-1", "Test User", "valid-token")

	req := httptest.NewRequest(http.MethodDelete, "/api/conversations/non-existent", nil)
	req.Header.Set("Authorization", "Bearer valid-token")

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations/", handler.DeleteConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Code != "conv_not_found" {
		t.Errorf("Expected error code 'conv_not_found', got '%s'", errResp.Code)
	}
}

func TestDeleteConversation_WithoutAuth(t *testing.T) {
	handler, _, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodDelete, "/api/conversations/conv-1", nil)
	// No Authorization header

	rr := httptest.NewRecorder()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/conversations/", handler.DeleteConversation)
	authMux := handler.auth.RequireAuth(mux)
	authMux.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, rr.Code)
	}
}

// =============================================================================
// Helper function tests
// =============================================================================

func TestExtractID(t *testing.T) {
	tests := []struct {
		path     string
		prefix   string
		expected string
	}{
		{"/api/conversations/conv-123", "/api/conversations/", "conv-123"},
		{"/api/conversations/conv-123/", "/api/conversations/", ""},
		{"/api/conversations/", "/api/conversations/", ""},
		{"/api/threads/thread-456", "/api/threads/", "thread-456"},
		{"/api/threads/thread-456/", "/api/threads/", ""},
	}

	for _, tt := range tests {
		result := extractID(tt.path, tt.prefix)
		if result != tt.expected {
			t.Errorf("extractID(%q, %q) = %q, want %q", tt.path, tt.prefix, result, tt.expected)
		}
	}
}

func TestJSONError(t *testing.T) {
	rr := httptest.NewRecorder()
	JSONError(rr, http.StatusBadRequest, "Test error message", "test_error_code")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error != "Test error message" {
		t.Errorf("Expected error message 'Test error message', got '%s'", errResp.Error)
	}
	if errResp.Code != "test_error_code" {
		t.Errorf("Expected code 'test_error_code', got '%s'", errResp.Code)
	}
}

func TestJSONResponse(t *testing.T) {
	rr := httptest.NewRecorder()
	data := map[string]string{"key": "value"}
	JSONResponse(rr, http.StatusOK, data)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	if rr.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Expected Content-Type 'application/json', got '%s'", rr.Header().Get("Content-Type"))
	}

	var result map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if result["key"] != "value" {
		t.Errorf("Expected key 'value', got '%s'", result["key"])
	}
}

// =============================================================================
// Health check test (no auth required)
// =============================================================================

func TestHealthCheck(t *testing.T) {
	handler, _, cleanup := setupTestHandler(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	handler.HealthCheck(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var result map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if result["status"] != "ok" {
		t.Errorf("Expected status 'ok', got '%s'", result["status"])
	}
}
