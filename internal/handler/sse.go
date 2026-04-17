package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// Event represents an SSE event
type Event struct {
	Type            string      `json:"type"`
	ThreadID        string      `json:"thread_id,omitempty"`
	ConvID          string      `json:"conv_id,omitempty"`
	Message         interface{} `json:"message,omitempty"`
	MessageID       int         `json:"message_id,omitempty"`
	LatestMessageAt string      `json:"latest_message_at,omitempty"`
}

// SSEClient represents a connected SSE client
type SSEClient struct {
	ID      string
	Channel chan Event
}

// SSEBroadcaster manages SSE client connections and broadcasting
type SSEBroadcaster struct {
	clients    map[string]SSEClient
	clientsMu  sync.RWMutex
	register   chan SSEClient
	unregister chan string // use client ID for unregister
	broadcast  chan Event
	stopCh     chan struct{}
	stoppedCh  chan struct{}
}

// NewSSEBroadcaster creates a new SSE broadcaster and starts it
func NewSSEBroadcaster() *SSEBroadcaster {
	b := &SSEBroadcaster{
		clients:    make(map[string]SSEClient),
		register:   make(chan SSEClient),
		unregister: make(chan string),
		broadcast:  make(chan Event, 100),
		stopCh:     make(chan struct{}),
		stoppedCh:  make(chan struct{}),
	}
	b.Start()
	return b
}

// Start begins the broadcaster's event loop
func (b *SSEBroadcaster) Start() {
	go b.run()
}

// run is the main event loop
func (b *SSEBroadcaster) run() {
	for {
		select {
		case client := <-b.register:
			b.clientsMu.Lock()
			b.clients[client.ID] = client
			b.clientsMu.Unlock()
			log.Printf("SSE client connected (total: %d)", len(b.clients))

		case clientID := <-b.unregister:
			b.clientsMu.Lock()
			if client, exists := b.clients[clientID]; exists {
				delete(b.clients, clientID)
				close(client.Channel)
				log.Printf("SSE client disconnected (total: %d)", len(b.clients))
			}
			b.clientsMu.Unlock()

		case event := <-b.broadcast:
			b.sendToAll(event)

		case <-b.stopCh:
			b.drainClients()
			close(b.stoppedCh)
			return
		}
	}
}

// sendToAll sends an event to all connected clients
func (b *SSEBroadcaster) sendToAll(event Event) {
	b.clientsMu.RLock()
	defer b.clientsMu.RUnlock()

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling SSE event: %v", err)
		return
	}

	for _, client := range b.clients {
		select {
		case client.Channel <- event:
		default:
			// Client buffer full, skip
		}
		_ = data // suppress unused variable warning
	}
}

// AddClient registers a new client and returns it
func (b *SSEBroadcaster) AddClient() SSEClient {
	client := SSEClient{
		ID:      fmt.Sprintf("%d", time.Now().UnixNano()),
		Channel: make(chan Event, 50),
	}
	b.register <- client
	return client
}

// RemoveClient unregisters a client by ID
func (b *SSEBroadcaster) RemoveClient(client SSEClient) {
	b.unregister <- client.ID
}

// Broadcast sends an event to all clients
func (b *SSEBroadcaster) Broadcast(event Event) {
	select {
	case b.broadcast <- event:
	default:
		log.Printf("SSE broadcast channel full, dropping event type: %s", event.Type)
	}
}

// BroadcastNewMessage broadcasts a new message event
func (b *SSEBroadcaster) BroadcastNewMessage(threadID, convID string, message interface{}) {
	b.Broadcast(Event{
		Type:     "new_message",
		ThreadID: threadID,
		ConvID:   convID,
		Message:  message,
	})
}

// BroadcastThreadUpdated broadcasts a thread updated event
func (b *SSEBroadcaster) BroadcastThreadUpdated(threadID, convID string, latestMessageAt string) {
	b.Broadcast(Event{
		Type:            "thread_updated",
		ThreadID:        threadID,
		ConvID:          convID,
		LatestMessageAt: latestMessageAt,
	})
}

// drainClients disconnects all clients on shutdown
func (b *SSEBroadcaster) drainClients() {
	b.clientsMu.Lock()
	defer b.clientsMu.Unlock()

	for _, client := range b.clients {
		close(client.Channel)
	}
	b.clients = make(map[string]SSEClient)
}

// Stop gracefully stops the broadcaster
func (b *SSEBroadcaster) Stop() {
	close(b.stopCh)
	<-b.stoppedCh
}

// GetClientCount returns the number of connected clients
func (b *SSEBroadcaster) GetClientCount() int {
	b.clientsMu.RLock()
	defer b.clientsMu.RUnlock()
	return len(b.clients)
}

// SSEHandler handles SSE connections
type SSEHandler struct {
	broadcaster *SSEBroadcaster
}

// NewSSEHandler creates a new SSE handler
func NewSSEHandler(broadcaster *SSEBroadcaster) *SSEHandler {
	return &SSEHandler{
		broadcaster: broadcaster,
	}
}

// HandleSSE handles the SSE stream endpoint
func (h *SSEHandler) HandleSSE(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Create client
	client := h.broadcaster.AddClient()
	defer h.broadcaster.RemoveClient(client)

	// Create a done channel for client disconnect
	clientGone := r.Context().Done()

	// Send initial ping
	fmt.Fprintf(w, "data: {\"type\": \"connected\"}\n\n")
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Stream events to client
	for {
		select {
		case <-clientGone:
			return
		case event, ok := <-client.Channel:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				log.Printf("Error marshaling SSE event: %v", err)
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}
