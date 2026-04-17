package notification

import (
	"database/sql"
	"encoding/json"
	"log"
	"os/exec"
	"sync"

	"github.com/lechat/pkg/models"
)

const (
	// NotificationWorkerPoolSize is the number of notification workers
	NotificationWorkerPoolSize = 5
	// NotificationQueueSize is the size of the notification queue
	NotificationQueueSize = 1000
)

// NotificationTask represents a notification task
type NotificationTask struct {
	ThreadID    string
	ConvID      string
	ConvType    string // "dm" or "group"
	FromAgentID string
	Message     models.Message
	Mentioned   []string // For group messages, the @mentioned agents
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
	select {
	case q.taskCh <- task:
	default:
		log.Printf("Notification queue full, dropping task for thread %s", task.ThreadID)
	}
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

// notifyDM notifies the other party in a DM conversation
func (q *NotificationQueue) notifyDM(task *NotificationTask) {
	// Get the thread to find the other party's openclaw session
	thread, err := q.getThread(task.ThreadID)
	if err != nil {
		log.Printf("Error getting thread for DM notification: %v", err)
		return
	}
	if thread == nil {
		log.Printf("Thread not found: %s", task.ThreadID)
		return
	}

	// Find the other party's session (not the sender)
	var targetSession models.OpenclawSession
	for _, session := range thread.OpenclawSessions {
		if session.LechatAgentID != task.FromAgentID {
			targetSession = session
			break
		}
	}

	if targetSession.SessionID == "" {
		log.Printf("No target session found for DM notification in thread %s", task.ThreadID)
		return
	}

	// Execute openclaw notification
	q.executeNotification(targetSession.SessionID, task.Message.Content)
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

	// Create a map of agent ID to session
	sessionMap := make(map[string]models.OpenclawSession)
	for _, session := range thread.OpenclawSessions {
		sessionMap[session.LechatAgentID] = session
	}

	// Notify only mentioned agents
	for _, mentionedAgentID := range task.Mentioned {
		if session, exists := sessionMap[mentionedAgentID]; exists {
			q.executeNotification(session.SessionID, task.Message.Content)
		}
	}
}

// executeNotification executes the openclaw notification command
func (q *NotificationQueue) executeNotification(sessionID, message string) {
	cmd := exec.Command("openclaw", "--session-id", sessionID, "--message", message)
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
