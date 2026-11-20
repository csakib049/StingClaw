import {Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname,join } from "node:path";


const databasePath = join (homedir(),".stingclaw","stingclaw.sqlite");

mkdirSync(dirname(databasePath),{recursive:true});

export const db = new Database(databasePath,{
    create:true,
    strict:true,
});


db.run("PRAGMA foreign_keys = ON;");
db.run("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const agentColumns = db.query("PRAGMA table_info(agents)").all() as { name: string }[];
if (!agentColumns.some((column) => column.name === "model_id")) {
  db.run("ALTER TABLE agents ADD COLUMN model_id TEXT NOT NULL DEFAULT 'openrouter/free';");
}
if (!agentColumns.some((column) => column.name === "api_key_ids")) {
  db.run("ALTER TABLE agents ADD COLUMN api_key_ids TEXT NOT NULL DEFAULT '[]';");
}
if (!agentColumns.some((column) => column.name === "permissions_json")) {
  db.run("ALTER TABLE agents ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '{}';");
}

db.run(`
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider = 'openrouter'),
    label TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    last_four TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS provider_secrets (
    service TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    last_four TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL
      REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
    source TEXT NOT NULL CHECK (source IN ('web', 'telegram', 'cli')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL
      REFERENCES conversations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (
      status IN (
        'queued',
        'running',
        'waiting_approval',
        'completed',
        'failed',
        'cancelled'
      )
    ),
    goal TEXT NOT NULL,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Additive migration for databases created before background workers.
const taskColumns = db.query("PRAGMA table_info(tasks)").all() as { name: string }[];
if (!taskColumns.some((column) => column.name === "worker_pid")) {
  db.run("ALTER TABLE tasks ADD COLUMN worker_pid INTEGER;");
}
if (!taskColumns.some((column) => column.name === "workspace_path")) {
  db.run("ALTER TABLE tasks ADD COLUMN workspace_path TEXT NOT NULL DEFAULT ''; ");
}
if (!taskColumns.some((column) => column.name === "permission_override_json")) {
  db.run("ALTER TABLE tasks ADD COLUMN permission_override_json TEXT;");
}
if (!taskColumns.some((column) => column.name === "parent_task_id")) {
  db.run("ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;");
}

db.run(`
  CREATE TABLE IF NOT EXISTS task_actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    action_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    important INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
`);

const notificationColumns = db.query("PRAGMA table_info(notifications)").all() as { name: string }[];
if (!notificationColumns.some((column) => column.name === "telegram_sent_at")) {
  db.run("ALTER TABLE notifications ADD COLUMN telegram_sent_at TEXT;");
}

db.run(`
  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
    time_local TEXT NOT NULL,
    weekday INTEGER,
    timezone TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    permissions_json TEXT NOT NULL DEFAULT '{}',
    next_run_at TEXT NOT NULL,
    last_run_at TEXT,
    last_task_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS scheduled_job_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );
`);

