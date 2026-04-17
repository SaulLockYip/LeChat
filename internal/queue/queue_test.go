package queue

import (
	"os"
	"sync"
	"testing"
	"time"

	"github.com/lechat/internal/db"
	"github.com/lechat/pkg/models"
)

func setupTestJSONL(t *testing.T) (*db.JSONLManager, func()) {
	t.Helper()

	tempDir, err := os.MkdirTemp("", "lechat-queue-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	jsonl := db.NewJSONLManager(tempDir)

	cleanup := func() {
		os.RemoveAll(tempDir)
	}

	return jsonl, cleanup
}

func TestWriteQueue_NewWriteQueue(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	if q == nil {
		t.Fatal("NewWriteQueue returned nil")
	}

	if q.jsonl == nil {
		t.Error("JSONLManager not set")
	}

	if q.threadChannels == nil {
		t.Error("threadChannels map not initialized")
	}

	if cap(q.taskCh) != ChannelCapacity*10 {
		t.Errorf("Expected taskCh capacity %d, got %d", ChannelCapacity*10, cap(q.taskCh))
	}
}

func TestWriteQueue_getOrCreateChannel(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// First call should create channel
	ch1 := q.getOrCreateChannel("thread-1")
	if ch1 == nil {
		t.Fatal("getOrCreateChannel returned nil")
	}

	// Second call should return same channel
	ch2 := q.getOrCreateChannel("thread-1")
	if ch1 != ch2 {
		t.Error("getOrCreateChannel returned different channels for same thread")
	}

	// Different thread should get different channel
	ch3 := q.getOrCreateChannel("thread-2")
	if ch1 == ch3 {
		t.Error("Different threads should get different channels")
	}

	// Verify channel capacity
	if cap(ch1) != ChannelCapacity {
		t.Errorf("Expected channel capacity %d, got %d", ChannelCapacity, cap(ch1))
	}
}

// TestWriteQueue_Enqueue tests enqueueing a write task
func TestWriteQueue_Enqueue(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Start workers
	q.StartWorkers()
	defer q.Stop()

	task := &WriteTask{
		ThreadID: "thread-1",
		ConvID:   "conv-1",
		Message: models.Message{
			From:      "agent-1",
			Content:   "Test message",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Enqueue should not block (channel has capacity)
	q.Enqueue(task)

	// Give workers time to process
	time.Sleep(100 * time.Millisecond)

	// Verify message was written
	messages, err := jsonl.ReadMessages("thread-1", "conv-1")
	if err != nil {
		t.Fatalf("ReadMessages failed: %v", err)
	}

	if len(messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(messages))
	}

	if messages[0].Content != "Test message" {
		t.Errorf("Expected 'Test message', got '%s'", messages[0].Content)
	}
}

func TestWriteQueue_EnqueueNonBlocking(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	task := &WriteTask{
		ThreadID: "thread-1",
		ConvID:   "conv-1",
		Message: models.Message{
			From:      "agent-1",
			Content:   "Non-blocking test",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Should succeed immediately
	ok := q.EnqueueNonBlocking(task)
	if !ok {
		t.Error("EnqueueNonBlocking failed unexpectedly")
	}
}

func TestWriteQueue_EnqueueNonBlocking_DropsWhenFull(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Fill the channel
	channel := q.getOrCreateChannel("thread-full")
	for i := 0; i < ChannelCapacity; i++ {
		select {
		case channel <- &WriteTask{ThreadID: "thread-full", ConvID: "conv-1"}:
		default:
		}
	}

	// Now non-blocking should fail
	task := &WriteTask{
		ThreadID: "thread-full",
		ConvID:   "conv-1",
		Message: models.Message{
			From:      "agent-1",
			Content:   "Should be dropped",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	ok := q.EnqueueNonBlocking(task)
	if ok {
		t.Error("EnqueueNonBlocking should have failed when channel is full")
	}
}

// TestWriteQueue_StartWorkers tests starting workers
func TestWriteQueue_StartWorkers(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Start workers
	q.StartWorkers()

	// Wait a bit for workers to be ready
	time.Sleep(50 * time.Millisecond)

	// Send some tasks
	for i := 0; i < 10; i++ {
		q.Enqueue(&WriteTask{
			ThreadID: "thread-1",
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Test message",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Give workers time to process
	time.Sleep(200 * time.Millisecond)

	// Verify all messages were written
	messages, _ := jsonl.ReadMessages("thread-1", "conv-1")
	if len(messages) != 10 {
		t.Errorf("Expected 10 messages, got %d", len(messages))
	}

	q.Stop()
}

// TestWriteQueue_Stop tests stopping the queue
func TestWriteQueue_Stop(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Start workers
	q.StartWorkers()

	// Enqueue some tasks
	for i := 0; i < 5; i++ {
		q.Enqueue(&WriteTask{
			ThreadID: "thread-stop",
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Stop test",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Stop should wait for workers
	q.Stop()

	// Verify messages were processed
	messages, _ := jsonl.ReadMessages("thread-stop", "conv-1")
	if len(messages) != 5 {
		t.Errorf("Expected 5 messages after stop, got %d", len(messages))
	}
}

// TestWriteQueue_WaitForDrain tests waiting for queue drain
func TestWriteQueue_WaitForDrain(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Start workers
	q.StartWorkers()

	// Enqueue some tasks
	for i := 0; i < 3; i++ {
		q.Enqueue(&WriteTask{
			ThreadID: "thread-drain",
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Drain test",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Wait for drain
	q.WaitForDrain()

	// Verify messages were processed
	messages, _ := jsonl.ReadMessages("thread-drain", "conv-1")
	if len(messages) != 3 {
		t.Errorf("Expected 3 messages after drain, got %d", len(messages))
	}

	q.Stop()
}

func TestWriteQueue_GetChannelStats(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// No channels yet
	stats := q.GetChannelStats()
	if len(stats) != 0 {
		t.Errorf("Expected 0 stats, got %d", len(stats))
	}

	// Create some channels
	q.getOrCreateChannel("thread-1")
	q.getOrCreateChannel("thread-2")
	q.getOrCreateChannel("thread-1") // Same channel

	stats = q.GetChannelStats()
	if len(stats) != 2 {
		t.Errorf("Expected 2 stats, got %d", len(stats))
	}
}

// TestWriteQueue_GetQueueLength tests getting queue length
func TestWriteQueue_GetQueueLength(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Start workers so tasks can be processed
	q.StartWorkers()
	defer q.Stop()

	// Initially empty
	length := q.GetQueueLength()
	if length != 0 {
		t.Errorf("Expected 0, got %d", length)
	}

	// Add tasks
	for i := 0; i < 5; i++ {
		q.Enqueue(&WriteTask{
			ThreadID: "thread-queue-len",
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Queue length test",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Wait for some processing
	time.Sleep(100 * time.Millisecond)

	// Length may be less than 5 due to processing
	length = q.GetQueueLength()
	if length < 0 || length > 5 {
		t.Errorf("Unexpected queue length: %d", length)
	}
}

func TestWriteQueue_RemoveChannel(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)

	// Create channels
	ch1 := q.getOrCreateChannel("thread-remove-1")
	ch2 := q.getOrCreateChannel("thread-remove-2")

	if ch1 == nil || ch2 == nil {
		t.Fatal("Failed to create channels")
	}

	// Remove one channel
	q.RemoveChannel("thread-remove-1")

	// Stats should only show one channel
	stats := q.GetChannelStats()
	if len(stats) != 1 {
		t.Errorf("Expected 1 stat, got %d", len(stats))
	}

	if _, exists := stats["thread-remove-1"]; exists {
		t.Error("thread-remove-1 should have been removed")
	}

	// Creating new channel should work
	ch3 := q.getOrCreateChannel("thread-remove-3")
	if ch3 == nil {
		t.Error("Failed to create new channel after removal")
	}
}

// TestWriteQueue_Concurrent tests concurrent queue operations
func TestWriteQueue_Concurrent(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)
	q.StartWorkers()
	defer q.Stop()

	var wg sync.WaitGroup
	numGoroutines := 10
	messagesPerGoroutine := 20

	// Concurrent enqueues
	for g := 0; g < numGoroutines; g++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			for i := 0; i < messagesPerGoroutine; i++ {
				q.Enqueue(&WriteTask{
					ThreadID: "thread-concurrent",
					ConvID:   "conv-1",
					Message: models.Message{
						From:      "agent-1",
						Content:   "Concurrent message",
						Timestamp: time.Now().Format(time.RFC3339),
					},
				})
			}
		}(g)
	}

	wg.Wait()

	// Wait for processing
	time.Sleep(500 * time.Millisecond)

	// Verify all messages were written
	messages, _ := jsonl.ReadMessages("thread-concurrent", "conv-1")
	expectedCount := numGoroutines * messagesPerGoroutine
	if len(messages) != expectedCount {
		t.Errorf("Expected %d messages, got %d", expectedCount, len(messages))
	}
}

// TestWriteQueue_ProcessTaskErrors tests error handling in processTask
func TestWriteQueue_ProcessTaskErrors(t *testing.T) {
	// Use an invalid path to trigger errors
	jsonl := db.NewJSONLManager("/nonexistent/path")

	q := NewWriteQueue(jsonl)
	q.StartWorkers()
	defer q.Stop()

	// Try to enqueue to invalid path (should not panic)
	q.Enqueue(&WriteTask{
		ThreadID: "thread-error",
		ConvID:   "conv-error",
		Message: models.Message{
			From:      "agent-1",
			Content:   "Error test",
			Timestamp: time.Now().Format(time.RFC3339),
		},
	})

	// Should not hang - error is logged but not propagated
	time.Sleep(100 * time.Millisecond)
}

// TestWriteQueue_PerThreadChannels tests per-thread channels
func TestWriteQueue_PerThreadChannels(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)
	q.StartWorkers()
	defer q.Stop()

	// Enqueue to different threads
	threads := []string{"thread-a", "thread-b", "thread-c"}
	for _, threadID := range threads {
		q.Enqueue(&WriteTask{
			ThreadID: threadID,
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Per-thread test",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Wait for processing
	time.Sleep(200 * time.Millisecond)

	// Verify each thread has messages
	for _, threadID := range threads {
		messages, err := jsonl.ReadMessages(threadID, "conv-1")
		if err != nil {
			t.Errorf("ReadMessages failed for %s: %v", threadID, err)
		}
		if len(messages) != 1 {
			t.Errorf("Expected 1 message for %s, got %d", threadID, len(messages))
		}
	}
}

// TestWriteQueue_MultipleMessagesPerThread tests multiple messages per thread
func TestWriteQueue_MultipleMessagesPerThread(t *testing.T) {
	jsonl, cleanup := setupTestJSONL(t)
	defer cleanup()

	q := NewWriteQueue(jsonl)
	q.StartWorkers()
	defer q.Stop()

	// Enqueue multiple messages to same thread
	for i := 0; i < 100; i++ {
		q.Enqueue(&WriteTask{
			ThreadID: "thread-multi",
			ConvID:   "conv-1",
			Message: models.Message{
				From:      "agent-1",
				Content:   "Message",
				Timestamp: time.Now().Format(time.RFC3339),
			},
		})
	}

	// Wait for processing
	time.Sleep(300 * time.Millisecond)

	// Verify all messages
	messages, _ := jsonl.ReadMessages("thread-multi", "conv-1")
	if len(messages) != 100 {
		t.Errorf("Expected 100 messages, got %d", len(messages))
	}

	// Verify message IDs are sequential
	for i, msg := range messages {
		if msg.ID != i+1 {
			t.Errorf("Expected message ID %d, got %d", i+1, msg.ID)
		}
	}
}
