import { db } from "./database";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ActionLog } from "../modes/agent/types";
import { defaultAgentPermissions, type AgentPermissions } from "../modes/agent/types";
import type { ScheduleFrequency } from "../modes/scheduler/time";
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

export function deleteAgent(agentId: string): boolean {
  return db.query("DELETE FROM agents WHERE id = $id").run({ $id: agentId }).changes > 0;
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

export function getProviderSecret(service: string): string | null {
  const row = db.query("SELECT encrypted_value FROM provider_secrets WHERE service = $service")
    .get({ $service: service }) as { encrypted_value: string } | null;
  return row ? decryptSecret(row.encrypted_value) : null;
}

export function getProviderSecretInfo(service: string): { configured: boolean; last_four: string | null; updated_at: string | null } {
  const row = db.query("SELECT last_four, updated_at FROM provider_secrets WHERE service = $service")
    .get({ $service: service }) as { last_four: string; updated_at: string } | null;
  return { configured: Boolean(row), last_four: row?.last_four ?? null, updated_at: row?.updated_at ?? null };
}

export function setProviderSecret(service: string, secret: string): ReturnType<typeof getProviderSecretInfo> {
  const now = new Date().toISOString();
  db.query(`
    INSERT INTO provider_secrets (service, encrypted_value, last_four, updated_at)
    VALUES ($service, $encrypted_value, $last_four, $updated_at)
    ON CONFLICT(service) DO UPDATE SET
      encrypted_value = excluded.encrypted_value,
      last_four = excluded.last_four,
      updated_at = excluded.updated_at
  `).run({
    $service: service,
    $encrypted_value: encryptSecret(secret),
    $last_four: secret.slice(-4),
    $updated_at: now,
  });
  return getProviderSecretInfo(service);
}

export function deleteProviderSecret(service: string): boolean {
  return db.query("DELETE FROM provider_secrets WHERE service = $service").run({ $service: service }).changes > 0;
}

export function getFirecrawlApiKey(): string | null {
  return getProviderSecret("firecrawl") ?? process.env.FIRECRAWL_API_KEY?.trim() ?? null;
}

export function getTelegramBotToken(): string | null {
  if (getAppSetting("telegram_disconnected") === "1") return null;
  return getProviderSecret("telegram_bot_token") ?? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? null;
}

export function getTelegramOwnerId(): string | null {
  if (getAppSetting("telegram_disconnected") === "1") return null;
  return getAppSetting("telegram_owner_id") ?? process.env.TELEGRAM_OWNER_ID?.trim() ?? null;
}

function getAppSetting(key: string): string | null {
  const row = db.query("SELECT setting_value FROM app_settings WHERE setting_key = $key")
    .get({ $key: key }) as { setting_value: string } | null;
  return row?.setting_value ?? null;
}

function setAppSetting(key: string, value: string): void {
  db.query(`
    INSERT INTO app_settings (setting_key, setting_value, updated_at)
    VALUES ($key, $value, $updated_at)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
  `).run({ $key: key, $value: value, $updated_at: new Date().toISOString() });
}

function deleteAppSetting(key: string): void {
  db.query("DELETE FROM app_settings WHERE setting_key = $key").run({ $key: key });
}

export function beginTelegramPairing(): { code: string; expiresAt: string } {
  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  setAppSetting("telegram_pair_hash", createHash("sha256").update(code).digest("hex"));
  setAppSetting("telegram_pair_expires_at", expiresAt);
  setAppSetting("telegram_owner_id", "");
  deleteAppSetting("telegram_disconnected");
  return { code, expiresAt };
}

export function claimTelegramOwner(userId: number, code: string): boolean {
  const claim = db.transaction(() => {
    if (getTelegramOwnerId()) return false;
    const storedHash = getAppSetting("telegram_pair_hash");
    const expiresAt = getAppSetting("telegram_pair_expires_at");
    if (!storedHash || !expiresAt || Date.parse(expiresAt) <= Date.now()) return false;
    const candidate = Buffer.from(createHash("sha256").update(code).digest("hex"), "hex");
    const expected = Buffer.from(storedHash, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return false;
    setAppSetting("telegram_owner_id", String(userId));
    deleteAppSetting("telegram_pair_hash");
    deleteAppSetting("telegram_pair_expires_at");
    deleteAppSetting("telegram_disconnected");
    return true;
  });
  return claim();
}

export function getTelegramPairingStatus(): { pending: boolean; expiresAt: string | null } {
  const expiresAt = getAppSetting("telegram_pair_expires_at");
  return { pending: Boolean(expiresAt && Date.parse(expiresAt) > Date.now() && !getTelegramOwnerId()), expiresAt };
}

export function getTelegramActiveAgentId(): string | null {
  return getAppSetting("telegram_active_agent_id");
}

export function setTelegramActiveAgentId(agentId: string): void {
  if (!getAgent(agentId)) throw new Error("Agent not found.");
  setAppSetting("telegram_active_agent_id", agentId);
}

export function disconnectTelegramSettings(): void {
  deleteProviderSecret("telegram_bot_token");
  deleteAppSetting("telegram_owner_id");
  deleteAppSetting("telegram_pair_hash");
  deleteAppSetting("telegram_pair_expires_at");
  setAppSetting("telegram_disconnected", "1");
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
    permission_override: AgentPermissions | null;
    parent_task_id: string | null;
}

type TaskRow = Omit<Task, "permission_override"> & { permission_override_json: string | null };

function mapTask(row: TaskRow): Task {
  let permissionOverride: AgentPermissions | null = null;
  if (row.permission_override_json) {
    try { permissionOverride = JSON.parse(row.permission_override_json) as AgentPermissions; } catch { /* use agent permissions */ }
  }
  const { permission_override_json: _permissionOverrideJson, ...task } = row;
  return { ...task, permission_override: permissionOverride };
}

export interface ScheduledJob {
  id: string;
  agent_id: string;
  conversation_id: string;
  name: string;
  prompt: string;
  frequency: ScheduleFrequency;
  time_local: string;
  weekday: number | null;
  timezone: string;
  enabled: boolean;
  permissions: AgentPermissions;
  next_run_at: string;
  last_run_at: string | null;
  last_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledJobRun {
  id: string;
  job_id: string;
  task_id: string | null;
  scheduled_at: string;
  status: string;
  error: string | null;
  created_at: string;
  task_goal: string | null;
  task_result: string | null;
}

export interface ScheduledNotification {
  id: string;
  task_id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  task_result: string | null;
  schedule_name: string;
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
  permissionOverride?: AgentPermissions;
  parentTaskId?: string;
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
    permission_override: input.permissionOverride ?? null,
    parent_task_id: input.parentTaskId ?? null,
  };

  db.query(`
    INSERT INTO tasks (
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path, permission_override_json, parent_task_id
    )
    VALUES (
      $id, $agent_id, $conversation_id, $status, $goal,
      $result, $error, $created_at, $updated_at, $worker_pid, $workspace_path, $permission_override_json, $parent_task_id
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
    $permission_override_json: task.permission_override ? JSON.stringify(task.permission_override) : null,
    $parent_task_id: task.parent_task_id,
  });

  return task;
}

export function getTask(taskId: string): Task | null {
  const task = db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path, permission_override_json, parent_task_id
    FROM tasks
    WHERE id = $id
  `).get({ $id: taskId }) as TaskRow | null;

  return task ? mapTask(task) : null;
}

export function listTasks(conversationId: string): Task[] {
  const rows = db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path, permission_override_json, parent_task_id
    FROM tasks
    WHERE conversation_id = $conversation_id
    ORDER BY created_at DESC
  `).all({ $conversation_id: conversationId }) as TaskRow[];
  return rows.map(mapTask);
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
  const rows = db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path, permission_override_json, parent_task_id
    FROM tasks
    ORDER BY created_at DESC
    LIMIT $limit
  `).all({ $limit: limit }) as TaskRow[];
  return rows.map(mapTask);
}

export function listActiveTasks(): Task[] {
  const rows = db.query(`
    SELECT
      id, agent_id, conversation_id, status, goal,
      result, error, created_at, updated_at, worker_pid, workspace_path, permission_override_json, parent_task_id
    FROM tasks
    WHERE status IN ('queued', 'running')
    ORDER BY created_at ASC
  `).all() as TaskRow[];
  return rows.map(mapTask);
}

export function countChildTasks(parentTaskId: string): number {
  const row = db.query("SELECT COUNT(*) AS count FROM tasks WHERE parent_task_id = $parent_task_id")
    .get({ $parent_task_id: parentTaskId }) as { count: number };
  return row.count;
}

export function listChildTasks(parentTaskId: string): (Task & { agent_name: string })[] {
  const rows = db.query(`
    SELECT t.id, t.agent_id, t.conversation_id, t.status, t.goal, t.result, t.error,
      t.created_at, t.updated_at, t.worker_pid, t.workspace_path,
      t.permission_override_json, t.parent_task_id, a.name AS agent_name
    FROM tasks t JOIN agents a ON a.id = t.agent_id
    WHERE t.parent_task_id = $parent_task_id
    ORDER BY t.created_at ASC
  `).all({ $parent_task_id: parentTaskId }) as (TaskRow & { agent_name: string })[];
  return rows.map((row) => ({ ...mapTask(row), agent_name: row.agent_name }));
}

type ScheduledJobRow = Omit<ScheduledJob, "enabled" | "permissions"> & {
  enabled: number;
  permissions_json: string;
};

function mapScheduledJob(row: ScheduledJobRow): ScheduledJob {
  let permissions: Partial<AgentPermissions> = {};
  try { permissions = JSON.parse(row.permissions_json) as Partial<AgentPermissions>; } catch { /* use safe defaults */ }
  const { permissions_json: _permissionsJson, ...values } = row;
  return { ...values, enabled: Boolean(row.enabled), permissions: { ...defaultAgentPermissions(), ...permissions } };
}

export function createScheduledJob(input: {
  agentId: string;
  conversationId: string;
  name: string;
  prompt: string;
  frequency: ScheduleFrequency;
  timeLocal: string;
  weekday: number | null;
  timezone: string;
  permissions: AgentPermissions;
  nextRunAt: string;
}): ScheduledJob {
  const conversation = db.query("SELECT id FROM conversations WHERE id = $id AND agent_id = $agent_id")
    .get({ $id: input.conversationId, $agent_id: input.agentId });
  if (!conversation) throw new Error("Conversation does not belong to this agent.");
  const now = new Date().toISOString();
  const job: ScheduledJob = {
    id: crypto.randomUUID(), agent_id: input.agentId, conversation_id: input.conversationId,
    name: input.name.trim(), prompt: input.prompt.trim(), frequency: input.frequency,
    time_local: input.timeLocal, weekday: input.weekday, timezone: input.timezone,
    enabled: true, permissions: input.permissions, next_run_at: input.nextRunAt,
    last_run_at: null, last_task_id: null, created_at: now, updated_at: now,
  };
  db.query(`
    INSERT INTO scheduled_jobs (
      id, agent_id, conversation_id, name, prompt, frequency, time_local, weekday,
      timezone, enabled, permissions_json, next_run_at, last_run_at, last_task_id, created_at, updated_at
    ) VALUES (
      $id, $agent_id, $conversation_id, $name, $prompt, $frequency, $time_local, $weekday,
      $timezone, 1, $permissions_json, $next_run_at, NULL, NULL, $created_at, $updated_at
    )
  `).run({
    $id: job.id, $agent_id: job.agent_id, $conversation_id: job.conversation_id,
    $name: job.name, $prompt: job.prompt, $frequency: job.frequency, $time_local: job.time_local,
    $weekday: job.weekday, $timezone: job.timezone, $permissions_json: JSON.stringify(job.permissions),
    $next_run_at: job.next_run_at, $created_at: now, $updated_at: now,
  });
  return job;
}

export function getScheduledJob(jobId: string): ScheduledJob | null {
  const row = db.query(`
    SELECT id, agent_id, conversation_id, name, prompt, frequency, time_local, weekday,
      timezone, enabled, permissions_json, next_run_at, last_run_at, last_task_id, created_at, updated_at
    FROM scheduled_jobs WHERE id = $id
  `).get({ $id: jobId }) as ScheduledJobRow | null;
  return row ? mapScheduledJob(row) : null;
}

export function listScheduledJobs(agentId: string): ScheduledJob[] {
  const rows = db.query(`
    SELECT id, agent_id, conversation_id, name, prompt, frequency, time_local, weekday,
      timezone, enabled, permissions_json, next_run_at, last_run_at, last_task_id, created_at, updated_at
    FROM scheduled_jobs WHERE agent_id = $agent_id
    ORDER BY enabled DESC, next_run_at ASC
  `).all({ $agent_id: agentId }) as ScheduledJobRow[];
  return rows.map(mapScheduledJob);
}

export function updateScheduledJob(input: {
  id: string;
  name: string;
  prompt: string;
  frequency: ScheduleFrequency;
  timeLocal: string;
  weekday: number | null;
  timezone: string;
  permissions: AgentPermissions;
  nextRunAt: string;
}): ScheduledJob {
  const updated = db.query(`
    UPDATE scheduled_jobs
    SET name = $name, prompt = $prompt, frequency = $frequency,
      time_local = $time_local, weekday = $weekday, timezone = $timezone,
      permissions_json = $permissions_json, next_run_at = $next_run_at, updated_at = $updated_at
    WHERE id = $id
  `).run({
    $id: input.id, $name: input.name.trim(), $prompt: input.prompt.trim(),
    $frequency: input.frequency, $time_local: input.timeLocal, $weekday: input.weekday,
    $timezone: input.timezone, $permissions_json: JSON.stringify(input.permissions),
    $next_run_at: input.nextRunAt, $updated_at: new Date().toISOString(),
  });
  if (!updated.changes) throw new Error("Scheduled job not found.");
  return getScheduledJob(input.id)!;
}

export function setScheduledJobEnabled(jobId: string, enabled: boolean, nextRunAt: string | null): ScheduledJob {
  const updated = db.query(`
    UPDATE scheduled_jobs
    SET enabled = $enabled,
        next_run_at = CASE WHEN $enabled = 1 THEN $next_run_at ELSE next_run_at END,
        updated_at = $updated_at
    WHERE id = $id
  `).run({
    $id: jobId, $enabled: enabled ? 1 : 0, $next_run_at: nextRunAt,
    $updated_at: new Date().toISOString(),
  });
  if (!updated.changes) throw new Error("Scheduled job not found.");
  return getScheduledJob(jobId)!;
}

export function deleteScheduledJob(jobId: string): boolean {
  return db.query("DELETE FROM scheduled_jobs WHERE id = $id").run({ $id: jobId }).changes > 0;
}

export function listDueScheduledJobs(now: string): ScheduledJob[] {
  const rows = db.query(`
    SELECT id, agent_id, conversation_id, name, prompt, frequency, time_local, weekday,
      timezone, enabled, permissions_json, next_run_at, last_run_at, last_task_id, created_at, updated_at
    FROM scheduled_jobs WHERE enabled = 1 AND next_run_at <= $now
    ORDER BY next_run_at ASC
  `).all({ $now: now }) as ScheduledJobRow[];
  return rows.map(mapScheduledJob);
}

export function skipMissedScheduledRun(jobId: string, now: string, nextRunAt: string): boolean {
  const operation = db.transaction(() => {
    const job = getScheduledJob(jobId);
    if (!job || !job.enabled || job.next_run_at > now) return false;
    const update = db.query(`
      UPDATE scheduled_jobs
      SET next_run_at = $next_run_at, last_run_at = $now, updated_at = $now
      WHERE id = $id AND enabled = 1 AND next_run_at = $previous_run
    `).run({ $id: jobId, $next_run_at: nextRunAt, $now: now, $previous_run: job.next_run_at });
    if (!update.changes) return false;
    db.query(`
      INSERT INTO scheduled_job_runs (id, job_id, task_id, scheduled_at, status, error, created_at)
      VALUES ($id, $job_id, NULL, $scheduled_at, 'missed', NULL, $created_at)
    `).run({ $id: crypto.randomUUID(), $job_id: jobId, $scheduled_at: job.next_run_at, $created_at: now });
    return true;
  });
  return operation();
}

export function claimScheduledJobRun(jobId: string, now: string, nextRunAt: string): { job: ScheduledJob; task: Task } | null {
  const operation = db.transaction(() => {
    const job = getScheduledJob(jobId);
    if (!job || !job.enabled || job.next_run_at > now) return null;
    const update = db.query(`
      UPDATE scheduled_jobs
      SET next_run_at = $next_run_at, last_run_at = $now, updated_at = $now
      WHERE id = $id AND enabled = 1 AND next_run_at = $previous_run
    `).run({ $id: jobId, $next_run_at: nextRunAt, $now: now, $previous_run: job.next_run_at });
    if (!update.changes) return null;

    const activeTask = db.query(`
      SELECT id FROM tasks
      WHERE conversation_id = $conversation_id
        AND status IN ('queued', 'running', 'waiting_approval')
      LIMIT 1
    `).get({ $conversation_id: job.conversation_id });
    if (activeTask) {
      db.query(`
        INSERT INTO scheduled_job_runs (id, job_id, task_id, scheduled_at, status, error, created_at)
        VALUES ($id, $job_id, NULL, $scheduled_at, 'skipped_busy', 'The previous run is still active.', $created_at)
      `).run({ $id: crypto.randomUUID(), $job_id: job.id, $scheduled_at: job.next_run_at, $created_at: now });
      return null;
    }

    const goal = `Scheduled job: ${job.name}\n\n${job.prompt}`;
    createMessage({ conversationId: job.conversation_id, sender: "user", source: "cli", content: goal });
    const task = createTask({
      agentId: job.agent_id,
      conversationId: job.conversation_id,
      goal,
      workspacePath: process.cwd(),
      permissionOverride: job.permissions,
    });
    db.query("UPDATE scheduled_jobs SET last_task_id = $task_id WHERE id = $id")
      .run({ $task_id: task.id, $id: job.id });
    addTaskEvent({ taskId: task.id, eventType: "queued", message: `Started by schedule “${job.name}”.` });
    db.query(`
      INSERT INTO scheduled_job_runs (id, job_id, task_id, scheduled_at, status, error, created_at)
      VALUES ($id, $job_id, $task_id, $scheduled_at, 'queued', NULL, $created_at)
    `).run({
      $id: crypto.randomUUID(), $job_id: job.id, $task_id: task.id,
      $scheduled_at: job.next_run_at, $created_at: now,
    });
    return { job, task };
  });
  return operation();
}

export function markScheduledRunStartFailed(taskId: string, message: string): void {
  db.query("UPDATE scheduled_job_runs SET status = 'failed_to_start', error = $error WHERE task_id = $task_id")
    .run({ $task_id: taskId, $error: message });
}

export function listScheduledJobRuns(jobId: string, limit = 20): ScheduledJobRun[] {
  return db.query(`
    SELECT r.id, r.job_id, r.task_id, r.scheduled_at,
      CASE WHEN t.id IS NULL THEN r.status ELSE t.status END AS status,
      COALESCE(t.error, r.error) AS error, r.created_at,
      t.goal AS task_goal, t.result AS task_result
    FROM scheduled_job_runs r
    LEFT JOIN tasks t ON t.id = r.task_id
    WHERE r.job_id = $job_id
    ORDER BY r.scheduled_at DESC
    LIMIT $limit
  `).all({ $job_id: jobId, $limit: limit }) as ScheduledJobRun[];
}

export function listPendingScheduledNotifications(limit = 30): ScheduledNotification[] {
  return db.query(`
    SELECT n.id, n.task_id, n.type, n.title, n.message, n.created_at,
      t.result AS task_result, j.name AS schedule_name
    FROM notifications n
    JOIN scheduled_job_runs r ON r.task_id = n.task_id
    JOIN scheduled_jobs j ON j.id = r.job_id
    JOIN tasks t ON t.id = n.task_id
    WHERE n.telegram_sent_at IS NULL AND n.read_at IS NULL
    ORDER BY n.created_at ASC
    LIMIT $limit
  `).all({ $limit: limit }) as ScheduledNotification[];
}

export function markScheduledNotificationTelegramSent(id: string): void {
  db.query("UPDATE notifications SET telegram_sent_at = $sent_at WHERE id = $id AND telegram_sent_at IS NULL")
    .run({ $id: id, $sent_at: new Date().toISOString() });
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
