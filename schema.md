# LeChat Schema Design

## 字段命名规范

- **lechat_agent_id**: LeChat 内部生成的唯一标识（agent.id）
- **openclaw_agent_id**: OpenClaw 中的 agent ID

## Agent Table

```sql
CREATE TABLE agent (
    id                        TEXT PRIMARY KEY,  -- lechat_agent_id
    openclaw_agent_id         TEXT NOT NULL,
    openclaw_agent_workspace TEXT NOT NULL,
    openclaw_agent_dir        TEXT NOT NULL,
    lechat_agent_token        TEXT NOT NULL
);
```

## Conversation Table

```sql
CREATE TABLE conversation (
    id                  TEXT PRIMARY KEY,
    type                TEXT NOT NULL DEFAULT 'dm' CHECK (type IN ('dm', 'group')),
    lechat_agent_ids    TEXT NOT NULL,      -- JSON array of lechat_agent_id
    thread_ids          TEXT NOT NULL,       -- JSON array of thread id
    group_name          TEXT,                -- only for type='group', must be NOT NULL when type='group'
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    CHECK ((type = 'dm' AND group_name IS NULL) OR (type = 'group' AND group_name IS NOT NULL AND group_name != ''))
);
```

## Thread Table

```sql
CREATE TABLE thread (
    id                TEXT PRIMARY KEY,
    conv_id           TEXT NOT NULL,
    topic             TEXT,
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    openclaw_sessions TEXT NOT NULL DEFAULT '[]',  -- JSON array of {lechat_agent_id, openclaw_agent_id, openclaw_session_id}
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);
```

## Indexes

```sql
-- Index for conversation lookup by lechat_agent_ids (JSON array search)
CREATE INDEX idx_conversation_lechat_agent_ids ON conversation(lechat_agent_ids);

-- Index for thread lookup by conversation
CREATE INDEX idx_thread_conv_id ON thread(conv_id);

-- Index for thread ordering by update time
CREATE INDEX idx_thread_updated_at ON thread(updated_at);
```

`sessions` 字段示例：
```json
[
  {"lechat_agent_id": "lechat_001", "openclaw_agent_id": "agent_001", "openclaw_session_id": "sess_xxx"},
  {"lechat_agent_id": "lechat_002", "openclaw_agent_id": "agent_002", "openclaw_session_id": "sess_yyy"}
]
```

