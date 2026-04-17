package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/lechat/pkg/models"
	"github.com/spf13/cobra"
)

var threadCmd = &cobra.Command{
	Use:   "thread",
	Short: "Manage threads",
}

var threadCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new thread",
	RunE:  runThreadCreate,
}

var threadGetCmd = &cobra.Command{
	Use:   "get",
	Short: "Get a thread by ID with messages",
	RunE:  runThreadGet,
}

var (
	threadConvID string
	threadTopic string
	threadID    string
)

func init() {
	threadCmd.AddCommand(threadCreateCmd)
	threadCmd.AddCommand(threadGetCmd)

	threadCreateCmd.Flags().StringVar(&threadConvID, "conv-id", "", "Conversation ID")
	threadCreateCmd.MarkFlagRequired("conv-id")
	threadCreateCmd.Flags().StringVar(&threadTopic, "topic", "", "Thread topic")
	threadCreateCmd.MarkFlagRequired("topic")

	threadGetCmd.Flags().StringVar(&threadID, "thread-id", "", "Thread ID")
	threadGetCmd.MarkFlagRequired("thread-id")
}

func runThreadCreate(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if threadConvID == "" {
		return fmt.Errorf("conv-id is required")
	}
	if threadTopic == "" {
		return fmt.Errorf("topic is required")
	}

	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	database, err := initDB(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	agentRepo := lechatdb.NewAgentRepository(database)
	convRepo := lechatdb.NewConversationRepository(database)
	threadRepo := lechatdb.NewThreadRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	// Get conversation
	conv, err := convRepo.GetConversation(threadConvID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	// Validate agent is in conversation
	found := false
	for _, id := range conv.AgentIDs {
		if id == agent.ID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("unauthorized: not a member of this conversation")
	}

	// Get all lechat_agent_ids from conversation
	lechatAgentIDs := conv.AgentIDs

	// For each lechat_agent_id, lookup openclaw_agent_id
	var openclawSessions []models.OpenclawSession
	for _, lechatAgentID := range lechatAgentIDs {
		a, err := agentRepo.GetAgentByID(lechatAgentID)
		if err != nil {
			return fmt.Errorf("failed to lookup agent %s: %w", lechatAgentID, err)
		}
		if a == nil {
			return fmt.Errorf("agent %s not found", lechatAgentID)
		}

		// Generate unique UUID v4 (lowercase) for session
		sessionID := strings.ToLower(generateUUID())

		// Inject into each agent's sessions.json using jq
		sessionKey := fmt.Sprintf("agent:%s:lechat:%s", a.OpenclawAgentID, threadTopic)
		sessionValue := fmt.Sprintf(`{"sessionId": "%s"}`, sessionID)

		if err := injectSession(a.OpenclawAgentDir, sessionKey, sessionValue); err != nil {
			return fmt.Errorf("failed to inject session for agent %s: %w", lechatAgentID, err)
		}

		openclawSessions = append(openclawSessions, models.OpenclawSession{
			LechatAgentID:   lechatAgentID,
			OpenclawAgentID: a.OpenclawAgentID,
			SessionID:       sessionID,
		})
	}

	// Create thread record
	now := time.Now().UTC().Format(time.RFC3339)
	thread := &models.Thread{
		ID:                generateUUID(),
		ConvID:            threadConvID,
		Topic:             threadTopic,
		Status:            "active",
		OpenclawSessions:  openclawSessions,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := threadRepo.CreateThread(thread); err != nil {
		return fmt.Errorf("failed to create thread: %w", err)
	}

	// Update conversation's thread_ids
	conv.ThreadIDs = append(conv.ThreadIDs, thread.ID)
	conv.UpdatedAt = now
	if err := convRepo.UpdateConversation(conv); err != nil {
		return fmt.Errorf("failed to update conversation: %w", err)
	}

	output, err := json.MarshalIndent(thread, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func injectSession(agentDir, sessionKey, sessionValue string) error {
	sessionsPath := filepath.Join(agentDir, "sessions", "sessions.json")
	backupPath := sessionsPath + ".bak"

	// Create backup
	input, err := os.ReadFile(sessionsPath)
	if err != nil {
		return fmt.Errorf("failed to read sessions.json: %w", err)
	}

	if err := os.WriteFile(backupPath, input, 0644); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	// Use jq to inject the new session safely using --arg to prevent injection
	jqCmd := exec.Command("jq", "--arg", "key", sessionKey, "--arg", "value", sessionValue, ". + {($key): ($value)}", sessionsPath)

	output, err := jqCmd.Output()
	if err != nil {
		// Restore backup on failure
		os.Rename(backupPath, sessionsPath)
		return fmt.Errorf("jq command failed: %w", err)
	}

	if err := os.WriteFile(sessionsPath, output, 0644); err != nil {
		// Restore backup on failure
		os.Rename(backupPath, sessionsPath)
		return fmt.Errorf("failed to write sessions.json: %w", err)
	}

	// Remove backup on success
	os.Remove(backupPath)

	return nil
}

func runThreadGet(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if threadID == "" {
		return fmt.Errorf("thread-id is required")
	}

	cfg, err := config.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	database, err := initDB(cfg)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	agentRepo := lechatdb.NewAgentRepository(database)
	convRepo := lechatdb.NewConversationRepository(database)
	threadRepo := lechatdb.NewThreadRepository(database)

	// Validate token and get agent
	agent, err := agentRepo.GetAgentByToken(token)
	if err != nil || agent == nil {
		return fmt.Errorf("invalid token")
	}

	// Get thread
	thread, err := threadRepo.GetThread(threadID)
	if err != nil {
		return fmt.Errorf("failed to get thread: %w", err)
	}
	if thread == nil {
		return fmt.Errorf("thread not found")
	}

	// Get conversation
	conv, err := convRepo.GetConversation(thread.ConvID)
	if err != nil {
		return fmt.Errorf("failed to get conversation: %w", err)
	}
	if conv == nil {
		return fmt.Errorf("conversation not found")
	}

	// Validate agent is in conversation
	found := false
	for _, id := range conv.AgentIDs {
		if id == agent.ID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("thread not found")
	}

	// Read messages from JSONL file
	jsonlPath := getMessagePath(cfg, thread.ConvID, thread.ID)
	messages, err := readMessages(jsonlPath)
	if err != nil {
		// If file doesn't exist, return empty messages
		messages = []models.Message{}
	}

	type ThreadResponse struct {
		ID        string           `json:"id"`
		ConvID    string           `json:"conv_id"`
		Topic     string           `json:"topic"`
		Status    string           `json:"status"`
		Messages  []models.Message `json:"messages"`
		CreatedAt string           `json:"created_at"`
		UpdatedAt string           `json:"updated_at"`
	}

	response := ThreadResponse{
		ID:        thread.ID,
		ConvID:    thread.ConvID,
		Topic:     thread.Topic,
		Status:    thread.Status,
		Messages:  messages,
		CreatedAt: thread.CreatedAt,
		UpdatedAt: thread.UpdatedAt,
	}

	output, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func getMessagePath(cfg *config.Config, convID, threadID string) string {
	return filepath.Join(cfg.MessagePath(), convID, threadID+".jsonl")
}

func readMessages(path string) ([]models.Message, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var messages []models.Message
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var msg models.Message
		if err := json.Unmarshal(line, &msg); err != nil {
			continue // Skip malformed lines
		}
		messages = append(messages, msg)
	}

	return messages, scanner.Err()
}
