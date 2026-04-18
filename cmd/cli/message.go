package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	lechatdb "github.com/lechat/internal/db"
	"github.com/lechat/pkg/config"
	"github.com/spf13/cobra"
)

var messageCmd = &cobra.Command{
	Use:   "message",
	Short: "Manage messages",
}

var messageSendCmd = &cobra.Command{
	Use:   "send",
	Short: "Send a message to a thread",
	RunE:  runMessageSend,
}

var (
	messageThreadID string
	messageContent  string
	messageFile     string
	messageQuote    string
	messageMention  string
)

func init() {
	messageCmd.AddCommand(messageSendCmd)

	messageSendCmd.Flags().StringVar(&messageThreadID, "thread-id", "", "Thread ID")
	messageSendCmd.MarkFlagRequired("thread-id")
	messageSendCmd.Flags().StringVar(&messageContent, "content", "", "Message content")
	messageSendCmd.MarkFlagRequired("content")
	messageSendCmd.Flags().StringVar(&messageFile, "file", "", "File path or URL")
	messageSendCmd.Flags().StringVar(&messageQuote, "quote", "", "Quoted message ID")
	messageSendCmd.Flags().StringVar(&messageMention, "mention", "", "JSON array of openclaw agent IDs to mention")
}

type SocketMessage struct {
	Type    string      `json:"type"`
	Version string      `json:"version"`
	Body    interface{} `json:"body"`
}

type MessageSendBody struct {
	Token           string   `json:"token"`
	ThreadID        string   `json:"thread_id"`
	Content         string   `json:"content"`
	FilePath        string   `json:"file_path,omitempty"`
	QuotedMessageID int      `json:"quoted_message_id,omitempty"`
	Mention         []string `json:"mention,omitempty"`
}

func runMessageSend(cmd *cobra.Command, args []string) error {
	if token == "" {
		return fmt.Errorf("token is required")
	}
	if messageThreadID == "" {
		return fmt.Errorf("thread-id is required")
	}
	if messageContent == "" {
		return fmt.Errorf("content is required")
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
	thread, err := threadRepo.GetThread(messageThreadID)
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
		return fmt.Errorf("unauthorized: not a member of this conversation")
	}

	// Validate --file if provided
	if messageFile != "" {
		if isWebURL(messageFile) {
			// Validate web URL
			if _, err := url.ParseRequestURI(messageFile); err != nil {
				return fmt.Errorf("invalid web URL: %w", err)
			}
		} else {
			// Validate local file
			if strings.Contains(messageFile, "..") {
				return fmt.Errorf("file path cannot contain '..'")
			}
			if !filepath.IsAbs(messageFile) {
				return fmt.Errorf("file path must be absolute")
			}
			if _, err := os.Stat(messageFile); os.IsNotExist(err) {
				return fmt.Errorf("file does not exist: %s", messageFile)
			}
		}
	}

	// Validate --quote if provided
	var quotedMsgID int
	if messageQuote != "" {
		quotedMsgID, err = validateQuoteMessage(cfg, thread.ConvID, messageThreadID, messageQuote)
		if err != nil {
			return err
		}
	}

	// Validate --mention for group conversations
	var mentions []string
	if messageMention != "" {
		if conv.Type != "group" {
			return fmt.Errorf("--mention can only be used in group conversations")
		}

		if err := json.Unmarshal([]byte(messageMention), &mentions); err != nil {
			return fmt.Errorf("invalid --mention JSON: %w", err)
		}

		// Validate mentioned agents are in conversation by openclaw_agent_id
		for _, mentionID := range mentions {
			foundMention := false
			for _, lechatID := range conv.AgentIDs {
				a, _ := agentRepo.GetAgentByID(lechatID)
				if a != nil && a.OpenclawAgentID == mentionID {
					foundMention = true
					break
				}
			}
			if !foundMention {
				return fmt.Errorf("mentioned agent %s is not in this conversation", mentionID)
			}
		}
	}

	// Build message send body
	body := MessageSendBody{
		Token:           token,
		ThreadID:        messageThreadID,
		Content:         messageContent,
		QuotedMessageID: quotedMsgID,
		Mention:         mentions,
	}

	if messageFile != "" {
		body.FilePath = messageFile
	}

	// Connect to Server via Unix Socket
	socketPath := cfg.SocketPath()
	conn, err := net.DialTimeout("unix", socketPath, 5*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer conn.Close()

	// Send message
	socketMsg := SocketMessage{
		Type:    MessageTypeMessageSend,
		Version: ProtocolVersion,
		Body:    body,
	}

	msgBytes, err := json.Marshal(socketMsg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	_, err = conn.Write(append(msgBytes, '\n'))
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	// Read server response
	respBuf := make([]byte, 1024)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	n, err := conn.Read(respBuf)
	if err != nil {
		return fmt.Errorf("failed to read server response: %w", err)
	}

	var resp SocketMessage
	if err := json.Unmarshal(respBuf[:n], &resp); err != nil {
		return fmt.Errorf("failed to parse server response: %w", err)
	}

	if resp.Type == MessageTypeError {
		return fmt.Errorf("server error: %v", resp.Body)
	}

	fmt.Println("Message sent successfully")
	return nil
}

func isWebURL(path string) bool {
	u, err := url.Parse(path)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https")
}

func validateQuoteMessage(cfg *config.Config, convID, threadID, quoteStr string) (int, error) {
	// Parse quote to int
	var quoteID int
	if _, err := fmt.Sscanf(quoteStr, "%d", &quoteID); err != nil {
		return 0, fmt.Errorf("invalid quote message ID: %s", quoteStr)
	}

	// Read messages from JSONL
	jsonlPath := getMessagePath(cfg, convID, threadID)
	file, err := os.Open(jsonlPath)
	if err != nil {
		return 0, fmt.Errorf("failed to read messages: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var msg struct {
			ID int `json:"id"`
		}
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		if msg.ID == quoteID {
			return quoteID, nil
		}
	}

	return 0, fmt.Errorf("quoted message ID %d not found in thread", quoteID)
}
