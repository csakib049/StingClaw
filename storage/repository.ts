import { db } from "./database";
import type { ActionLog } from "../modes/agent/types";
import { defaultAgentPermissions, type AgentPermissions } from "../modes/agent/types";
import { decryptSecret, encryptSecret } from "./secret-store";

export interface Agent {
    id: string;
    name: string;
    description: string;
    instructions: string;
    model_id: string;
    api_key_ids: string[];
    permissions: AgentPermissions;
    created_at: string;
    updated_at: string;
}

export interface ApiKeyInfo {
    id: string;
    provider: "openrouter";
    label: string;
    last_four: string;
    created_at: string;
}

export interface ApiKeyCredential extends ApiKeyInfo {
    secret: string;
}

type AgentRow = Omit<Agent, "api_key_ids" | "permissions"> & {
    api_key_ids: string;
    permissions_json: string;
};

function mapAgent(row: AgentRow): Agent {
    let apiKeyIds: string[] = [];
    let permissions: Partial<AgentPermissions> = {};
    try { apiKeyIds = JSON.parse(row.api_key_ids) as string[]; } catch { /* use defaults */ }
    try { permissions = JSON.parse(row.permissions_json) as Partial<AgentPermissions>; } catch { /* use defaults */ }
    const { permissions_json: _permissionsJson, ...base } = row;
    return {
        ...base,
        api_key_ids: apiKeyIds,
        permissions: { ...defaultAgentPermissions(), ...permissions },
    };
}

export interface Conversation {
    id: string;
    agent_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  content: string;
  important: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  agent_id: string;
  task_id: string | null;
  conversation_id: string | null;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

const SECRET_LIKE_PATTERNS = [
  /(?:api[_ -]?key|password|passphrase|secret|access[_ -]?token|bearer)\s*[:=]\s*\S+/i,
  /\bsk-or-v1-[A-Za-z0-9_-]{16,}\b/i,
  /\b(?:ghp|github_pat|xox[baprs])-[A-Za-z0-9_-]{16,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function validateMemoryContent(content: string): string {
  const clean = content.trim();
  if (!clean || clean.length > 2000) throw new Error("Memory must be between 1 and 2,000 characters.");
  if (SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(clean))) {
    throw new Error("This looks like a secret or credential. StingClaw does not save it to memory.");
  }
  return clean;
}

export function listAgentMemories(agentId: string): AgentMemory[] {
  return db.query(`
    SELECT id, agent_id, content, important, created_at, updated_at
    FROM agent_memories
    WHERE agent_id = $agent_id
    ORDER BY important DESC, updated_at DESC
  `).all({ $agent_id: agentId }).map((row) => {
    const memory = row as Omit<AgentMemory, "important"> & { important: number };
    return { ...memory, important: Boolean(memory.important) };
  });
}

export function createAgentMemory(agentId: string, content: string, important = false): AgentMemory {
  if (!getAgent(agentId)) throw new Error("Agent not found.");
  const clean = validateMemoryContent(content);
  const now = new Date().toISOString();
  const memory = { id: crypto.randomUUID(), agent_id: agentId, content: clean, important, created_at: now, updated_at: now };
  db.query(`
    INSERT INTO agent_memories (id, agent_id, content, important, created_at, updated_at)
    VALUES ($id, $agent_id, $content, $important, $created_at, $updated_at)
  `).run({
    $id: memory.id, $agent_id: agentId, $content: clean,
    $important: important ? 1 : 0, $created_at: now, $updated_at: now,
  });
  return memory;
}

export function updateAgentMemory(
  agentId: string,
  memoryId: string,
  content: string,
  important: boolean,
): AgentMemory {
  const clean = validateMemoryContent(content);
  const updated = db.query(`
    UPDATE agent_memories
    SET content = $content, important = $important, updated_at = $updated_at
    WHERE id = $id AND agent_id = $agent_id
  `).run({
    $id: memoryId, $agent_id: agentId, $content: clean,
    $important: important ? 1 : 0, $updated_at: new Date().toISOString(),
  });
  if (updated.changes === 0) throw new Error("Memory not found for this agent.");
  return listAgentMemories(agentId).find((memory) => memory.id === memoryId)!;
}

export function deleteAgentMemory(agentId: string, memoryId: string): boolean {
  return db.query("DELETE FROM agent_memories WHERE id = $id AND agent_id = $agent_id")
    .run({ $id: memoryId, $agent_id: agentId }).changes > 0;
}

export function createTaskNotification(input: {
  taskId: string;
  type: "completed" | "failed" | "approval" | "cancelled";
  title: string;
  message: string;
}): AppNotification {
  const task = getTask(input.taskId);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);
  const notification: AppNotification = {
    id: crypto.randomUUID(), agent_id: task.agent_id, task_id: task.id,
    conversation_id: task.conversation_id, type: input.type,
    title: input.title, message: input.message,
    created_at: new Date().toISOString(), read_at: null,
  };
  db.query(`
    INSERT INTO notifications (id, agent_id, task_id, type, title, message, created_at, read_at)
    VALUES ($id, $agent_id, $task_id, $type, $title, $message, $created_at, NULL)
  `).run({
    $id: notification.id, $agent_id: notification.agent_id, $task_id: notification.task_id,
    $type: notification.type, $title: notification.title, $message: notification.message,
    $created_at: notification.created_at,
  });
  return notification;
}

export function listNotifications(limit = 50): AppNotification[] {
  return db.query(`
    SELECT n.id, n.agent_id, n.task_id, t.conversation_id, n.type, n.title, n.message, n.created_at, n.read_at
    FROM notifications n
    LEFT JOIN tasks t ON t.id = n.task_id
    ORDER BY n.created_at DESC
    LIMIT $limit
  `).all({ $limit: limit }) as AppNotification[];
}

export function countUnreadNotifications(): number {
  const row = db.query("SELECT COUNT(*) AS count FROM notifications WHERE read_at IS NULL").get() as { count: number };
  return row.count;
}

export function markNotificationRead(id: string): boolean {
  return db.query("UPDATE notifications SET read_at = COALESCE(read_at, $read_at) WHERE id = $id")
    .run({ $id: id, $read_at: new Date().toISOString() }).changes > 0;
}

export function markTaskNotificationsRead(taskId: string): number {
  return db.query("UPDATE notifications SET read_at = $read_at WHERE task_id = $task_id AND read_at IS NULL")
    .run({ $task_id: taskId, $read_at: new Date().toISOString() }).changes;
}

export function markAllNotificationsRead(): number {
  return db.query("UPDATE notifications SET read_at = $read_at WHERE read_at IS NULL")
    .run({ $read_at: new Date().toISOString() }).changes;
}

export function createAgent(input: {
    name: string;
    description?: string;
    instructions?: string;
    modelId?: string;
    apiKeyIds?: string[];
    permissions?: AgentPermissions;
}): Agent {
    const now = new Date().toISOString();

    const agent: Agent = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? "",
        instructions: input.instructions ?? "",
        model_id: input.modelId ?? process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/free",
        api_key_ids: input.apiKeyIds ?? [],
        permissions: input.permissions ?? defaultAgentPermissions(),
        created_at: now,
        updated_at: now,
    };

    db.query(`
    INSERT INTO agents (
      id, name, description, instructions, model_id, api_key_ids, permissions_json, created_at, updated_at
    )
    VALUES ($id, $name, $description, $instructions, $model_id, $api_key_ids, $permissions_json, $created_at, $updated_at)
  `).run({
        $id: agent.id,
        $name: agent.name,
        $description: agent.description,
        $instructions: agent.instructions,
        $model_id: agent.model_id,
        $api_key_ids: JSON.stringify(agent.api_key_ids),
        $permissions_json: JSON.stringify(agent.permissions),
        $created_at: agent.created_at,
        $updated_at: agent.updated_at,
    });

    return agent;

}



export function getAgent(id: string): Agent | null {
    const row = db.query(`
    SELECT id, name, description, instructions, model_id, api_key_ids, permissions_json, created_at, updated_at
    FROM agents
    WHERE id = $id
  `).get({ $id: id }) as AgentRow | null;

    return row ? mapAgent(row) : null;
}

export function updateAgent(
  id: string,
  input: {
    name: string;
    description: string;
    instructions: string;
    modelId?: string;
    apiKeyIds?: string[];
    permissions?: AgentPermissions;
  },
): Agent {
  const current = getAgent(id);
  if (!current) throw new Error(`Agent not found: ${id}`);
  const update = db.query(`
    UPDATE agents
    SET name = $name,
        description = $description,
        instructions = $instructions,
        model_id = $model_id,
        api_key_ids = $api_key_ids,
        permissions_json = $permissions_json,
        updated_at = $updated_at
    WHERE id = $id
  `).run({
    $id: id,
    $name: input.name.trim(),
    $description: input.description.trim(),
    $instructions: input.instructions.trim(),
    $model_id: input.modelId ?? current.model_id,
    $api_key_ids: JSON.stringify(input.apiKeyIds ?? current.api_key_ids),
    $permissions_json: JSON.stringify(input.permissions ?? current.permissions),
    $updated_at: new Date().toISOString(),
  });

  if (update.changes === 0) throw new Error(`Agent not found: ${id}`);
  return getAgent(id)!;
}

export function listAgents(): Agent[] {
    const rows = db.query(`
    SELECT id, name, description, instructions, model_id, api_key_ids, permissions_json, created_at, updated_at
    FROM agents
    ORDER BY created_at ASC
  `).all() as AgentRow[];
  return rows.map(mapAgent);
}

export function listApiKeys(): ApiKeyInfo[] {
  return db.query(`
    SELECT id, provider, label, last_four, created_at
    FROM api_keys
    ORDER BY created_at ASC
  `).all() as ApiKeyInfo[];
}

export function createApiKey(label: string, secret: string): ApiKeyInfo {
  const record: ApiKeyInfo = {
    id: crypto.randomUUID(),
    provider: "openrouter",
    label: label.trim(),
    last_four: secret.slice(-4),
    created_at: new Date().toISOString(),
  };
  const encryptedValue = encryptSecret(secret);
  db.query(`
    INSERT INTO api_keys (id, provider, label, encrypted_value, last_four, created_at)
    VALUES ($id, $provider, $label, $encrypted_value, $last_four, $created_at)
  `).run({
    $id: record.id,
    $provider: record.provider,
    $label: record.label,
    $encrypted_value: encryptedValue,
    $last_four: record.last_four,
    $created_at: record.created_at,
  });
  return record;
}

export function getApiKeyCredentials(ids?: readonly string[]): ApiKeyCredential[] {
  if (!ids?.length) return [];
  const find = db.query(`
    SELECT id, provider, label, last_four, created_at, encrypted_value
    FROM api_keys WHERE id = $id
  `);
  return ids.flatMap((id) => {
    const row = find.get({ $id: id }) as (ApiKeyInfo & { encrypted_value: string }) | null;
    return row ? [{
      id: row.id,
      provider: row.provider,
      label: row.label,
      last_four: row.last_four,
      created_at: row.created_at,
      secret: decryptSecret(row.encrypted_value),
    }] : [];
  });
}

export function deleteApiKey(id: string): boolean {
  const remove = db.transaction(() => {
    const agents = listAgents();
    for (const agent of agents) {
      if (!agent.api_key_ids.includes(id)) continue;
      updateAgent(agent.id, {
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        apiKeyIds: agent.api_key_ids.filter((keyId) => keyId !== id),
      });
    }
    return db.query("DELETE FROM api_keys WHERE id = $id").run({ $id: id }).changes > 0;
  });
  return remove();
}

export function createConversation(
    agentId: string,
    title = "",
): Conversation {
    if (!getAgent(agentId)) {
        throw new Error(`Agent not found: ${agentId}`);
    }

    const now = new Date().toISOString();

    const conversation: Conversation = {
        id: crypto.randomUUID(),
        agent_id: agentId,
        title,
        created_at: now,
        updated_at: now,
    };

    db.query(`
    INSERT INTO conversations (
      id, agent_id, title, created_at, updated_at
    )
    VALUES ($id, $agent_id, $title, $created_at, $updated_at)
  `).run({
        $id: conversation.id,
        $agent_id: conversation.agent_id,
        $title: conversation.title,
        $created_at: conversation.created_at,
        $updated_at: conversation.updated_at,
    });

    return conversation;
}

export function listConversations(agentId: string): Conversation[] {
    return db.query(`
    SELECT id, agent_id, title, created_at, updated_at
    FROM conversations
    WHERE agent_id = $agent_id
    ORDER BY updated_at DESC
  `).all({ $agent_id: agentId }) as Conversation[];
}

export function getConversation(id: string): Conversation | null {
  const row = db.query(`
    SELECT id, agent_id, title, created_at, updated_at
    FROM conversations
    WHERE id = $id
  `).get({ $id: id }) as Conversation | null;
  return row ?? null;
}



export type MessageSender = "user" | "agent" | "system";
export type MessageSource = "web" | "telegram" | "cli";

export interface Message {
    id: string;
    conversation_id: string;
    sender: MessageSender;
    source: MessageSource;
    content: string;
    created_at: string;
}


export function createMessage(input: {
    conversationId: string;
    sender: MessageSender;
    source: MessageSource;
    content: string;
}): Message {
    const message: Message = {
        id: crypto.randomUUID(),
        conversation_id: input.conversationId,
        sender: input.sender,
        source: input.source,
        content: input.content,
        created_at: new Date().toISOString(),
    };

    db.query(`
    INSERT INTO messages (
      id, conversation_id, sender, source, content, created_at
    )
    VALUES (
      $id, $conversation_id, $sender, $source, $content, $created_at
    )
  `).run({
        $id: message.id,
        $conversation_id: message.conversation_id,
        $sender: message.sender,
        $source: message.source,
        $content: message.content,
        $created_at: message.created_at,
    });

    db.query(`
    UPDATE conversations
    SET updated_at = $updated_at
    WHERE id = $conversation_id
  `).run({
        $updated_at: message.created_at,
        $conversation_id: message.conversation_id,
    });

    return message;

}


export function listMessages(conversationId: string): Message[] {
    return db.query(`
    SELECT id, conversation_id, sender, source, content, created_at
    FROM messages
    WHERE conversation_id = $conversation_id
    ORDER BY created_at ASC
  `).all({ $conversation_id: conversationId }) as Message[];
}


export type TaskStatus =
    | "queued"
    | "running"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "cancelled";


export interface Task {
    id: string;
    agent_id: string;
    conversation_id: string;
    status: TaskStatus;
    goal: string;
    result: string | null;
    error: string | null;
    created_at: string;
    updated_at: string;
    worker_pid: number | null;
    workspace_path: string;
}

export interface TaskEvent {
    id:string;
    task_id:string;
    event_type:string;
    message:string;
    created_at:string;
}

export function createTask(input: {
  agentId: string;
  conversationId: string;
  goal: string;
  workspacePath: string;
}): Task {
  const conversation = db.query(`
    SELECT id
    FROM conversations
    WHERE id = $conversation_id
      AND agent_id = $agent_id
  `).get({
    $conversation_id: input.conversationId,
    $agent_id: input.agentId,
  });


  if (!conversation) {
    throw new Error("Conversation not found for this agent.");
  }

  const now = new Date().toISOString();

  const task: Task = {
    id: crypto.randomUUID(),
    agent_id: input.agentId,
    conversation_id: input.conversationId,
    status: "queued",
    goal: input.goal,
    result: null,
    error: null,
    created_at: now,
    updated_at: now,
    worker_pid: null,
    workspace_path: input.workspacePath,
  };

  db.query(`
    INSERT INTO tasks (
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path
    )
    VALUES (
      $id, $agent_id, $conversation_id, $status, $goal,
      $result, $error, $created_at, $updated_at, $worker_pid, $workspace_path
    )
  `).run({
    $id: task.id,
    $agent_id: task.agent_id,
    $conversation_id: task.conversation_id,
    $status: task.status,
    $goal: task.goal,
    $result: task.result,
    $error: task.error,
    $created_at: task.created_at,
    $updated_at: task.updated_at,
    $worker_pid: task.worker_pid,
    $workspace_path: task.workspace_path,
  });

  return task;
}

export function getTask(taskId: string): Task | null {
  const task = db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path
    FROM tasks
    WHERE id = $id
  `).get({ $id: taskId }) as Task | null;

  return task ?? null;
}

export function listTasks(conversationId: string): Task[] {
  return db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path
    FROM tasks
    WHERE conversation_id = $conversation_id
    ORDER BY created_at DESC
  `).all({ $conversation_id: conversationId }) as Task[];
}

export function updateTaskStatus(input: {
  taskId: string;
  status: TaskStatus;
  result?: string | null;
  error?: string | null;
}): Task {
  const now = new Date().toISOString();

  const update = db.query(`
    UPDATE tasks
    SET status = $status,
        result = $result,
        error = $error,
        updated_at = $updated_at,
        worker_pid = NULL
    WHERE id = $id
  `).run({
    $id: input.taskId,
    $status: input.status,
    $result: input.result ?? null,
    $error: input.error ?? null,
    $updated_at: now,
  });

  if (update.changes === 0) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  return getTask(input.taskId)!;
}

export function addTaskEvent(input: {
  taskId: string;
  eventType: string;
  message: string;
}): TaskEvent {
  if (!getTask(input.taskId)) {
    throw new Error(`Task not found: ${input.taskId}`);
  }

  const event: TaskEvent = {
    id: crypto.randomUUID(),
    task_id: input.taskId,
    event_type: input.eventType,
    message: input.message,
    created_at: new Date().toISOString(),
  };

  db.query(`
    INSERT INTO task_events (
      id, task_id, event_type, message, created_at
    )
    VALUES (
      $id, $task_id, $event_type, $message, $created_at
    )
  `).run({
    $id: event.id,
    $task_id: event.task_id,
    $event_type: event.event_type,
    $message: event.message,
    $created_at: event.created_at,
  });

  return event;
}

export function listTaskEvents(taskId: string): TaskEvent[] {
  return db.query(`
    SELECT id, task_id, event_type, message, created_at
    FROM task_events
    WHERE task_id = $task_id
    ORDER BY created_at ASC
  `).all({ $task_id: taskId }) as TaskEvent[];
}

export function listRecentTasks(limit = 30): Task[] {
  return db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path
    FROM tasks
    ORDER BY created_at DESC
    LIMIT $limit
  `).all({ $limit: limit }) as Task[];
}

export function listActiveTasks(): Task[] {
  return db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path
    FROM tasks
    WHERE status IN ('queued', 'running')
    ORDER BY created_at ASC
  `).all() as Task[];
}

export function claimQueuedTask(taskId: string, workerPid: number): boolean {
  const result = db.query(`
    UPDATE tasks
    SET status = 'running', worker_pid = $worker_pid,
        updated_at = $updated_at
    WHERE id = $id AND status = 'queued'
  `).run({
    $id: taskId,
    $worker_pid: workerPid,
    $updated_at: new Date().toISOString(),
  });
  return result.changes === 1;
}

export function retryTask(taskId: string): Task {
  const queueRetry = db.transaction(() => {
    const update = db.query(`
      UPDATE tasks
      SET status = 'queued', result = NULL, error = NULL,
          worker_pid = NULL, updated_at = $updated_at
      WHERE id = $id AND status IN ('failed', 'cancelled')
    `).run({ $id: taskId, $updated_at: new Date().toISOString() });

    if (update.changes === 0) {
      throw new Error(`Task cannot be retried: ${taskId}`);
    }

    db.query("DELETE FROM task_actions WHERE task_id = $task_id")
      .run({ $task_id: taskId });
  });

  queueRetry();

  return getTask(taskId)!;
}

export function saveTaskActions(taskId: string, actions: readonly ActionLog[]): void {
  db.transaction(() => replaceTaskActions(taskId, actions))();
}

function replaceTaskActions(taskId: string, actions: readonly ActionLog[]): void {
  db.query("DELETE FROM task_actions WHERE task_id = $task_id")
    .run({ $task_id: taskId });

  const insert = db.query(`
    INSERT INTO task_actions (id, task_id, action_json, created_at)
    VALUES ($id, $task_id, $action_json, $created_at)
  `);

  for (const action of actions) {
    insert.run({
      $id: action.id,
      $task_id: taskId,
      $action_json: JSON.stringify(action),
      $created_at: action.timestamp.toISOString(),
    });
  }
}

export function recordTaskApproval(
  taskId: string,
  actions: readonly ActionLog[],
  status: "waiting_approval" | "running" | "completed",
  result: string | null,
  workerPid: number | null,
): void {
  db.transaction(() => {
    replaceTaskActions(taskId, actions);
    const update = db.query(`
      UPDATE tasks
      SET status = $status, result = $result, error = NULL,
          worker_pid = $worker_pid, updated_at = $updated_at
      WHERE id = $id AND status IN ('running', 'waiting_approval')
    `).run({
      $id: taskId,
      $status: status,
      $result: result,
      $worker_pid: workerPid,
      $updated_at: new Date().toISOString(),
    });

    if (update.changes !== 1) {
      throw new Error(`Task is no longer waiting for approval: ${taskId}`);
    }
  })();
}

export function listTaskActions(taskId: string): ActionLog[] {
  const rows = db.query(`
    SELECT action_json
    FROM task_actions
    WHERE task_id = $task_id
    ORDER BY created_at ASC
  `).all({ $task_id: taskId }) as { action_json: string }[];

  return rows.map(({ action_json }) => {
    const action = JSON.parse(action_json) as ActionLog;
    return { ...action, timestamp: new Date(action.timestamp) };
  });
}
