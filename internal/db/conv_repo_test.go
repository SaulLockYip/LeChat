package db

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/lechat/pkg/models"
)

func setupTestDB(t *testing.T) (*sql.DB, func()) {
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
	CREATE INDEX idx_conv_agent_ids ON conversation(agent_ids);
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

func TestConversationRepository_CreateConversation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	conv := &models.Conversation{
		ID:        "conv-1",
		Type:      "dm",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{"thread-1"},
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateConversation(conv)
	if err != nil {
		t.Fatalf("CreateConversation failed: %v", err)
	}

	// Verify by retrieving
	retrieved, err := repo.GetConversation("conv-1")
	if err != nil {
		t.Fatalf("GetConversation failed: %v", err)
	}

	if retrieved == nil {
		t.Fatal("GetConversation returned nil")
	}

	if retrieved.ID != conv.ID {
		t.Errorf("Expected ID %s, got %s", conv.ID, retrieved.ID)
	}
	if retrieved.Type != conv.Type {
		t.Errorf("Expected Type %s, got %s", conv.Type, retrieved.Type)
	}
	if len(retrieved.AgentIDs) != len(conv.AgentIDs) {
		t.Errorf("Expected %d agent IDs, got %d", len(conv.AgentIDs), len(retrieved.AgentIDs))
	}
}

func TestConversationRepository_GetConversation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Test with non-existent ID
	conv, err := repo.GetConversation("non-existent")
	if err != nil {
		t.Fatalf("GetConversation returned error: %v", err)
	}
	if conv != nil {
		t.Error("Expected nil for non-existent conversation")
	}

	// Create and retrieve
	conv = &models.Conversation{
		ID:        "conv-2",
		Type:      "group",
		AgentIDs:  []string{"agent-1", "agent-2", "agent-3"},
		ThreadIDs: []string{"thread-1", "thread-2"},
		GroupName: stringPtr("Test Group"),
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err = repo.CreateConversation(conv)
	if err != nil {
		t.Fatalf("CreateConversation failed: %v", err)
	}

	retrieved, err := repo.GetConversation("conv-2")
	if err != nil {
		t.Fatalf("GetConversation failed: %v", err)
	}

	if retrieved.GroupName == nil || *retrieved.GroupName != "Test Group" {
		t.Error("Group name not preserved correctly")
	}
}

func TestConversationRepository_UpdateConversation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Create initial conversation
	conv := &models.Conversation{
		ID:        "conv-3",
		Type:      "dm",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{},
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateConversation(conv)
	if err != nil {
		t.Fatalf("CreateConversation failed: %v", err)
	}

	// Update with new thread
	conv.ThreadIDs = []string{"thread-new"}
	conv.UpdatedAt = "2024-01-02T00:00:00Z"

	err = repo.UpdateConversation(conv)
	if err != nil {
		t.Fatalf("UpdateConversation failed: %v", err)
	}

	// Verify update
	retrieved, err := repo.GetConversation("conv-3")
	if err != nil {
		t.Fatalf("GetConversation failed: %v", err)
	}

	if len(retrieved.ThreadIDs) != 1 {
		t.Errorf("Expected 1 thread ID, got %d", len(retrieved.ThreadIDs))
	}
	if retrieved.ThreadIDs[0] != "thread-new" {
		t.Errorf("Expected thread ID 'thread-new', got '%s'", retrieved.ThreadIDs[0])
	}
}

func TestConversationRepository_ListConversations(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Create multiple conversations
	for i := 0; i < 5; i++ {
		conv := &models.Conversation{
			ID:        "conv-list-" + string(rune('a'+i)),
			Type:      "dm",
			AgentIDs:  []string{"agent-1", "agent-2"},
			ThreadIDs: []string{},
			CreatedAt: "2024-01-01T00:00:00Z",
			UpdatedAt: "2024-01-01T00:00:00Z",
		}
		if err := repo.CreateConversation(conv); err != nil {
			t.Fatalf("CreateConversation failed: %v", err)
		}
	}

	convs, err := repo.ListConversations()
	if err != nil {
		t.Fatalf("ListConversations failed: %v", err)
	}

	if len(convs) != 5 {
		t.Errorf("Expected 5 conversations, got %d", len(convs))
	}
}

func TestConversationRepository_AddThreadToConversation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Create conversation with initial threads
	conv := &models.Conversation{
		ID:        "conv-add-thread",
		Type:      "dm",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{"thread-1"},
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}

	err := repo.CreateConversation(conv)
	if err != nil {
		t.Fatalf("CreateConversation failed: %v", err)
	}

	// Add new thread
	err = repo.AddThreadToConversation("conv-add-thread", "thread-2")
	if err != nil {
		t.Fatalf("AddThreadToConversation failed: %v", err)
	}

	// Verify
	retrieved, err := repo.GetConversation("conv-add-thread")
	if err != nil {
		t.Fatalf("GetConversation failed: %v", err)
	}

	if len(retrieved.ThreadIDs) != 2 {
		t.Errorf("Expected 2 thread IDs, got %d", len(retrieved.ThreadIDs))
	}

	// Adding same thread again should be idempotent
	err = repo.AddThreadToConversation("conv-add-thread", "thread-2")
	if err != nil {
		t.Fatalf("AddThreadToConversation (idempotent) failed: %v", err)
	}

	retrieved, _ = repo.GetConversation("conv-add-thread")
	if len(retrieved.ThreadIDs) != 2 {
		t.Errorf("Expected 2 thread IDs after duplicate add, got %d", len(retrieved.ThreadIDs))
	}
}

func TestConversationRepository_GetConversationsByAgentID(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Create conversations with different agents
	convs := []*models.Conversation{
		{
			ID:        "conv-agent-1",
			Type:      "dm",
			AgentIDs:  []string{"agent-1", "agent-2"},
			ThreadIDs: []string{},
			CreatedAt: "2024-01-01T00:00:00Z",
			UpdatedAt: "2024-01-01T00:00:00Z",
		},
		{
			ID:        "conv-agent-2",
			Type:      "dm",
			AgentIDs:  []string{"agent-1", "agent-3"},
			ThreadIDs: []string{},
			CreatedAt: "2024-01-01T00:00:00Z",
			UpdatedAt: "2024-01-01T00:00:00Z",
		},
		{
			ID:        "conv-agent-3",
			Type:      "dm",
			AgentIDs:  []string{"agent-4", "agent-5"},
			ThreadIDs: []string{},
			CreatedAt: "2024-01-01T00:00:00Z",
			UpdatedAt: "2024-01-01T00:00:00Z",
		},
	}

	for _, c := range convs {
		if err := repo.CreateConversation(c); err != nil {
			t.Fatalf("CreateConversation failed: %v", err)
		}
	}

	// Get conversations for agent-1
	results, err := repo.GetConversationsByAgentID("agent-1")
	if err != nil {
		t.Fatalf("GetConversationsByAgentID failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 conversations for agent-1, got %d", len(results))
	}

	// Get conversations for agent-4
	results, err = repo.GetConversationsByAgentID("agent-4")
	if err != nil {
		t.Fatalf("GetConversationsByAgentID failed: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 conversation for agent-4, got %d", len(results))
	}
}

func TestConversationRepository_GetConversationByAgents(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewConversationRepository(db)

	// Create a DM between agent-1 and agent-2
	conv := &models.Conversation{
		ID:        "conv-dm-1-2",
		Type:      "dm",
		AgentIDs:  []string{"agent-1", "agent-2"},
		ThreadIDs: []string{"thread-1"},
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}
	if err := repo.CreateConversation(conv); err != nil {
		t.Fatalf("CreateConversation failed: %v", err)
	}

	// Find DM by agents (order shouldn't matter)
	found, err := repo.GetConversationByAgents([]string{"agent-2", "agent-1"})
	if err != nil {
		t.Fatalf("GetConversationByAgents failed: %v", err)
	}

	if found == nil {
		t.Fatal("Expected to find DM conversation")
	}
	if found.ID != "conv-dm-1-2" {
		t.Errorf("Expected conv-dm-1-2, got %s", found.ID)
	}

	// Non-existent combination
	notFound, err := repo.GetConversationByAgents([]string{"agent-1", "agent-9"})
	if err != nil {
		t.Fatalf("GetConversationByAgents failed: %v", err)
	}
	if notFound != nil {
		t.Error("Expected nil for non-existent conversation")
	}
}

func TestMarshalUnmarshalThreadIDs(t *testing.T) {
	// Test MarshalThreadIDs
	ids := []string{"thread-1", "thread-2", "thread-3"}
	marshaled, err := MarshalThreadIDs(ids)
	if err != nil {
		t.Fatalf("MarshalThreadIDs failed: %v", err)
	}

	// Verify JSON format
	var decoded []string
	if err := json.Unmarshal([]byte(marshaled), &decoded); err != nil {
		t.Fatalf("Invalid JSON from MarshalThreadIDs: %v", err)
	}

	if len(decoded) != len(ids) {
		t.Errorf("Expected %d IDs, got %d", len(ids), len(decoded))
	}

	// Test UnmarshalThreadIDs
	unmarshaled, err := UnmarshalThreadIDs(marshaled)
	if err != nil {
		t.Fatalf("UnmarshalThreadIDs failed: %v", err)
	}

	if len(unmarshaled) != len(ids) {
		t.Errorf("Expected %d IDs, got %d", len(ids), len(unmarshaled))
	}

	// Test empty case
	emptyMarshaled, _ := MarshalThreadIDs([]string{})
	if emptyMarshaled != "[]" {
		t.Errorf("Expected empty array JSON, got %s", emptyMarshaled)
	}
}

func TestJoinAgentIDs(t *testing.T) {
	ids := []string{"agent-1", "agent-2", "agent-3"}
	joined := JoinAgentIDs(ids)
	expected := "[agent-1,agent-2,agent-3]"
	if joined != expected {
		t.Errorf("Expected %s, got %s", expected, joined)
	}
}

// Helper for nullable string pointer
func stringPtr(s string) *string {
	return &s
}

// TestJSONLManager_AppendMessage tests appending messages to a JSONL file
func TestJSONLManager_AppendMessage(t *testing.T) {
	// Create temp directory
	tempDir, err := os.MkdirTemp("", "lechat-jsonl-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	jsonl := NewJSONLManager(tempDir)

	msg := &models.Message{
		ID:        0,
		From:      "agent-1",
		Content:   "Hello, World!",
		Timestamp: "2024-01-01T00:00:00Z",
	}

	err = jsonl.AppendMessage("thread-1", "conv-1", msg)
	if err != nil {
		t.Fatalf("AppendMessage failed: %v", err)
	}

	// Read back
	messages, err := jsonl.ReadMessages("thread-1", "conv-1")
	if err != nil {
		t.Fatalf("ReadMessages failed: %v", err)
	}

	if len(messages) != 1 {
		t.Fatalf("Expected 1 message, got %d", len(messages))
	}

	if messages[0].Content != "Hello, World!" {
		t.Errorf("Expected 'Hello, World!', got '%s'", messages[0].Content)
	}
}

// TestJSONLManager_GetLastMessageID tests retrieving the last message ID
func TestJSONLManager_GetLastMessageID(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lechat-jsonl-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	jsonl := NewJSONLManager(tempDir)

	// Initially no messages
	id, err := jsonl.GetLastMessageID("thread-1", "conv-1", false)
	if err != nil {
		t.Fatalf("GetLastMessageID failed: %v", err)
	}
	if id != 0 {
		t.Errorf("Expected 0 for empty thread, got %d", id)
	}

	// Add messages
	for i := 0; i < 5; i++ {
		msg := &models.Message{
			ID:        0,
			From:      "agent-1",
			Content:   "Message " + string(rune('0'+i)),
			Timestamp: "2024-01-01T00:00:00Z",
		}
		jsonl.AppendMessage("thread-1", "conv-1", msg)
	}

	id, err = jsonl.GetLastMessageID("thread-1", "conv-1", false)
	if err != nil {
		t.Fatalf("GetLastMessageID failed: %v", err)
	}
	if id != 5 {
		t.Errorf("Expected 5, got %d", id)
	}
}

func TestJSONLManager_FilePath(t *testing.T) {
	tempDir := "/tmp/test"
	jsonl := NewJSONLManager(tempDir)

	path := jsonl.getFilePath("thread-1", "conv-1")
	expected := filepath.Join(tempDir, "conv-1", "thread-1.jsonl")
	if path != expected {
		t.Errorf("Expected %s, got %s", expected, path)
	}
}
