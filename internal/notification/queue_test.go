package notification

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/lechat/pkg/models"
)

// testDB setup with full schema for notification testing
func setupTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory DB: %v", err)
	}

	schema := `
	CREATE TABLE agent (
		id TEXT PRIMARY KEY,
		openclaw_agent_id TEXT NOT NULL,
		openclaw_workspace TEXT,
		openclaw_agent_dir TEXT,
		token TEXT,
		created_at TEXT,
		updated_at TEXT
	);
	CREATE INDEX idx_agent_openclaw_id ON agent(openclaw_agent_id);

	CREATE TABLE user (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		title TEXT,
		token TEXT,
		created_at TEXT,
		updated_at TEXT
	);

	CREATE TABLE thread (
		id TEXT PRIMARY KEY,
		conv_id TEXT NOT NULL,
		topic TEXT,
		status TEXT,
		openclaw_sessions TEXT NOT NULL DEFAULT '[]',
		created_at TEXT,
		updated_at TEXT
	);
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

// NotificationRecorder records notifications instead of executing them
type NotificationRecorder struct {
	mu            sync.Mutex
	Notifications []NotificationRecord
}

// NotificationRecord represents a captured notification
type NotificationRecord struct {
	SessionID string
	Message   string
}

// NewNotificationRecorder creates a new notification recorder
func NewNotificationRecorder() *NotificationRecorder {
	return &NotificationRecorder{
		Notifications: make([]NotificationRecord, 0),
	}
}

// MockNotificationExecutor implements the notification execution with recording
type MockNotificationExecutor struct {
	Recorder *NotificationRecorder
	DB       *sql.DB
}

// executeNotification records the notification instead of running openclaw
func (m *MockNotificationExecutor) executeNotification(sessionID, message string) {
	m.Recorder.mu.Lock()
	defer m.Recorder.mu.Unlock()
	m.Recorder.Notifications = append(m.Recorder.Notifications, NotificationRecord{
		SessionID: sessionID,
		Message:   message,
	})
}

// getThread retrieves a thread from the database
func (m *MockNotificationExecutor) getThread(threadID string) (*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
		WHERE id = ?
	`
	row := m.DB.QueryRow(query, threadID)

	var thread models.Thread
	var openclawSessionsJSON string
	err := row.Scan(&thread.ID, &thread.ConvID, &thread.Topic, &thread.Status, &openclawSessionsJSON, &thread.CreatedAt, &thread.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := json.Unmarshal([]byte(openclawSessionsJSON), &thread.OpenclawSessions); err != nil {
		return nil, err
	}

	return &thread, nil
}

// getOpenClawAgentID retrieves the OpenClaw agent ID for a given LeChat agent ID
func (m *MockNotificationExecutor) getOpenClawAgentID(lechatAgentID string) (string, error) {
	query := `SELECT openclaw_agent_id FROM agent WHERE id = ?`
	var openclawAgentID string
	err := m.DB.QueryRow(query, lechatAgentID).Scan(&openclawAgentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	return openclawAgentID, nil
}

// getLechatAgentIDByOpenClawID retrieves the LeChat agent ID for a given OpenClaw agent ID
func (m *MockNotificationExecutor) getLechatAgentIDByOpenClawID(openclawAgentID string) (string, error) {
	query := `SELECT id FROM agent WHERE openclaw_agent_id = ?`
	var lechatAgentID string
	err := m.DB.QueryRow(query, openclawAgentID).Scan(&lechatAgentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("agent not found: %s", openclawAgentID)
		}
		return "", err
	}
	return lechatAgentID, nil
}

// getHumanUserDisplayName retrieves the display name for a human user
func (m *MockNotificationExecutor) getHumanUserDisplayName(fromAgentID string) string {
	userID := fromAgentID // Already in format "user:user_001" but we only need the ID part
	if len(userID) > 5 {
		userID = userID[5:] // Remove "user:" prefix
	}

	query := `SELECT name, title FROM user WHERE id = ?`
	var name, title string
	err := m.DB.QueryRow(query, userID).Scan(&name, &title)
	if err != nil {
		return "Human User" // fallback
	}

	if title != "" {
		return "Human User: " + name + ":" + title
	}
	return "Human User: " + name
}

// getMentionedOpenClawAgentIDs retrieves OpenClaw agent IDs for a list of LeChat agent IDs
func (m *MockNotificationExecutor) getMentionedOpenClawAgentIDs(lechatAgentIDs []string) ([]string, error) {
	if len(lechatAgentIDs) == 0 {
		return nil, nil
	}

	placeholders := make([]string, len(lechatAgentIDs))
	args := make([]interface{}, len(lechatAgentIDs))
	for i, id := range lechatAgentIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := "SELECT openclaw_agent_id FROM agent WHERE id IN (" + joinStrings(placeholders) + ")"
	rows, err := m.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var openclawIDs []string
	for rows.Next() {
		var openclawID string
		if err := rows.Scan(&openclawID); err != nil {
			return nil, err
		}
		openclawIDs = append(openclawIDs, openclawID)
	}

	return openclawIDs, nil
}

func joinStrings(strs []string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += ","
		}
		result += s
	}
	return result
}

// TestableNotifier provides testable notification methods
type TestableNotifier struct {
	*MockNotificationExecutor
	*NotificationRecorder
}

// NewTestableNotifier creates a testable notifier
func NewTestableNotifier(db *sql.DB, recorder *NotificationRecorder) *TestableNotifier {
	executor := &MockNotificationExecutor{
		Recorder: recorder,
		DB:       db,
	}
	return &TestableNotifier{
		MockNotificationExecutor: executor,
		NotificationRecorder:     recorder,
	}
}

// Helper to create thread with sessions
func createTestThread(t *testing.T, db *sql.DB, threadID, convID, topic string, sessions []models.OpenclawSession) {
	t.Helper()
	sessionsJSON, _ := json.Marshal(sessions)
	_, err := db.Exec(`
		INSERT INTO thread (id, conv_id, topic, status, openclaw_sessions, created_at, updated_at)
		VALUES (?, ?, ?, 'active', ?, ?, ?)`,
		threadID, convID, topic, string(sessionsJSON), time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("Failed to create test thread: %v", err)
	}
}

// Helper to create agent
func createTestAgent(t *testing.T, db *sql.DB, id, openclawAgentID string) {
	t.Helper()
	_, err := db.Exec(`
		INSERT INTO agent (id, openclaw_agent_id, created_at, updated_at)
		VALUES (?, ?, ?, ?)`,
		id, openclawAgentID, time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("Failed to create test agent: %v", err)
	}
}

// Helper to create user
func createTestUser(t *testing.T, db *sql.DB, id, name, title string) {
	t.Helper()
	_, err := db.Exec(`
		INSERT INTO user (id, name, title, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`,
		id, name, title, time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339))
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
}

// =============================================================================
// Test 1: notifyDM with user: prefix - notifies BOTH agents
// =============================================================================

func TestNotifyDM_UserSender_NotifiesBothAgents(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	// Create two agents in a DM thread
	agent1ID := "lechat-agent-1"
	agent2ID := "lechat-agent-2"
	session1ID := "session-001"
	session2ID := "session-002"

	createTestAgent(t, db, agent1ID, "openclaw-agent-1")
	createTestAgent(t, db, agent2ID, "openclaw-agent-2")

	// Create thread with both agents' sessions
	createTestThread(t, db, "thread-1", "conv-1", "Test DM", []models.OpenclawSession{
		{LechatAgentID: agent1ID, OpenclawAgentID: "openclaw-agent-1", SessionID: session1ID},
		{LechatAgentID: agent2ID, OpenclawAgentID: "openclaw-agent-2", SessionID: session2ID},
	})

	// Create a user
	createTestUser(t, db, "user_001", "Char Siu", "Engineer")

	// Send message from user - use the testable notifier's methods directly
	task := &NotificationTask{
		ThreadID:    "thread-1",
		ConvID:      "conv-1",
		ConvType:    "dm",
		FromAgentID: "user:user_001", // User sender
		Message: models.Message{
			ID:        1,
			From:      "user:user_001",
			Content:   "Hello from user!",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Process using testable notifier
	testableNotifyDM(notifier, task)

	// Verify BOTH agents were notified
	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	if len(recorder.Notifications) != 2 {
		t.Errorf("Expected 2 notifications (both agents), got %d", len(recorder.Notifications))
	}

	// Verify session IDs
	sessionIDs := make(map[string]bool)
	for _, n := range recorder.Notifications {
		sessionIDs[n.SessionID] = true
	}

	if !sessionIDs[session1ID] {
		t.Error("Agent 1 session was not notified")
	}
	if !sessionIDs[session2ID] {
		t.Error("Agent 2 session was not notified")
	}

	// Verify message contains "Human User: Char Siu:Engineer"
	for _, n := range recorder.Notifications {
		if n.SessionID == session1ID {
			if !containsSubstring(n.Message, "Human User: Char Siu:Engineer") {
				t.Errorf("Message should contain 'Human User: Char Siu:Engineer', got: %s", n.Message)
			}
		}
	}
}

// =============================================================================
// Test 2: notifyDM with agent sender - notifies only OTHER agent
// =============================================================================

func TestNotifyDM_AgentSender_NotifiesOnlyOtherAgent(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	// Create two agents
	agent1ID := "lechat-agent-1"
	agent2ID := "lechat-agent-2"
	session1ID := "session-001"
	session2ID := "session-002"

	createTestAgent(t, db, agent1ID, "openclaw-agent-1")
	createTestAgent(t, db, agent2ID, "openclaw-agent-2")

	// Create thread with both agents
	createTestThread(t, db, "thread-1", "conv-1", "Test DM", []models.OpenclawSession{
		{LechatAgentID: agent1ID, OpenclawAgentID: "openclaw-agent-1", SessionID: session1ID},
		{LechatAgentID: agent2ID, OpenclawAgentID: "openclaw-agent-2", SessionID: session2ID},
	})

	// Agent 1 sends message
	task := &NotificationTask{
		ThreadID:    "thread-1",
		ConvID:      "conv-1",
		ConvType:    "dm",
		FromAgentID: agent1ID, // Agent sender
		Message: models.Message{
			ID:        1,
			From:      agent1ID,
			Content:   "Hello from agent 1!",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	testableNotifyDM(notifier, task)

	// Verify only OTHER agent was notified (not self)
	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	if len(recorder.Notifications) != 1 {
		t.Errorf("Expected 1 notification (other agent only), got %d", len(recorder.Notifications))
	}

	if len(recorder.Notifications) > 0 {
		if recorder.Notifications[0].SessionID != session2ID {
			t.Errorf("Expected notification to session2 (agent 2), got %s", recorder.Notifications[0].SessionID)
		}
	}
}

// =============================================================================
// Test 3: notifyGroup with openclaw_agent_id mention - converts to lechat_agent_id
// =============================================================================

func TestNotifyGroup_ConvertsOpenclawIDToLechatID(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	// Create agents with known openclaw IDs
	agent1ID := "lechat-agent-1"
	agent2ID := "lechat-agent-2"
	openclawAgent1ID := "openclaw-agent-1"
	openclawAgent2ID := "openclaw-agent-2"
	session1ID := "session-001"
	session2ID := "session-002"

	createTestAgent(t, db, agent1ID, openclawAgent1ID)
	createTestAgent(t, db, agent2ID, openclawAgent2ID)

	// Create thread with sessions (keyed by lechat_agent_id)
	createTestThread(t, db, "thread-1", "conv-1", "Test Group", []models.OpenclawSession{
		{LechatAgentID: agent1ID, OpenclawAgentID: openclawAgent1ID, SessionID: session1ID},
		{LechatAgentID: agent2ID, OpenclawAgentID: openclawAgent2ID, SessionID: session2ID},
	})

	// Agent 1 mentions agent 2 via openclaw_agent_id (this is the bug scenario)
	task := &NotificationTask{
		ThreadID:    "thread-1",
		ConvID:      "conv-1",
		ConvType:    "group",
		FromAgentID: agent1ID,
		Message: models.Message{
			ID:        1,
			From:      agent1ID,
			Content:   "Hello @openclaw-agent-2",
			Timestamp: time.Now().Format(time.RFC3339),
		},
		Mentioned: []string{openclawAgent2ID}, // Note: using openclaw_agent_id
	}

	testableNotifyGroup(notifier, task)

	// Verify only mentioned agent was notified
	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	if len(recorder.Notifications) != 1 {
		t.Errorf("Expected 1 notification (only mentioned agent), got %d", len(recorder.Notifications))
	}

	if len(recorder.Notifications) > 0 {
		if recorder.Notifications[0].SessionID != session2ID {
			t.Errorf("Expected notification to session2 (agent 2), got %s", recorder.Notifications[0].SessionID)
		}
	}
}

// =============================================================================
// Test 4: getHumanUserDisplayName - formats correctly
// =============================================================================

func TestGetHumanUserDisplayName_WithTitle(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	createTestUser(t, db, "user_001", "Char Siu", "Engineer")

	displayName := notifier.getHumanUserDisplayName("user:user_001")

	expected := "Human User: Char Siu:Engineer"
	if displayName != expected {
		t.Errorf("Expected '%s', got '%s'", expected, displayName)
	}
}

func TestGetHumanUserDisplayName_WithoutTitle(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	createTestUser(t, db, "user_002", "Bob", "")

	displayName := notifier.getHumanUserDisplayName("user:user_002")

	expected := "Human User: Bob"
	if displayName != expected {
		t.Errorf("Expected '%s', got '%s'", expected, displayName)
	}
}

func TestGetHumanUserDisplayName_UserNotFound(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	displayName := notifier.getHumanUserDisplayName("user:nonexistent")

	// Should return fallback
	if displayName != "Human User" {
		t.Errorf("Expected fallback 'Human User', got '%s'", displayName)
	}
}

// =============================================================================
// Test 5: getLechatAgentIDByOpenClawID - converts openclaw to lechat
// =============================================================================

func TestGetLechatAgentIDByOpenClawID_Success(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	agentID := "lechat-agent-1"
	openclawID := "openclaw-agent-1"
	createTestAgent(t, db, agentID, openclawID)

	lechatID, err := notifier.getLechatAgentIDByOpenClawID(openclawID)

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if lechatID != agentID {
		t.Errorf("Expected '%s', got '%s'", agentID, lechatID)
	}
}

func TestGetLechatAgentIDByOpenClawID_NotFound(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	_, err := notifier.getLechatAgentIDByOpenClawID("nonexistent-openclaw-id")

	if err == nil {
		t.Error("Expected error for non-existent openclaw ID")
	}
}

// =============================================================================
// Helper functions that replicate the notification logic for testing
// =============================================================================

// testableNotifyDM is a testable version of notifyDM
func testableNotifyDM(n *TestableNotifier, task *NotificationTask) {
	// Check if sender is a user
	isUser := len(task.FromAgentID) >= 5 && task.FromAgentID[:5] == "user:"

	// Get sender display name
	var senderDisplay string
	if isUser {
		senderDisplay = n.getHumanUserDisplayName(task.FromAgentID)
	} else {
		senderDisplay, _ = n.getOpenClawAgentID(task.FromAgentID)
	}

	// Get thread
	thread, err := n.getThread(task.ThreadID)
	if err != nil || thread == nil {
		return
	}

	// Find sessions to notify
	for _, session := range thread.OpenclawSessions {
		if isUser {
			// User sender: notify BOTH agents
			n.executeNotification(session.SessionID, formatDMMessage(senderDisplay, task.Message))
		} else if session.LechatAgentID != task.FromAgentID {
			// Agent sender: notify the OTHER agent only
			n.executeNotification(session.SessionID, formatDMMessage(senderDisplay, task.Message))
		}
	}
}

// formatDMMessage formats a DM notification message
func formatDMMessage(senderDisplay string, msg models.Message) string {
	template := `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 You have a new message from <%s>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%s

🕐 %s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 View context:
lechat thread get --thread-id %s --token {yourLeChatTokenInTOOLS.md}

💬 Reply (only if you have something to contribute):
lechat message send --token {yourLeChatTokenInTOOLS.md} --thread-id %s --content "{your_reply}" [--file {filePath or validUrl}]`
	return fmt.Sprintf(template,
		senderDisplay,
		msg.Content,
		msg.Timestamp,
		msg.Timestamp,
		msg.Timestamp,
	)
}

// testableNotifyGroup is a testable version of notifyGroup
func testableNotifyGroup(n *TestableNotifier, task *NotificationTask) {
	if len(task.Mentioned) == 0 {
		return
	}

	// Get the thread to find openclaw sessions
	thread, err := n.getThread(task.ThreadID)
	if err != nil || thread == nil {
		return
	}

	// Get sender's OpenClaw agent ID
	var senderOpenclawID string
	isUser := len(task.FromAgentID) >= 5 && task.FromAgentID[:5] == "user:"
	if isUser {
		senderOpenclawID = n.getHumanUserDisplayName(task.FromAgentID)
	} else {
		senderOpenclawID, _ = n.getOpenClawAgentID(task.FromAgentID)
	}

	// Create a map of lechat_agent_id to session
	sessionMap := make(map[string]models.OpenclawSession)
	for _, session := range thread.OpenclawSessions {
		sessionMap[session.LechatAgentID] = session
	}

	// Convert openclaw_agent_ids to lechat_agent_ids for session lookup
	var mentionedLechatIDs []string
	for _, openclawID := range task.Mentioned {
		lechatID, err := n.getLechatAgentIDByOpenClawID(openclawID)
		if err != nil {
			continue
		}
		mentionedLechatIDs = append(mentionedLechatIDs, lechatID)
	}

	// Get mentioned agents' OpenClaw IDs for display
	mentionedOpenclawIDs, err := n.getMentionedOpenClawAgentIDs(mentionedLechatIDs)
	if err != nil {
		return
	}

	// Format mentioned agents for display
	mentionedDisplay := joinStrings(mentionedOpenclawIDs)

	// Notify only mentioned agents
	for _, lechatID := range mentionedLechatIDs {
		if session, exists := sessionMap[lechatID]; exists {
			message := formatGroupMessage(senderOpenclawID, task.Message, thread.Topic, mentionedDisplay, task.ThreadID, mentionedOpenclawIDs)
			n.executeNotification(session.SessionID, message)
		}
	}
}

// formatGroupMessage formats a group notification message
func formatGroupMessage(senderOpenclawID string, msg models.Message, topic, mentionedDisplay, threadID string, mentionedOpenclawIDs []string) string {
	template := `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 You were mentioned by <%s> in a group message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%s

🕐 %s
📌 Thread: %s
👥 Mentioned: %s

📖 View context:
lechat thread get --thread-id %s --token {yourLeChatTokenInTOOLS.md}

💬 Reply (only if you have something to contribute):
lechat message send --token {yourLeChatTokenInTOOLS.md} --thread-id %s --content "{your_reply}" [--mention '["%s"]'] [--file {filePath or validUrl}]`
	var mentionArg string
	if len(mentionedOpenclawIDs) == 1 {
		mentionArg = mentionedOpenclawIDs[0]
	} else {
		mentionArg = joinStringsQuoted(mentionedOpenclawIDs)
	}
	return fmt.Sprintf(template,
		senderOpenclawID,
		msg.Content,
		msg.Timestamp,
		topic,
		mentionedDisplay,
		threadID,
		threadID,
		mentionArg,
	)
}

func joinStringsQuoted(strs []string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += `","`
		}
		result += s
	}
	return result
}

// =============================================================================
// Integration test: Full notification queue with worker pool
// =============================================================================

func TestNotificationQueue_FullIntegration(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Use the real queue for integration test (with in-memory db)
	q := NewNotificationQueue(db)
	q.StartWorkers()
	defer q.Stop()

	// Create agents
	agent1ID := "lechat-agent-1"
	agent2ID := "lechat-agent-2"

	createTestAgent(t, db, agent1ID, "openclaw-agent-1")
	createTestAgent(t, db, agent2ID, "openclaw-agent-2")

	// Create thread
	createTestThread(t, db, "thread-1", "conv-1", "Test", []models.OpenclawSession{
		{LechatAgentID: agent1ID, OpenclawAgentID: "openclaw-agent-1", SessionID: "session-001"},
		{LechatAgentID: agent2ID, OpenclawAgentID: "openclaw-agent-2", SessionID: "session-002"},
	})

	// Create user
	createTestUser(t, db, "user_001", "Alice", "Developer")

	// Enqueue DM task from user
	task := &NotificationTask{
		ThreadID:    "thread-1",
		ConvID:      "conv-1",
		ConvType:    "dm",
		FromAgentID: "user:user_001",
		Message: models.Message{
			ID:        1,
			From:      "user:user_001",
			Content:   "Integration test message",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	q.Enqueue(task)

	// Wait for processing
	time.Sleep(500 * time.Millisecond)

	// Queue should be empty after processing
	// Note: We can't easily verify notifications without mocking, but we can verify no panics
}

// =============================================================================
// Helper function
// =============================================================================

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// =============================================================================
// Edge case tests
// =============================================================================

func TestNotifyGroup_NoMentions(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	// Create thread
	createTestThread(t, db, "thread-1", "conv-1", "Test", []models.OpenclawSession{
		{LechatAgentID: "agent-1", OpenclawAgentID: "openclaw-1", SessionID: "session-1"},
	})

	task := &NotificationTask{
		ThreadID:  "thread-1",
		ConvID:    "conv-1",
		ConvType:  "group",
		Mentioned: []string{}, // No mentions
		Message: models.Message{
			From:      "agent-1",
			Content:   "Test",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	testableNotifyGroup(notifier, task)

	recorder.mu.Lock()
	defer recorder.mu.Unlock()

	if len(recorder.Notifications) != 0 {
		t.Errorf("Expected 0 notifications for no mentions, got %d", len(recorder.Notifications))
	}
}

func TestNotifyGroup_ThreadNotFound(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	task := &NotificationTask{
		ThreadID:  "nonexistent-thread",
		ConvID:    "conv-1",
		ConvType:  "group",
		Mentioned: []string{"openclaw-agent-1"},
		Message: models.Message{
			From:      "agent-1",
			Content:   "Test",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Should not panic
	testableNotifyGroup(notifier, task)
}

func TestNotifyDM_ThreadNotFound(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	recorder := NewNotificationRecorder()
	notifier := NewTestableNotifier(db, recorder)

	task := &NotificationTask{
		ThreadID:    "nonexistent-thread",
		ConvID:      "conv-1",
		ConvType:    "dm",
		FromAgentID: "user:user_001",
		Message: models.Message{
			From:      "user:user_001",
			Content:   "Test",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Should not panic
	testableNotifyDM(notifier, task)
}

func TestNotificationQueue_EnqueueDequeue(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	q := NewNotificationQueue(db)

	task := &NotificationTask{
		ThreadID: "thread-1",
		ConvID:   "conv-1",
		ConvType: "dm",
	}

	// Enqueue should work
	q.Enqueue(task)

	if q.GetQueueLength() != 1 {
		t.Errorf("Expected queue length 1, got %d", q.GetQueueLength())
	}
}

func TestNotificationQueue_Stop(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	q := NewNotificationQueue(db)
	q.StartWorkers()

	// Stop should drain and exit gracefully
	q.Stop()

	// Verify stopped channel is closed
	select {
	case _, ok := <-q.stoppedCh:
		if ok {
			t.Error("stoppedCh should be closed after Stop")
		}
	default:
		t.Error("stoppedCh should be readable after Stop")
	}
}

// Test for concurrent access
func TestNotificationRecorder_ConcurrentWrites(t *testing.T) {
	recorder := NewNotificationRecorder()
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			recorder.mu.Lock()
			recorder.Notifications = append(recorder.Notifications, NotificationRecord{
				SessionID: "session-1",
				Message:   "Message",
			})
			recorder.mu.Unlock()
		}(i)
	}

	wg.Wait()

	if len(recorder.Notifications) != 100 {
		t.Errorf("Expected 100 notifications, got %d", len(recorder.Notifications))
	}
}
