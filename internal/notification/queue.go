package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/lechat/pkg/models"
)

const (
	// NotificationWorkerPoolSize is the number of notification workers
	NotificationWorkerPoolSize = 5
	// NotificationQueueSize is the size of the notification queue
	NotificationQueueSize = 1000
)

// Notification templates
const (
	dmTemplate = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 You have a new message from <%s>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%s

🕐 %s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 View context:
lechat thread get --thread-id %s --token {yourLeChatTokenInTOOLS.md}

💬 Reply (only if you have something to contribute):
lechat message send --token {yourLeChatTokenInTOOLS.md} --thread-id %s --content "{your_reply}" [--file {filePath or validUrl}]`

	groupTemplate = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

	// fileAttachmentTemplate is appended to message content when a file attachment exists
	fileAttachmentTemplate = `

📎 Attachment: %s`
)

// NotificationTask represents a notification task
type NotificationTask struct {
	ThreadID    string
	ConvID      string
	ConvType    string // "dm" or "group"
	FromAgentID string
	Message     models.Message
	Mentioned   []string // openclaw_agent_ids (for group messages)
}

// NotificationQueue manages notification delivery
type NotificationQueue struct {
	db *sql.DB

	// Task channel
	taskCh chan *NotificationTask

	// Worker control
	wg        sync.WaitGroup
	stopCh    chan struct{}
	stoppedCh chan struct{}
}

// NewNotificationQueue creates a new notification queue
func NewNotificationQueue(db *sql.DB) *NotificationQueue {
	return &NotificationQueue{
		db:         db,
		taskCh:     make(chan *NotificationTask, NotificationQueueSize),
		stopCh:     make(chan struct{}),
		stoppedCh:  make(chan struct{}),
	}
}

// Enqueue adds a notification task to the queue
func (q *NotificationQueue) Enqueue(task *NotificationTask) {
	q.taskCh <- task // blocking send, waits until queue has space
}

// StartWorkers starts the notification worker pool
func (q *NotificationQueue) StartWorkers() {
	for i := 0; i < NotificationWorkerPoolSize; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}
}

// worker processes notification tasks
func (q *NotificationQueue) worker(id int) {
	defer q.wg.Done()

	for {
		select {
		case <-q.stopCh:
			// Drain remaining tasks before exiting
			q.drainTasks()
			return
		case task := <-q.taskCh:
			q.processTask(task)
		}
	}
}

// processTask processes a notification task
func (q *NotificationQueue) processTask(task *NotificationTask) {
	switch task.ConvType {
	case "dm":
		q.notifyDM(task)
	case "group":
		q.notifyGroup(task)
	default:
		log.Printf("Unknown conversation type: %s", task.ConvType)
	}
}

// notifyDM notifies participants in a DM conversation
func (q *NotificationQueue) notifyDM(task *NotificationTask) {
	// Check if sender is a user
	isUser := strings.HasPrefix(task.FromAgentID, "user:")

	// Get sender display name
	var senderDisplay string
	if isUser {
		// Format: "Human User: {userName}:{userTitle}"
		senderDisplay = q.getHumanUserDisplayName(task.FromAgentID)
	} else {
		senderDisplay, _ = q.getOpenClawAgentID(task.FromAgentID)
	}

	// Get thread
	thread, err := q.getThread(task.ThreadID)
	if err != nil || thread == nil {
		log.Printf("Thread not found: %s", task.ThreadID)
		return
	}

	// Find sessions to notify
	for _, session := range thread.OpenclawSessions {
		if isUser {
			// User sender: notify BOTH agents
			q.executeNotification(session.SessionID, q.formatDMMessage(senderDisplay, task.Message, task.ThreadID))
		} else if session.LechatAgentID != task.FromAgentID {
			// Agent sender: notify the OTHER agent only
			q.executeNotification(session.SessionID, q.formatDMMessage(senderDisplay, task.Message, task.ThreadID))
		}
	}
}

// formatDMMessage formats a DM notification message
func (q *NotificationQueue) formatDMMessage(senderDisplay string, msg models.Message, threadID string) string {
	content := msg.Content
	if msg.FilePath != "" {
		content += fmt.Sprintf(fileAttachmentTemplate, msg.FilePath)
	}
	return fmt.Sprintf(dmTemplate,
		senderDisplay,
		content,
		msg.Timestamp,
		threadID,
		threadID,
	)
}

// notifyGroup notifies only @mentioned agents in a group conversation
func (q *NotificationQueue) notifyGroup(task *NotificationTask) {
	if len(task.Mentioned) == 0 {
		// No mentions, nothing to notify
		return
	}

	// Get the thread to find openclaw sessions
	thread, err := q.getThread(task.ThreadID)
	if err != nil {
		log.Printf("Error getting thread for group notification: %v", err)
		return
	}
	if thread == nil {
		log.Printf("Thread not found: %s", task.ThreadID)
		return
	}

	// Get sender's OpenClaw agent ID
	var senderOpenclawID string
	if strings.HasPrefix(task.FromAgentID, "user:") {
		senderOpenclawID = q.getHumanUserDisplayName(task.FromAgentID)
	} else {
		senderOpenclawID, _ = q.getOpenClawAgentID(task.FromAgentID)
	}

	// Create a map of lechat_agent_id to session
	sessionMap := make(map[string]models.OpenclawSession)
	for _, session := range thread.OpenclawSessions {
		sessionMap[session.LechatAgentID] = session
	}

	// Convert openclaw_agent_ids to lechat_agent_ids for session lookup
	// task.Mentioned contains openclaw_agent_ids but sessionMap is keyed by lechat_agent_id
	var mentionedLechatIDs []string
	for _, openclawID := range task.Mentioned {
		lechatID, err := q.getLechatAgentIDByOpenClawID(openclawID)
		if err != nil {
			log.Printf("Error converting openclaw ID %s to lechat ID: %v", openclawID, err)
			continue
		}
		mentionedLechatIDs = append(mentionedLechatIDs, lechatID)
	}

	// Get mentioned agents' OpenClaw IDs for display
	mentionedOpenclawIDs, err := q.getMentionedOpenClawAgentIDs(mentionedLechatIDs)
	if err != nil {
		log.Printf("Error getting mentioned OpenClaw agent IDs: %v", err)
		return
	}

	// Format mentioned agents for display
	mentionedDisplay := strings.Join(mentionedOpenclawIDs, ", ")

	// Notify only mentioned agents
	for _, lechatID := range mentionedLechatIDs {
		if session, exists := sessionMap[lechatID]; exists {
			// Format notification message using template
			// For single mention, don't use array syntax
			var mentionArg string
			if len(mentionedOpenclawIDs) == 1 {
				mentionArg = mentionedOpenclawIDs[0]
			} else {
				mentionArg = strings.Join(mentionedOpenclawIDs, `","`)
			}

			content := task.Message.Content
			if task.Message.FilePath != "" {
				content += fmt.Sprintf(fileAttachmentTemplate, task.Message.FilePath)
			}

			message := fmt.Sprintf(groupTemplate,
				senderOpenclawID,
				content,
				task.Message.Timestamp,
				thread.Topic,
				mentionedDisplay,
				task.ThreadID,
				task.ThreadID,
				mentionArg,
			)

			q.executeNotification(session.SessionID, message)
		} else {
			log.Printf("No session found for mentioned agent %s in thread %s", lechatID, task.ThreadID)
		}
	}
}

// executeNotification executes the openclaw notification command
func (q *NotificationQueue) executeNotification(sessionID, message string) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "openclaw", "agent", "--session-id", sessionID, "--message", message)
	if err := cmd.Run(); err != nil {
		log.Printf("Error executing openclaw notification: %v", err)
	}
}

// getThread retrieves a thread from the database
func (q *NotificationQueue) getThread(threadID string) (*models.Thread, error) {
	query := `
		SELECT id, conv_id, topic, status, openclaw_sessions, created_at, updated_at
		FROM thread
		WHERE id = ?
	`
	row := q.db.QueryRow(query, threadID)

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

// getConversation retrieves a conversation from the database
func (q *NotificationQueue) getConversation(convID string) (*models.Conversation, error) {
	query := `
		SELECT id, type, agent_ids, thread_ids, group_name, created_at, updated_at
		FROM conversation
		WHERE id = ?
	`
	row := q.db.QueryRow(query, convID)

	var conv models.Conversation
	var agentIDsJSON, threadIDsJSON string
	err := row.Scan(&conv.ID, &conv.Type, &agentIDsJSON, &threadIDsJSON, &conv.GroupName, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := json.Unmarshal([]byte(agentIDsJSON), &conv.AgentIDs); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(threadIDsJSON), &conv.ThreadIDs); err != nil {
		return nil, err
	}

	return &conv, nil
}

// getOpenClawAgentID retrieves the OpenClaw agent ID for a given LeChat agent ID
func (q *NotificationQueue) getOpenClawAgentID(lechatAgentID string) (string, error) {
	query := `SELECT openclaw_agent_id FROM agent WHERE id = ?`
	var openclawAgentID string
	err := q.db.QueryRow(query, lechatAgentID).Scan(&openclawAgentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("agent not found: %s", lechatAgentID)
		}
		return "", err
	}
	return openclawAgentID, nil
}

// getLechatAgentIDByOpenClawID retrieves the LeChat agent ID for a given OpenClaw agent ID
func (q *NotificationQueue) getLechatAgentIDByOpenClawID(openclawAgentID string) (string, error) {
	query := `SELECT id FROM agent WHERE openclaw_agent_id = ?`
	var lechatAgentID string
	err := q.db.QueryRow(query, openclawAgentID).Scan(&lechatAgentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("agent not found: %s", openclawAgentID)
		}
		return "", err
	}
	return lechatAgentID, nil
}

// getMentionedOpenClawAgentIDs retrieves OpenClaw agent IDs for a list of LeChat agent IDs
func (q *NotificationQueue) getMentionedOpenClawAgentIDs(lechatAgentIDs []string) ([]string, error) {
	if len(lechatAgentIDs) == 0 {
		return nil, nil
	}

	// Build query with placeholders
	placeholders := make([]string, len(lechatAgentIDs))
	args := make([]interface{}, len(lechatAgentIDs))
	for i, id := range lechatAgentIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf("SELECT openclaw_agent_id FROM agent WHERE id IN (%s)", strings.Join(placeholders, ","))
	rows, err := q.db.Query(query, args...)
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

// getHumanUserDisplayName retrieves the display name for a human user
func (q *NotificationQueue) getHumanUserDisplayName(fromAgentID string) string {
	// Format: "user:user_001" -> extract user_001
	userID := strings.TrimPrefix(fromAgentID, "user:")

	// Query user from database to get name and title
	query := `SELECT name, title FROM user WHERE id = ?`
	var name, title string
	err := q.db.QueryRow(query, userID).Scan(&name, &title)
	if err != nil {
		return "Human User" // fallback
	}

	if title != "" {
		return fmt.Sprintf("Human User: %s:%s", name, title)
	}
	return fmt.Sprintf("Human User: %s", name)
}

// drainTasks drains remaining tasks from the queue
func (q *NotificationQueue) drainTasks() {
	for {
		select {
		case task := <-q.taskCh:
			q.processTask(task)
		default:
			return
		}
	}
}

// Stop gracefully stops the notification queue
func (q *NotificationQueue) Stop() {
	close(q.stopCh)
	q.wg.Wait()
	close(q.stoppedCh)
}

// GetQueueLength returns the current queue length
func (q *NotificationQueue) GetQueueLength() int {
	return len(q.taskCh)
}
