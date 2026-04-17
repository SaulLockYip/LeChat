package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	OpenclawDir string `json:"openclaw_dir"`
	LechatDir  string `json:"lechat_dir"`
	Port       int    `json:"port"`
}

func (c *Config) DBPath() string {
	return filepath.Join(c.LechatDir, "lechat.db")
}

func (c *Config) SocketPath() string {
	return filepath.Join(c.LechatDir, "socket.sock")
}

func (c *Config) MessagePath() string {
	return filepath.Join(c.LechatDir, "messages")
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

	return &cfg, nil
}

func GetDefaultConfigPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".lechat", "config.json"), nil
}

func GetConfig() (*Config, error) {
	configPath, err := GetDefaultConfigPath()
	if err != nil {
		return nil, err
	}
	return LoadConfig(configPath)
}
