package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/lechat/internal/db"
	"github.com/lechat/pkg/models"
)

// setupTestDB creates an in-memory SQLite DB with user schema
func setupTestDB(t *testing.T) (*db.UserRepository, func()) {
	t.Helper()

	sqlDB, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}

	schema := `
	CREATE TABLE user (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		title TEXT,
		token TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	`
	if _, err := sqlDB.Exec(schema); err != nil {
		sqlDB.Close()
		t.Fatalf("Failed to create schema: %v", err)
	}

	userRepo := db.NewUserRepository(sqlDB)
	cleanup := func() {
		sqlDB.Close()
	}

	return userRepo, cleanup
}

// setupTestUser creates a user with a known token
func setupTestUser(t *testing.T, userRepo *db.UserRepository, token string) {
	t.Helper()
	user := &models.User{
		ID:        "user-1",
		Name:      "Test User",
		Title:     "Tester",
		Token:     token,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := userRepo.CreateUser(user); err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
}

func TestSSEHandler_MissingToken_Returns401(t *testing.T) {
	userRepo, cleanup := setupTestDB(t)
	defer cleanup()

	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	handler := NewSSEHandler(broadcaster, userRepo)

	req := httptest.NewRequest("GET", "/api/events", nil)
	w := httptest.NewRecorder()

	handler.HandleSSE(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}

	body := w.Body.String()
	if !strings.Contains(body, "token required") {
		t.Errorf("Expected 'token required' in body, got: %s", body)
	}
}

func TestSSEHandler_InvalidToken_Returns401(t *testing.T) {
	userRepo, cleanup := setupTestDB(t)
	defer cleanup()

	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	handler := NewSSEHandler(broadcaster, userRepo)

	req := httptest.NewRequest("GET", "/api/events?token=invalid-token", nil)
	w := httptest.NewRecorder()

	handler.HandleSSE(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}

	body := w.Body.String()
	if !strings.Contains(body, "invalid token") {
		t.Errorf("Expected 'invalid token' in body, got: %s", body)
	}
}

func TestSSEHandler_ValidToken_ReturnsSSEStream(t *testing.T) {
	userRepo, cleanup := setupTestDB(t)
	defer cleanup()

	setupTestUser(t, userRepo, "valid-token-123")

	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	handler := NewSSEHandler(broadcaster, userRepo)

	req := httptest.NewRequest("GET", "/api/events?token=valid-token-123", nil)
	w := httptest.NewRecorder()

	// Create done channel to signal end of test
	done := make(chan struct{})

	go func() {
		handler.HandleSSE(w, req)
		close(done)
	}()

	// Wait for initial response with connected message
	time.Sleep(100 * time.Millisecond)

	// Verify SSE headers
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("Expected Content-Type 'text/event-stream', got '%s'", w.Header().Get("Content-Type"))
	}
	if w.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("Expected Cache-Control 'no-cache', got '%s'", w.Header().Get("Cache-Control"))
	}
	if w.Header().Get("Connection") != "keep-alive" {
		t.Errorf("Expected Connection 'keep-alive', got '%s'", w.Header().Get("Connection"))
	}

	// Verify initial connected message was sent
	body := w.Body.String()
	if !strings.Contains(body, `"type": "connected"`) {
		t.Errorf("Expected initial connected event in body, got: %s", body)
	}

	// Clean up by closing request context
	req.Context().Done()
}

func TestSSEHandler_BroadcastNewMessage(t *testing.T) {
	userRepo, cleanup := setupTestDB(t)
	defer cleanup()

	setupTestUser(t, userRepo, "valid-token-123")

	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	handler := NewSSEHandler(broadcaster, userRepo)

	// Create first client
	req1 := httptest.NewRequest("GET", "/api/events?token=valid-token-123", nil)
	w1 := httptest.NewRecorder()

	clientGone1 := make(chan struct{})
	go func() {
		handler.HandleSSE(w1, req1)
		close(clientGone1)
	}()
	defer func() {
		// Signal disconnect by canceling context
	}()

	time.Sleep(50 * time.Millisecond)

	// Create second client
	req2 := httptest.NewRequest("GET", "/api/events?token=valid-token-123", nil)
	w2 := httptest.NewRecorder()

	go func() {
		handler.HandleSSE(w2, req2)
	}()

	time.Sleep(50 * time.Millisecond)

	// Broadcast new_message event
	testMessage := map[string]interface{}{
		"id":      1,
		"from":    "agent-1",
		"content": "Hello, World!",
	}
	handler.BroadcastNewMessage("thread-1", "conv-1", testMessage)

	// Give time for broadcast to be received
	time.Sleep(100 * time.Millisecond)

	// Verify both clients received the new_message event
	body1 := w1.Body.String()
	body2 := w2.Body.String()

	if !strings.Contains(body1, `"type":"new_message"`) {
		t.Errorf("Client 1 expected new_message event, got: %s", body1)
	}
	if !strings.Contains(body1, `"thread_id":"thread-1"`) {
		t.Errorf("Client 1 expected thread_id 'thread-1', got: %s", body1)
	}

	if !strings.Contains(body2, `"type":"new_message"`) {
		t.Errorf("Client 2 expected new_message event, got: %s", body2)
	}
	if !strings.Contains(body2, `"thread_id":"thread-1"`) {
		t.Errorf("Client 2 expected thread_id 'thread-1', got: %s", body2)
	}

	// Verify message content is preserved
	if !strings.Contains(body1, "Hello, World!") {
		t.Errorf("Client 1 expected message content, got: %s", body1)
	}
}

func TestSSEHandler_BroadcastThreadUpdated(t *testing.T) {
	userRepo, cleanup := setupTestDB(t)
	defer cleanup()

	setupTestUser(t, userRepo, "valid-token-123")

	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	handler := NewSSEHandler(broadcaster, userRepo)

	// Create a client
	req := httptest.NewRequest("GET", "/api/events?token=valid-token-123", nil)
	w := httptest.NewRecorder()

	go func() {
		handler.HandleSSE(w, req)
	}()

	time.Sleep(50 * time.Millisecond)

	// Broadcast thread_updated event
	handler.BroadcastThreadUpdated("thread-1", "conv-1", "2024-01-01T12:00:00Z")

	// Give time for broadcast to be received
	time.Sleep(100 * time.Millisecond)

	body := w.Body.String()

	if !strings.Contains(body, `"type":"thread_updated"`) {
		t.Errorf("Expected thread_updated event, got: %s", body)
	}
	if !strings.Contains(body, `"thread_id":"thread-1"`) {
		t.Errorf("Expected thread_id 'thread-1', got: %s", body)
	}
	if !strings.Contains(body, `"conv_id":"conv-1"`) {
		t.Errorf("Expected conv_id 'conv-1', got: %s", body)
	}
	if !strings.Contains(body, `"latest_message_at":"2024-01-01T12:00:00Z"`) {
		t.Errorf("Expected latest_message_at timestamp, got: %s", body)
	}
}

func TestSSEBroadcaster_BroadcastEvent(t *testing.T) {
	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	// Add a client
	client := broadcaster.AddClient()
	defer broadcaster.RemoveClient(client)

	// Create a goroutine to receive the event
	eventReceived := make(chan Event, 1)
	go func() {
		select {
		case event := <-client.Channel:
			eventReceived <- event
		case <-time.After(time.Second):
			t.Error("Timeout waiting for broadcast event")
		}
	}()

	// Broadcast an event
	testEvent := Event{
		Type:     "test_event",
		ThreadID: "thread-123",
		ConvID:   "conv-456",
	}
	broadcaster.Broadcast(testEvent)

	// Wait for event with timeout
	select {
	case event := <-eventReceived:
		if event.Type != "test_event" {
			t.Errorf("Expected event type 'test_event', got '%s'", event.Type)
		}
		if event.ThreadID != "thread-123" {
			t.Errorf("Expected thread_id 'thread-123', got '%s'", event.ThreadID)
		}
	case <-time.After(time.Second):
		t.Error("Timeout waiting for broadcast event")
	}
}

func TestSSEBroadcaster_AddRemoveClient(t *testing.T) {
	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	// Wait for broadcaster to start
	time.Sleep(10 * time.Millisecond)

	initialCount := broadcaster.GetClientCount()

	// Add client
	client1 := broadcaster.AddClient()
	time.Sleep(10 * time.Millisecond) // Wait for registration to process
	if broadcaster.GetClientCount() != initialCount+1 {
		t.Errorf("Expected client count %d after add, got %d", initialCount+1, broadcaster.GetClientCount())
	}

	// Add another client
	client2 := broadcaster.AddClient()
	time.Sleep(10 * time.Millisecond) // Wait for registration to process
	if broadcaster.GetClientCount() != initialCount+2 {
		t.Errorf("Expected client count %d after second add, got %d", initialCount+2, broadcaster.GetClientCount())
	}

	// Remove first client
	broadcaster.RemoveClient(client1)
	time.Sleep(10 * time.Millisecond) // Give time for unregister to process
	if broadcaster.GetClientCount() != initialCount+1 {
		t.Errorf("Expected client count %d after remove, got %d", initialCount+1, broadcaster.GetClientCount())
	}

	// Remove second client
	broadcaster.RemoveClient(client2)
	time.Sleep(10 * time.Millisecond)
	if broadcaster.GetClientCount() != initialCount {
		t.Errorf("Expected client count %d after all removed, got %d", initialCount, broadcaster.GetClientCount())
	}
}

func TestSSEBroadcaster_MultipleClientsReceiveBroadcast(t *testing.T) {
	broadcaster := NewSSEBroadcaster()
	defer broadcaster.Stop()

	numClients := 5
	clients := make([]SSEClient, numClients)
	receivedCount := make(chan int, numClients)

	// Create multiple clients
	for i := 0; i < numClients; i++ {
		clients[i] = broadcaster.AddClient()
		go func(client SSEClient) {
			select {
			case <-client.Channel:
				receivedCount <- 1
			case <-time.After(time.Second):
				t.Error("Timeout waiting for broadcast")
			}
		}(clients[i])
	}

	time.Sleep(20 * time.Millisecond) // Let clients register

	// Broadcast to all
	broadcaster.Broadcast(Event{Type: "broadcast_test", ThreadID: "thread-x"})

	// Count received broadcasts
	totalReceived := 0
	timeout := time.After(time.Second)
	for totalReceived < numClients {
		select {
		case <-receivedCount:
			totalReceived++
		case <-timeout:
			t.Errorf("Timeout waiting for all broadcasts, received %d of %d", totalReceived, numClients)
			return
		}
	}

	if totalReceived != numClients {
		t.Errorf("Expected %d clients to receive broadcast, got %d", numClients, totalReceived)
	}
}

func TestEvent_JSONSerialization(t *testing.T) {
	event := Event{
		Type:            "new_message",
		ThreadID:        "thread-1",
		ConvID:          "conv-1",
		Message:         map[string]interface{}{"id": 1, "content": "test"},
		MessageID:       42,
		LatestMessageAt: "2024-01-01T12:00:00Z",
	}

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to marshal event: %v", err)
	}

	var decoded Event
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal event: %v", err)
	}

	if decoded.Type != event.Type {
		t.Errorf("Expected type '%s', got '%s'", event.Type, decoded.Type)
	}
	if decoded.ThreadID != event.ThreadID {
		t.Errorf("Expected thread_id '%s', got '%s'", event.ThreadID, decoded.ThreadID)
	}
	if decoded.ConvID != event.ConvID {
		t.Errorf("Expected conv_id '%s', got '%s'", event.ConvID, decoded.ConvID)
	}
	if decoded.MessageID != event.MessageID {
		t.Errorf("Expected message_id %d, got %d", event.MessageID, decoded.MessageID)
	}
}
