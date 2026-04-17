package socket

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"sync"
	"time"

	"github.com/lechat/internal/db"
	"github.com/lechat/internal/handler"
	"github.com/lechat/internal/notification"
	"github.com/lechat/internal/queue"
	"github.com/lechat/pkg/models"
)

// MessageRequest represents an incoming message request via socket
type MessageRequest struct {
	Type    string          `json:"type"`
	Version string          `json:"version"`
	Body    json.RawMessage `json:"body"`
}

// MessageBody represents the body of a message_send request
type MessageBody struct {
	Token      string `json:"token"`
	ThreadID   string `json:"thread_id"`
	Content    string `json:"content"`
	FilePath   string `json:"file_path,omitempty"`
	QuoteID    int    `json:"quoted_message_id,omitempty"`
	Mention    []string `json:"mention,omitempty"`
}

// Server represents the Unix socket server
type Server struct {
	socketPath   string
	listener     net.Listener
	jsonl        *db.JSONLManager
	convRepo     *db.ConversationRepository
	threadRepo   *db.ThreadRepository
	agentRepo    *db.AgentRepository
	writeQueue   *queue.WriteQueue
	notifyQueue  *notification.NotificationQueue
	sseBroadcaster *handler.SSEBroadcaster
	stopCh       chan struct{}
	stoppedCh    chan struct{}
	wg           sync.WaitGroup
}

// NewServer creates a new Unix socket server
func NewServer(
	socketPath string,
	jsonl *db.JSONLManager,
	convRepo *db.ConversationRepository,
	threadRepo *db.ThreadRepository,
	agentRepo *db.AgentRepository,
	writeQueue *queue.WriteQueue,
	notifyQueue *notification.NotificationQueue,
	sseBroadcaster *handler.SSEBroadcaster,
) *Server {
	return &Server{
		socketPath:    socketPath,
		jsonl:         jsonl,
		convRepo:      convRepo,
		threadRepo:    threadRepo,
		agentRepo:     agentRepo,
		writeQueue:    writeQueue,
		notifyQueue:   notifyQueue,
		sseBroadcaster: sseBroadcaster,
		stopCh:        make(chan struct{}),
		stoppedCh:     make(chan struct{}),
	}
}

// removeSocketFile removes the socket file if it exists
func removeSocketFile(socketPath string) error {
	_, err := os.Stat(socketPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Remove(socketPath)
}

// setSocketPermissions sets socket file permissions
func setSocketPermissions(socketPath string) error {
	return os.Chmod(socketPath, 0770)
}

// Start begins listening on the Unix socket
func (s *Server) Start() error {
	// Remove existing socket file
	if err := removeSocketFile(s.socketPath); err != nil {
		log.Printf("Warning: could not remove existing socket file: %v", err)
	}

	// Create Unix socket listener
	listener, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("failed to create socket listener: %w", err)
	}
	s.listener = listener

	// Set permissions
	if err := setSocketPermissions(s.socketPath); err != nil {
		log.Printf("Warning: could not set socket permissions: %v", err)
	}

	log.Printf("Unix socket server listening on %s", s.socketPath)

	s.wg.Add(1)
	go s.acceptLoop()

	return nil
}

// acceptLoop accepts incoming connections
func (s *Server) acceptLoop() {
	defer s.wg.Done()

	for {
		select {
		case <-s.stopCh:
			return
		default:
		}

		s.listener.(*net.UnixListener).SetDeadline(time.Now().Add(1 * time.Second))

		conn, err := s.listener.Accept()
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if s.isClosed() {
				return
			}
			log.Printf("Error accepting connection: %v", err)
			continue
		}

		s.wg.Add(1)
		go s.handleConnection(conn)
	}
}

// handleConnection handles a single socket connection
func (s *Server) handleConnection(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()

	decoder := json.NewDecoder(conn)
	encoder := json.NewEncoder(conn)

	for {
		select {
		case <-s.stopCh:
			return
		default:
		}

		// Set read deadline
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var req MessageRequest
		if err := decoder.Decode(&req); err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if err.Error() != "EOF" {
				log.Printf("Error decoding message: %v", err)
			}
			return
		}

		s.handleMessage(conn, encoder, &req)
	}
}

// handleMessage routes messages by type
func (s *Server) handleMessage(conn net.Conn, encoder *json.Encoder, req *MessageRequest) {
	switch req.Type {
	case "message_send":
		s.handleMessageSend(conn, encoder, req.Body)
	default:
		s.sendError(encoder, "unknown_message_type", fmt.Sprintf("Unknown message type: %s", req.Type))
	}
}

// handleMessageSend processes a message_send request
func (s *Server) handleMessageSend(conn net.Conn, encoder *json.Encoder, body json.RawMessage) {
	var msgBody MessageBody
	if err := json.Unmarshal(body, &msgBody); err != nil {
		s.sendError(encoder, "invalid_body", "Failed to parse message body")
		return
	}

	// Validate token
	agent, err := s.agentRepo.GetAgentByToken(msgBody.Token)
	if agent == nil {
		s.sendError(encoder, "invalid_token", "Invalid token")
		return
	}
	if err != nil {
		s.sendError(encoder, "db_error", "Database error")
		return
	}

	// Validate thread exists
	thread, err := s.threadRepo.GetThread(msgBody.ThreadID)
	if err != nil {
		s.sendError(encoder, "db_error", "Database error")
		return
	}
	if thread == nil {
		s.sendError(encoder, "thread_not_found", "Thread not found")
		return
	}

	// Validate agent belongs to conversation
	conv, err := s.convRepo.GetConversation(thread.ConvID)
	if err != nil {
		s.sendError(encoder, "db_error", "Database error")
		return
	}
	if conv == nil {
		s.sendError(encoder, "conversation_not_found", "Conversation not found")
		return
	}
	agentInConv := false
	for _, id := range conv.AgentIDs {
		if id == agent.ID {
			agentInConv = true
			break
		}
	}
	if !agentInConv {
		s.sendError(encoder, "unauthorized", "Agent not a member of this conversation")
		return
	}

	// Create message
	msg := models.Message{
		From:      agent.ID,
		Content:   msgBody.Content,
		FilePath:  msgBody.FilePath,
		QuotedMessageID: msgBody.QuoteID,
		Mention:   msgBody.Mention,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	// Enqueue for writing
	writeTask := &queue.WriteTask{
		ThreadID: msgBody.ThreadID,
		ConvID:   thread.ConvID,
		Message:  msg,
	}
	s.writeQueue.Enqueue(writeTask)

	// Enqueue for notification
	conv, err := s.convRepo.GetConversation(thread.ConvID)
	if err == nil && conv != nil {
		notifyTask := &notification.NotificationTask{
			ThreadID:    msgBody.ThreadID,
			ConvID:      thread.ConvID,
			ConvType:    conv.Type,
			FromAgentID: agent.ID,
			Message:     msg,
			Mentioned:   msgBody.Mention,
		}
		s.notifyQueue.Enqueue(notifyTask)
	}

	// Broadcast via SSE
	s.sseBroadcaster.BroadcastNewMessage(msgBody.ThreadID, thread.ConvID, msg)
	s.sseBroadcaster.BroadcastThreadUpdated(msgBody.ThreadID, thread.ConvID, msg.Timestamp)

	// Send success response
	s.sendResponse(encoder, map[string]interface{}{
		"status":   "ok",
		"thread_id": msgBody.ThreadID,
	})
}

// sendResponse sends a success response
func (s *Server) sendResponse(encoder *json.Encoder, data interface{}) {
	response := map[string]interface{}{
		"type": "response",
		"data": data,
	}
	if err := encoder.Encode(response); err != nil {
		log.Printf("Error sending response: %v", err)
	}
}

// sendError sends an error response
func (s *Server) sendError(encoder *json.Encoder, code, message string) {
	response := map[string]interface{}{
		"type": "error",
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	}
	if err := encoder.Encode(response); err != nil {
		log.Printf("Error sending error: %v", err)
	}
}

// isClosed checks if the server is stopped
func (s *Server) isClosed() bool {
	select {
	case <-s.stopCh:
		return true
	default:
		return false
	}
}

// Stop gracefully stops the socket server
func (s *Server) Stop() error {
	close(s.stopCh)

	if s.listener != nil {
		if err := s.listener.Close(); err != nil {
			log.Printf("Error closing listener: %v", err)
		}
	}

	s.wg.Wait()
	close(s.stoppedCh)

	return nil
}

// WaitForStop waits for the server to fully stop
func (s *Server) WaitForStop() {
	<-s.stoppedCh
}
