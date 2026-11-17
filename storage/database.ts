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

db.run(`
  CREATE TABLE IF NOT EXISTS task_actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    action_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

