import { db } from "./database";
import type { ActionLog } from "../modes/agent/types";

export interface Agent {
    id: string;
    name: string;
    description: string;
    instructions: string;
    created_at: string;
    updated_at: string;
}

export interface Conversation {
    id: string;
    agent_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export function createAgent(input: {
    name: string;
    description?: string;
    instructions?: string;
}): Agent {
    const now = new Date().toISOString();

    const agent: Agent = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? "",
        instructions: input.instructions ?? "",
        created_at: now,
        updated_at: now,
    };

    db.query(`
    INSERT INTO agents (
      id, name, description, instructions, created_at, updated_at
    )
    VALUES ($id, $name, $description, $instructions, $created_at, $updated_at)
  `).run({
        $id: agent.id,
        $name: agent.name,
        $description: agent.description,
        $instructions: agent.instructions,
        $created_at: agent.created_at,
        $updated_at: agent.updated_at,
    });

    return agent;

}



export function getAgent(id: string): Agent | null {
    const row = db.query(`
    SELECT id, name, description, instructions, created_at, updated_at
    FROM agents
    WHERE id = $id
  `).get({ $id: id }) as Agent | null;

    return row ?? null;
}

export function updateAgent(
  id: string,
  input: { name: string; description: string; instructions: string },
): Agent {
  const update = db.query(`
    UPDATE agents
    SET name = $name,
        description = $description,
        instructions = $instructions,
        updated_at = $updated_at
    WHERE id = $id
  `).run({
    $id: id,
    $name: input.name.trim(),
    $description: input.description.trim(),
    $instructions: input.instructions.trim(),
    $updated_at: new Date().toISOString(),
  });

  if (update.changes === 0) throw new Error(`Agent not found: ${id}`);
  return getAgent(id)!;
}

export function listAgents(): Agent[] {
    return db.query(`
    SELECT id, name, description, instructions, created_at, updated_at
    FROM agents
    ORDER BY created_at ASC
  `).all() as Agent[];
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
