const state = {
  agents: [],
  activeAgent: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  tasks: [],
  polling: null,
  toastTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const agentList = $("#agent-list");
const conversationList = $("#conversation-list");
const messageList = $("#message-list");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.add("hidden"), 3200);
}

function initials(name = "Agent") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function makeAvatar(name, sizeClass = "") {
  const avatar = document.createElement("div");
  avatar.className = `avatar ${sizeClass}`.trim();
  avatar.textContent = initials(name);
  return avatar;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function shortText(value, max = 54) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function renderAgents(filter = "") {
  const query = filter.trim().toLowerCase();
  const shown = state.agents.filter((agent) =>
    `${agent.name} ${agent.description}`.toLowerCase().includes(query),
  );
  $("#agent-count").textContent = String(state.agents.length);
  agentList.replaceChildren();

  for (const agent of shown) {
    const button = document.createElement("button");
    button.className = `agent-card${agent.id === state.activeAgent?.id ? " selected" : ""}`;
    button.type = "button";
    button.append(makeAvatar(agent.name));

    const details = document.createElement("span");
    details.className = "agent-card-copy";
    const title = document.createElement("strong");
    title.textContent = agent.name;
    const subtitle = document.createElement("span");
    subtitle.textContent = shortText(agent.description || "Ready when you are", 40);
    details.append(title, subtitle);
    button.append(details);
    button.addEventListener("click", () => selectAgent(agent.id));
    agentList.append(button);
  }

  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-sidebar-copy";
    empty.textContent = query ? "No matching agents" : "Create your first agent";
    agentList.append(empty);
  }
}

function renderConversations() {
  conversationList.replaceChildren();
  for (const conversation of state.conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-card${conversation.id === state.activeConversation?.id ? " selected" : ""}`;
    button.textContent = conversation.title || "New chat";
    button.title = conversation.title || "New chat";
    button.addEventListener("click", () => selectConversation(conversation.id));
    conversationList.append(button);
  }
  if (state.conversations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-sidebar-copy";
    empty.textContent = "No conversations yet";
    conversationList.append(empty);
  }
}

function renderHeader() {
  if (!state.activeAgent) return;
  $("#header-avatar").textContent = initials(state.activeAgent.name);
  $("#settings-avatar").textContent = initials(state.activeAgent.name);
  $("#active-agent-name").textContent = state.activeAgent.name;
  $("#active-agent-description").textContent = state.activeAgent.description || "Your local AI agent";
  $("#settings-name").value = state.activeAgent.name;
  $("#settings-description").value = state.activeAgent.description || "";
  $("#settings-instructions").value = state.activeAgent.instructions || "";
}

function renderMessages() {
  messageList.replaceChildren();
  const welcome = $("#welcome-panel");
  welcome.classList.toggle("hidden", state.messages.length > 0);

  for (const message of state.messages) {
    const row = document.createElement("article");
    row.className = `message-row ${message.sender === "user" ? "from-user" : "from-agent"}`;
    if (message.sender !== "user") row.append(makeAvatar(state.activeAgent?.name ?? "Agent"));

    const content = document.createElement("div");
    content.className = "message-content";
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const sender = document.createElement("span");
    sender.textContent = message.sender === "user" ? "You" : state.activeAgent?.name ?? "Agent";
    const time = document.createElement("time");
    time.textContent = formatTime(message.created_at);
    meta.append(sender, time);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.content;
    content.append(meta, bubble);
    row.append(content);
    messageList.append(row);
  }

  messageList.scrollTop = messageList.scrollHeight;
}

function statusLabel(status) {
  return ({
    queued: "Queued",
    running: "Working",
    waiting_approval: "Needs your review",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Stopped",
  })[status] || status;
}

function renderTasks() {
  const area = $("#task-area");
  area.replaceChildren();
  const active = state.tasks.filter((task) => ["queued", "running", "waiting_approval", "failed"].includes(task.status));
  const recent = active.length ? active.slice(0, 3) : state.tasks.slice(0, 1);

  const statusBadge = $("#active-task-status");
  const current = recent[0];
  statusBadge.className = current ? `task-status-badge status-${current.status}` : "task-status-badge hidden";
  statusBadge.textContent = current ? statusLabel(current.status) : "";

  for (const task of recent) {
    const card = document.createElement("article");
    card.className = `task-card task-${task.status}`;

    const top = document.createElement("div");
    top.className = "task-card-top";
    const marker = document.createElement("span");
    marker.className = `task-marker marker-${task.status}`;
    marker.textContent = task.status === "completed" ? "✓" : task.status === "failed" ? "!" : task.status === "waiting_approval" ? "⌑" : "•";
    const heading = document.createElement("div");
    heading.className = "task-card-heading";
    const title = document.createElement("strong");
    title.textContent = statusLabel(task.status);
    const goal = document.createElement("span");
    goal.textContent = shortText(task.goal, 100);
    heading.append(title, goal);
    top.append(marker, heading);
    card.append(top);

    if (task.error) {
      const errorText = document.createElement("p");
      errorText.className = "task-error";
      errorText.textContent = task.error;
      card.append(errorText);
    }

    const buttons = document.createElement("div");
    buttons.className = "task-buttons";
    if (task.status === "waiting_approval") {
      const review = document.createElement("button");
      review.type = "button";
      review.className = "save-button compact-button";
      review.textContent = "Review changes";
      review.addEventListener("click", () => openApproval(task.id));
      buttons.append(review);
    } else if (task.status === "running" || task.status === "queued") {
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "quiet-button compact-button";
      stop.textContent = "Stop task";
      stop.addEventListener("click", () => taskAction(task.id, "stop"));
      buttons.append(stop);
    } else if (task.status === "failed" || task.status === "cancelled") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "quiet-button compact-button";
      retry.textContent = "Retry task";
      retry.addEventListener("click", () => taskAction(task.id, "retry"));
      buttons.append(retry);
    }

    const detail = document.createElement("button");
    detail.type = "button";
    detail.className = "text-button task-detail-button";
    detail.textContent = "Details";
    detail.addEventListener("click", () => openTaskDetails(task.id));
    buttons.append(detail);
    card.append(buttons);
    area.append(card);
  }
}

async function loadAgents() {
  const data = await api("/api/agents");
  state.agents = data.agents;
  if (!state.activeAgent || !state.agents.some((agent) => agent.id === state.activeAgent.id)) {
    state.activeAgent = state.agents[0] ?? null;
  }
  renderAgents($("#agent-search").value);
  if (state.activeAgent) await loadAgentWorkspace(state.activeAgent.id);
}

async function loadAgentWorkspace(agentId) {
  state.activeAgent = state.agents.find((agent) => agent.id === agentId) ?? null;
  if (!state.activeAgent) return;
  renderAgents($("#agent-search").value);
  renderHeader();

  const data = await api(`/api/agents/${encodeURIComponent(agentId)}/conversations`);
  state.conversations = data.conversations;
  renderConversations();

  if (!state.conversations.length) {
    const created = await api(`/api/agents/${encodeURIComponent(agentId)}/conversations`, {
      method: "POST",
      body: JSON.stringify({ title: "New chat" }),
    });
    state.conversations = [created.conversation];
  }
  state.activeConversation = state.conversations[0] ?? null;
  renderConversations();
  await loadConversationState();
}

async function selectAgent(agentId) {
  if (state.polling) clearInterval(state.polling);
  state.activeConversation = null;
  state.messages = [];
  state.tasks = [];
  renderMessages();
  renderTasks();
  try {
    await loadAgentWorkspace(agentId);
    beginPolling();
  } catch (error) {
    toast(error.message);
  }
}

async function selectConversation(conversationId) {
  state.activeConversation = state.conversations.find((item) => item.id === conversationId) ?? null;
  renderConversations();
  await loadConversationState();
  beginPolling();
}

async function createNewConversation() {
  if (!state.activeAgent) return;
  const data = await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}/conversations`, {
    method: "POST",
    body: JSON.stringify({ title: "New chat" }),
  });
  state.conversations.unshift(data.conversation);
  state.activeConversation = data.conversation;
  state.messages = [];
  state.tasks = [];
  renderConversations();
  renderMessages();
  renderTasks();
  beginPolling();
  $("#message-input").focus();
}

async function loadConversationState() {
  if (!state.activeConversation) return;
  const data = await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}`);
  state.activeConversation = data.conversation;
  state.messages = data.messages;
  state.tasks = data.tasks;
  renderMessages();
  renderTasks();
  renderConversations();
}

function beginPolling() {
  if (state.polling) clearInterval(state.polling);
  if (!state.activeConversation) return;
  const conversationId = state.activeConversation.id;
  state.polling = setInterval(async () => {
    if (state.activeConversation?.id !== conversationId) return;
    try {
      await loadConversationState();
    } catch {
      // Keep the last visible state and retry on the next polling interval.
    }
  }, 1600);
}

async function sendMessage(content) {
  if (!state.activeConversation || !content.trim()) return;
  const sendButton = $("#send-button");
  sendButton.disabled = true;
  try {
    await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    $("#message-input").value = "";
    await loadConversationState();
    beginPolling();
  } catch (error) {
    toast(error.message);
  } finally {
    sendButton.disabled = false;
    $("#message-input").focus();
  }
}

async function taskAction(taskId, action) {
  try {
    await api(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    await loadConversationState();
    beginPolling();
  } catch (error) {
    toast(error.message);
  }
}

function appendActionPreview(container, action) {
  const item = document.createElement("article");
  item.className = "change-item";
  const title = document.createElement("h3");
  title.textContent = action.type === "tool_execute"
    ? `Shell command: ${action.details?.command ?? "(empty)"}`
    : `${action.type.replaceAll("_", " ")}: ${action.path}`;
  item.append(title);

  if (action.type === "file_create" || action.type === "file_modify" || action.type === "file_delete") {
    if (action.details?.before) {
      const beforeLabel = document.createElement("p");
      beforeLabel.className = "change-label removed-label";
      beforeLabel.textContent = "Before";
      const before = document.createElement("pre");
      before.textContent = action.details.before;
      item.append(beforeLabel, before);
    }
    if (action.details?.after) {
      const afterLabel = document.createElement("p");
      afterLabel.className = "change-label added-label";
      afterLabel.textContent = "Proposed";
      const after = document.createElement("pre");
      after.textContent = action.details.after;
      item.append(afterLabel, after);
    }
  }
  container.append(item);
}

async function openApproval(taskId) {
  try {
    const data = await api(`/api/tasks/${encodeURIComponent(taskId)}`);
    const dialog = $("#approval-dialog");
    const actions = data.actions ?? [];
    $("#approval-summary").textContent = `${actions.length} proposed operation(s) for “${data.task.goal}”`;
    const content = $("#approval-content");
    content.replaceChildren();
    for (const action of actions) appendActionPreview(content, action);
    $("#approve-changes").onclick = async () => {
      await taskAction(taskId, "approve");
      dialog.close();
    };
    $("#reject-changes").onclick = async () => {
      await taskAction(taskId, "reject");
      dialog.close();
    };
    dialog.showModal();
  } catch (error) {
    toast(error.message);
  }
}

async function openTaskDetails(taskId) {
  try {
    const data = await api(`/api/tasks/${encodeURIComponent(taskId)}`);
    const lines = [
      `Task: ${data.task.goal}`,
      `Status: ${statusLabel(data.task.status)}`,
      data.task.error ? `Error: ${data.task.error}` : "",
      "",
      "Progress:",
      ...(data.events ?? []).map((event) => `• ${formatTime(event.created_at)} ${event.message}`),
    ].filter(Boolean);
    window.alert(lines.join("\n"));
  } catch (error) {
    toast(error.message);
  }
}

function setSettingsOpen(open) {
  $("#settings-panel").classList.toggle("hidden", !open);
  $("#settings-button").classList.toggle("active", open);
}

async function saveAgentSettings(event) {
  event.preventDefault();
  if (!state.activeAgent) return;
  try {
    const data = await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: $("#settings-name").value,
        description: $("#settings-description").value,
        instructions: $("#settings-instructions").value,
      }),
    });
    state.activeAgent = data.agent;
    state.agents = state.agents.map((agent) => agent.id === data.agent.id ? data.agent : agent);
    renderHeader();
    renderAgents($("#agent-search").value);
    toast("Agent settings saved.");
  } catch (error) {
    toast(error.message);
  }
}

async function createAgent(event) {
  event.preventDefault();
  const name = $("#new-agent-name").value.trim();
  if (!name) return;
  try {
    const data = await api("/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: $("#new-agent-description").value,
      }),
    });
    $("#new-agent-dialog").close();
    $("#new-agent-form").reset();
    state.agents.push(data.agent);
    await selectAgent(data.agent.id);
    toast("Agent created.");
  } catch (error) {
    toast(error.message);
  }
}

$("#agent-search").addEventListener("input", (event) => renderAgents(event.target.value));
$("#add-agent-button").addEventListener("click", () => $("#new-agent-dialog").showModal());
$("#new-agent-form").addEventListener("submit", createAgent);
$("#new-chat-button").addEventListener("click", () => createNewConversation().catch((error) => toast(error.message)));
$("#settings-button").addEventListener("click", () => setSettingsOpen($("#settings-panel").classList.contains("hidden")));
$("#close-settings").addEventListener("click", () => setSettingsOpen(false));
$("#settings-form").addEventListener("submit", saveAgentSettings);
$("#close-approval").addEventListener("click", () => $("#approval-dialog").close());
$("#message-form").addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage($("#message-input").value);
});
$("#message-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("#message-form").requestSubmit();
  }
});

loadAgents().catch((error) => {
  $("#active-agent-name").textContent = "Could not connect";
  $("#active-agent-description").textContent = error.message;
  toast(error.message);
});
