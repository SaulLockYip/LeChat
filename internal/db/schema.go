package db

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS agent (
    id TEXT PRIMARY KEY,
    openclaw_agent_id TEXT NOT NULL,
    openclaw_workspace TEXT NOT NULL,
    openclaw_agent_dir TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('dm', 'group')),
    agent_ids TEXT NOT NULL,
    thread_ids TEXT NOT NULL DEFAULT '[]',
    group_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
        (type = 'group' AND group_name IS NOT NULL) OR
        (type = 'dm' AND group_name IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS thread (
    id TEXT PRIMARY KEY,
    conv_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    openclaw_sessions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (conv_id) REFERENCES conversation(id)
);

CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    from_lechat_agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT,
    quoted_message_id INTEGER,
    mention TEXT DEFAULT '[]',
    timestamp TEXT NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES thread(id)
);

CREATE INDEX IF NOT EXISTS idx_thread_conv_id ON thread(conv_id);
CREATE INDEX IF NOT EXISTS idx_thread_status ON thread(status);
CREATE INDEX IF NOT EXISTS idx_message_thread_id ON message(thread_id);
`

// InitDB initializes the database connection and creates tables
func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, err
	}

	return db, nil
}
