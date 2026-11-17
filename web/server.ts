import { join } from "node:path";
import { serve, type Server } from "bun";
import { ActionTracker } from "../modes/agent/action-tracker";
import { ToolExecutor } from "../modes/agent/tool-executer";
import { defaultAgentConfig } from "../modes/agent/types";
import { launchTaskWorker } from "../modes/agent/task-worker";
import {
  addTaskEvent,
  createAgent,
  createConversation,
  createMessage,
  createTask,
  getAgent,
  getConversation,
  getTask,
  listAgents,
  listConversations,
  listMessages,
  listTaskActions,
  listTaskEvents,
  listTasks,
  recordTaskApproval,
  retryTask,
  updateAgent,
  updateTaskStatus,
} from "../storage/repository";

const MAX_BODY_BYTES = 128 * 1024;
const PUBLIC_DIR = join(import.meta.dir, "public");
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("Request body is too large.");

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function isAllowedHost(request: Request, port: number): boolean {
  const hostHeader = request.headers.get("host");
  if (!hostHeader) return false;

  try {
    const host = new URL(`http://${hostHeader}`);
    const allowedName = host.hostname === "127.0.0.1" || host.hostname === "localhost";
    return allowedName && Number(host.port || 80) === port;
  } catch {
    return false;
  }
}

function isSafeMutation(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function staticResponse(pathname: string): Response | null {
  const item = STATIC_FILES[pathname];
  if (!item) return null;

  return new Response(Bun.file(join(PUBLIC_DIR, item.file)), {
    headers: {
      "Content-Type": item.type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

async function handleApi(request: Request, port: number): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (!isAllowedHost(request, port)) return error("Local requests only.", 403);
  if (method !== "GET" && !isSafeMutation(request)) {
    return error("Cross-site request rejected.", 403);
  }

  try {
    if (segments.length === 2 && segments[0] === "api" && segments[1] === "agents" && method === "GET") {
      let agents = listAgents();
      if (agents.length === 0) {
        createAgent({
          name: "Executive Assistant",
          description: "Your general-purpose StingClaw agent.",
          instructions: "",
        });
        agents = listAgents();
      }
      return json({ agents });
    }

    if (segments.length === 2 && segments[0] === "api" && segments[1] === "agents" && method === "POST") {
      const body = await readJson(request);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) return error("Name is required and must be under 80 characters.", 400);
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
      if (description.length > 1000 || instructions.length > 8000) {
        return error("Description or instructions are too long.", 400);
      }
      return json({ agent: createAgent({ name, description, instructions }) }, 201);
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "agents" && method === "PATCH") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      const body = await readJson(request);
      const name = typeof body.name === "string" ? body.name.trim() : agent.name;
      const description = typeof body.description === "string" ? body.description.trim() : agent.description;
      const instructions = typeof body.instructions === "string" ? body.instructions.trim() : agent.instructions;
      if (!name || name.length > 80 || description.length > 1000 || instructions.length > 8000) {
        return error("Agent settings are invalid or too long.", 400);
      }
      return json({ agent: updateAgent(segments[2]!, { name, description, instructions }) });
    }

    if (segments.length === 4 && segments[0] === "api" && segments[1] === "agents" && segments[3] === "conversations") {
      const agent = getAgent(segments[2]!);
      if (!agent) return error("Agent not found.", 404);
      if (method === "GET") return json({ conversations: listConversations(agent.id) });
      if (method === "POST") {
        const body = await readJson(request);
        const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
        return json({ conversation: createConversation(agent.id, title) }, 201);
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "conversations") {
      const conversation = getConversation(segments[2]!);
      if (!conversation) return error("Conversation not found.", 404);

      if (method === "GET") {
        return json({
          conversation,
          messages: listMessages(conversation.id),
          tasks: listTasks(conversation.id),
        });
      }

      if (method === "POST") {
        const body = await readJson(request);
        const content = typeof body.content === "string" ? body.content.trim() : "";
        if (!content || content.length > 20_000) {
          return error("Message is required and must be under 20,000 characters.", 400);
        }

        const active = listTasks(conversation.id).find((task) =>
          task.status === "queued" || task.status === "running" || task.status === "waiting_approval",
        );
        if (active) return error("This conversation already has an active task.", 409);

        const message = createMessage({
          conversationId: conversation.id,
          sender: "user",
          source: "web",
          content,
        });
        const task = createTask({
          agentId: conversation.agent_id,
          conversationId: conversation.id,
          goal: content,
          workspacePath: process.cwd(),
        });
        addTaskEvent({ taskId: task.id, eventType: "queued", message: "Task queued from the local web interface." });

        try {
          await launchTaskWorker(task.id);
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : String(cause);
          updateTaskStatus({ taskId: task.id, status: "failed", error: reason });
          addTaskEvent({ taskId: task.id, eventType: "failed", message: reason });
        }

        return json({ message, task: getTask(task.id) }, 202);
      }
    }

    if (segments.length === 3 && segments[0] === "api" && segments[1] === "tasks") {
      const task = getTask(segments[2]!);
      if (!task) return error("Task not found.", 404);

      if (method === "GET") {
        const actions = task.status === "waiting_approval"
          ? listTaskActions(task.id).filter((action) => action.status === "pending")
          : [];
        return json({ task, events: listTaskEvents(task.id), actions });
      }

      if (method === "POST" && segments[2] && segments.length === 3) {
        const body = await readJson(request);
        const action = body.action;

        if (action === "approve" || action === "reject") {
          if (task.status !== "waiting_approval") return error("Task is not waiting for approval.", 409);
          const tracker = new ActionTracker();
          tracker.restore(listTaskActions(task.id));
          const pending = tracker.getPendingMutations();
          if (pending.length === 0) return error("No pending operations to review.", 409);

          if (action === "reject") {
            for (const item of pending) tracker.updateStatus(item.id, "rejected", false);
            recordTaskApproval(task.id, tracker.getActions(), "completed", task.result, null);
            addTaskEvent({ taskId: task.id, eventType: "approval_rejected", message: "The proposed changes were rejected." });
            return json({ task: getTask(task.id) });
          }

          for (const item of pending) tracker.updateStatus(item.id, "approved", true);
          recordTaskApproval(task.id, tracker.getActions(), "running", task.result, process.pid);
          addTaskEvent({ taskId: task.id, eventType: "applying_approved_changes", message: "Applying approved changes from the web interface." });

          const config = defaultAgentConfig();
          config.codebasePath = task.workspace_path || process.cwd();
          const executor = new ToolExecutor(tracker, config);
          let result: ReturnType<ToolExecutor["applyApprovedFromTracker"]>;
          try {
            result = executor.applyApprovedFromTracker();
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : String(cause);
            updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
            return json({ task: getTask(task.id), error: message }, 500);
          } finally {
            executor.clearStaging();
          }

          if (result.failed.length) {
            const message = result.failed.map((item) => `${item.target}: ${item.error}`).join("\n");
            updateTaskStatus({ taskId: task.id, status: "failed", result: task.result, error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
          } else {
            updateTaskStatus({ taskId: task.id, status: "completed", result: task.result });
            addTaskEvent({
              taskId: task.id,
              eventType: "completed",
              message: `Approved operations applied: ${result.applied.join(", ") || "none"}.`,
            });
          }
          return json({ task: getTask(task.id), applied: result.applied, failed: result.failed });
        }

        if (action === "retry") {
          try {
            retryTask(task.id);
            addTaskEvent({ taskId: task.id, eventType: "retry_started", message: "Task queued for retry." });
            await launchTaskWorker(task.id);
            return json({ task: getTask(task.id) }, 202);
          } catch (cause) {
            return error(cause instanceof Error ? cause.message : String(cause), 409);
          }
        }

        if (action === "stop") {
          if (task.status === "queued") {
            updateTaskStatus({ taskId: task.id, status: "cancelled", error: "Stopped before the worker started." });
            addTaskEvent({ taskId: task.id, eventType: "cancelled", message: "Stopped before the worker started." });
            return json({ task: getTask(task.id) });
          }
          if (task.status !== "running" || !task.worker_pid) return error("Task cannot be stopped in its current state.", 409);
          try {
            process.kill(task.worker_pid, "SIGTERM");
            return json({ task: getTask(task.id) }, 202);
          } catch {
            const message = "Worker is no longer running. Retry the task if needed.";
            updateTaskStatus({ taskId: task.id, status: "failed", error: message });
            addTaskEvent({ taskId: task.id, eventType: "failed", message });
            return json({ task: getTask(task.id) });
          }
        }

        return error("Unknown task action.", 400);
      }
    }

    return error("Not found.", 404);
  } catch (cause) {
    if (cause instanceof SyntaxError || (cause instanceof Error && cause.message.includes("Request body"))) {
      return error(cause.message, 400);
    }
    console.error(cause);
    return error("The local server could not complete that request.", 500);
  }
}

export function startWebServer(port = Number(process.env.PORT ?? 3210)): Server<undefined> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid TCP port between 1 and 65535.");
  }

  const server = serve<undefined>({
    hostname: "127.0.0.1",
    port,
    fetch: async (request): Promise<Response> => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return handleApi(request, port);
      if (request.method !== "GET") return error("Method not allowed.", 405);
      if (!isAllowedHost(request, port)) return error("Local requests only.", 403);
      return staticResponse(url.pathname) ?? error("Not found.", 404);
    },
  });

  console.log(`StingClaw web interface: http://127.0.0.1:${server.port}`);
  console.log("Keep this process running while you use the local interface.");
  return server;
}
