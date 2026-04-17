package queue

import (
	"log"
	"sync"

	"github.com/lechat/internal/db"
	"github.com/lechat/pkg/models"
)

const (
	// WorkerPoolSize is the number of workers in the pool
	WorkerPoolSize = 5
	// ChannelCapacity is the capacity per thread channel
	ChannelCapacity = 50000
)

// WriteTask represents a message write task
type WriteTask struct {
	ThreadID string
	ConvID   string
	Message  models.Message
}

// WriteQueue manages per-thread write channels and worker pool
type WriteQueue struct {
	jsonl *db.JSONLManager

	// Per-thread channels
	threadChannels map[string]chan *WriteTask
	channelsMu    sync.RWMutex

	// Merged channel for all tasks
	taskCh chan *WriteTask

	// Worker control
	wg        sync.WaitGroup
	stopCh    chan struct{}
	stoppedCh chan struct{}
}

// NewWriteQueue creates a new write queue
func NewWriteQueue(jsonl *db.JSONLManager) *WriteQueue {
	return &WriteQueue{
		jsonl:         jsonl,
		threadChannels: make(map[string]chan *WriteTask),
		taskCh:        make(chan *WriteTask, ChannelCapacity*10), // Buffer for merged tasks
		stopCh:        make(chan struct{}),
		stoppedCh:     make(chan struct{}),
	}
}

// getOrCreateChannel gets or creates a channel for a thread
func (q *WriteQueue) getOrCreateChannel(threadID string) chan *WriteTask {
	q.channelsMu.Lock()
	defer q.channelsMu.Unlock()

	ch, exists := q.threadChannels[threadID]
	if !exists {
		ch = make(chan *WriteTask, ChannelCapacity)
		q.threadChannels[threadID] = ch
	}
	return ch
}

// Enqueue adds a write task to the queue (blocking)
func (q *WriteQueue) Enqueue(task *WriteTask) {
	ch := q.getOrCreateChannel(task.ThreadID)

	// Blocking send - will block if channel is full
	ch <- task

	// Also send to merged channel for workers to pick up
	select {
	case q.taskCh <- task:
	default:
		// If merged channel is full, worker will get from thread channel directly
	}
}

// EnqueueNonBlocking adds a write task to the queue (non-blocking, drops if full)
func (q *WriteQueue) EnqueueNonBlocking(task *WriteTask) bool {
	ch := q.getOrCreateChannel(task.ThreadID)

	select {
	case ch <- task:
		return true
	default:
		return false
	}
}

// StartWorkers starts the worker pool
func (q *WriteQueue) StartWorkers() {
	for i := 0; i < WorkerPoolSize; i++ {
		q.wg.Add(1)
		go q.worker(i)
	}
}

// worker processes write tasks from the merged channel
func (q *WriteQueue) worker(id int) {
	defer q.wg.Done()

	for {
		select {
		case <-q.stopCh:
			q.drainRemaining()
			return
		case task := <-q.taskCh:
			q.processTask(task)
		}
	}
}

// drainRemaining drains any remaining tasks after stop signal
func (q *WriteQueue) drainRemaining() {
	for {
		select {
		case task := <-q.taskCh:
			q.processTask(task)
		default:
			return
		}
	}
}

// processTask writes a message to JSONL
func (q *WriteQueue) processTask(task *WriteTask) {
	if err := q.jsonl.AppendMessage(task.ThreadID, task.ConvID, &task.Message); err != nil {
		log.Printf("Error writing message to JSONL: %v", err)
	}
}

// Stop gracefully stops the worker pool
func (q *WriteQueue) Stop() {
	close(q.stopCh)
	q.wg.Wait()
	close(q.stoppedCh)
}

// WaitForDrain waits for all tasks to be processed
func (q *WriteQueue) WaitForDrain() {
	q.wg.Wait()
}

// GetChannelStats returns statistics about the queue
func (q *WriteQueue) GetChannelStats() map[string]int {
	q.channelsMu.RLock()
	defer q.channelsMu.RUnlock()

	stats := make(map[string]int)
	for threadID, ch := range q.threadChannels {
		stats[threadID] = len(ch)
	}
	return stats
}

// GetQueueLength returns the total tasks in queue
func (q *WriteQueue) GetQueueLength() int {
	return len(q.taskCh)
}

// RemoveChannel removes a channel for a thread
func (q *WriteQueue) RemoveChannel(threadID string) {
	q.channelsMu.Lock()
	defer q.channelsMu.Unlock()

	if ch, exists := q.threadChannels[threadID]; exists {
		close(ch)
		delete(q.threadChannels, threadID)
	}
}
