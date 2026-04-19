package db

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/lechat/pkg/models"
	"golang.org/x/sys/unix"
)

// JSONLManager handles JSONL file operations for messages
type JSONLManager struct {
	messagesDir string
	flockMu     sync.Mutex
}

// NewJSONLManager creates a new JSONL manager
func NewJSONLManager(messagesDir string) *JSONLManager {
	return &JSONLManager{
		messagesDir: messagesDir,
	}
}

// getFilePath returns the JSONL file path for a thread
func (m *JSONLManager) getFilePath(threadID, convID string) string {
	return filepath.Join(m.messagesDir, convID, threadID+".jsonl")
}

// AppendMessage appends a message to the thread's JSONL file
func (m *JSONLManager) AppendMessage(threadID, convID string, msg *models.Message) error {
	filePath := m.getFilePath(threadID, convID)

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Acquire file lock
	f, err := os.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}

	// Lock the file for exclusive access
	m.flockMu.Lock()
	if err := unix.Flock(int(f.Fd()), unix.LOCK_EX); err != nil {
		f.Close()
		m.flockMu.Unlock()
		return fmt.Errorf("failed to lock file: %w", err)
	}

	// Get the next message ID inside the locked section
	// Pass lockHeld=true since we already hold flockMu
	nextID, err := m.GetLastMessageID(threadID, convID, true)
	if err != nil {
		unix.Flock(int(f.Fd()), unix.LOCK_UN)
		f.Close()
		m.flockMu.Unlock()
		return err
	}
	msg.ID = nextID + 1

	// Marshal the message
	data, err := json.Marshal(msg)
	if err != nil {
		unix.Flock(int(f.Fd()), unix.LOCK_UN)
		f.Close()
		m.flockMu.Unlock()
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Write the message
	if _, err := f.Write(append(data, '\n')); err != nil {
		unix.Flock(int(f.Fd()), unix.LOCK_UN)
		f.Close()
		m.flockMu.Unlock()
		return fmt.Errorf("failed to write message: %w", err)
	}

	// Unlock and close
	if err := unix.Flock(int(f.Fd()), unix.LOCK_UN); err != nil {
		f.Close()
		m.flockMu.Unlock()
		return fmt.Errorf("failed to unlock file: %w", err)
	}
	f.Close()
	m.flockMu.Unlock()

	return nil
}

// ReadMessages reads all messages from a thread's JSONL file
func (m *JSONLManager) ReadMessages(threadID, convID string) ([]*models.Message, error) {
	filePath := m.getFilePath(threadID, convID)

	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []*models.Message{}, nil
		}
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	// Lock the file for shared access
	m.flockMu.Lock()
	if err := unix.Flock(int(f.Fd()), unix.LOCK_SH); err != nil {
		f.Close()
		m.flockMu.Unlock()
		return nil, fmt.Errorf("failed to lock file: %w", err)
	}

	var messages []*models.Message
	decoder := json.NewDecoder(f)
	for decoder.More() {
		var msg models.Message
		if err := decoder.Decode(&msg); err != nil {
			unix.Flock(int(f.Fd()), unix.LOCK_UN)
			f.Close()
			m.flockMu.Unlock()
			return nil, fmt.Errorf("failed to decode message: %w", err)
		}
		messages = append(messages, &msg)
	}

	// Unlock
	if err := unix.Flock(int(f.Fd()), unix.LOCK_UN); err != nil {
		f.Close()
		m.flockMu.Unlock()
		return nil, fmt.Errorf("failed to unlock file: %w", err)
	}
	f.Close()
	m.flockMu.Unlock()

	return messages, nil
}

// GetLastMessageID returns the last message ID in the thread, or 0 if no messages.
// If lockHeld is true, the caller already holds flockMu and this method will not acquire it.
func (m *JSONLManager) GetLastMessageID(threadID, convID string, lockHeld bool) (int, error) {
	filePath := m.getFilePath(threadID, convID)

	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	// Lock the file for shared access only if not already locked
	flockAcquired := false
	if !lockHeld {
		m.flockMu.Lock()
		flockAcquired = true
		if err := unix.Flock(int(f.Fd()), unix.LOCK_SH); err != nil {
			f.Close()
			m.flockMu.Unlock()
			return 0, fmt.Errorf("failed to lock file: %w", err)
		}
	}

	var lastID int
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var msg models.Message
		if err := json.Unmarshal(line, &msg); err != nil {
			if flockAcquired {
				unix.Flock(int(f.Fd()), unix.LOCK_UN)
			}
			if flockAcquired {
				m.flockMu.Unlock()
			}
			return 0, fmt.Errorf("failed to unmarshal message: %w", err)
		}
		lastID = msg.ID
	}

	if err := scanner.Err(); err != nil {
		if flockAcquired {
			unix.Flock(int(f.Fd()), unix.LOCK_UN)
		}
		if flockAcquired {
			m.flockMu.Unlock()
		}
		return 0, fmt.Errorf("scanner error: %w", err)
	}

	// Unlock only if we acquired the lock
	if flockAcquired {
		if err := unix.Flock(int(f.Fd()), unix.LOCK_UN); err != nil {
			if flockAcquired {
				m.flockMu.Unlock()
			}
			return 0, fmt.Errorf("failed to unlock file: %w", err)
		}
		if flockAcquired {
			m.flockMu.Unlock()
		}
	}

	return lastID, nil
}

// GetMessage returns a specific message by ID from a thread's JSONL file
func (m *JSONLManager) GetMessage(threadID, convID string, messageID int) *models.Message {
	filePath := m.getFilePath(threadID, convID)

	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return nil
	}
	defer f.Close()

	// Lock the file for shared access
	m.flockMu.Lock()
	if err := unix.Flock(int(f.Fd()), unix.LOCK_SH); err != nil {
		f.Close()
		m.flockMu.Unlock()
		return nil
	}

	var foundMsg *models.Message
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var msg models.Message
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}
		if msg.ID == messageID {
			foundMsg = &msg
			break
		}
	}

	unix.Flock(int(f.Fd()), unix.LOCK_UN)
	f.Close()
	m.flockMu.Unlock()

	return foundMsg
}

// GetMessagesDir returns the messages directory path
func (m *JSONLManager) GetMessagesDir() string {
	return m.messagesDir
}
