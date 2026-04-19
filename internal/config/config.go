package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	LeChatDir string `json:"lechat_dir"`
	DBPath    string `json:"db_path"`
	SocketPath string `json:"socket_path"`
	HTTPPort  string `json:"http_port"`
	User      UserConfig `json:"user"`
}

type UserConfig struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Title string `json:"title"`
	Token string `json:"token"`
}

func LoadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	// Set defaults if not specified
	if cfg.LeChatDir == "" {
		// Default to ~/.lechat
		home, err := os.UserHomeDir()
		if err != nil {
			home = "/tmp"
		}
		cfg.LeChatDir = filepath.Join(home, ".lechat")
	}

	if cfg.DBPath == "" {
		cfg.DBPath = filepath.Join(cfg.LeChatDir, "lechat.db")
	}

	if cfg.SocketPath == "" {
		cfg.SocketPath = filepath.Join(cfg.LeChatDir, "socket.sock")
	}

	if cfg.HTTPPort == "" {
		cfg.HTTPPort = "8080"
	}

	return &cfg, nil
}

// GetMessagesDir returns the directory for JSONL message files
func (c *Config) GetMessagesDir() string {
	return filepath.Join(c.LeChatDir, "messages")
}

// EnsureDirectories creates necessary directories
func (c *Config) EnsureDirectories() error {
	dirs := []string{
		c.LeChatDir,
		c.GetMessagesDir(),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	return nil
}
