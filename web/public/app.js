const state = {
  agents: [],
  apiKeys: [],
  memories: [],
  notifications: [],
  unreadNotifications: 0,
  environmentKeyAvailable: false,
  startupSupported: false,
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
  $("#settings-model").value = state.activeAgent.model_id || "openrouter/free";
  $("#permission-shell").checked = Boolean(state.activeAgent.permissions?.allowShellExecution);
  $("#permission-file-create").checked = Boolean(state.activeAgent.permissions?.allowFileCreation);
  $("#permission-file-modify").checked = Boolean(state.activeAgent.permissions?.allowFileModification);
  $("#permission-folder-create").checked = Boolean(state.activeAgent.permissions?.allowFolderCreation);
  renderAgentKeySelection();
}

function renderAgentKeySelection() {
  const container = $("#agent-key-selection");
  if (!container || !state.activeAgent) return;
  container.replaceChildren();
  if (!state.apiKeys.length) {
    const empty = document.createElement("p");
    empty.className = "empty-key-copy";
    empty.textContent = "Add an API key below to assign it to this agent.";
    container.append(empty);
    return;
  }

  const selected = state.activeAgent.api_key_ids ?? [];
  const orderedKeys = [
    ...selected.map((id) => state.apiKeys.find((key) => key.id === id)).filter(Boolean),
    ...state.apiKeys.filter((key) => !selected.includes(key.id)),
  ];
  for (const key of orderedKeys) {
    const row = document.createElement("div");
    row.className = "key-row";
    const checkLabel = document.createElement("label");
    checkLabel.className = "key-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.includes(key.id);
    checkbox.addEventListener("change", () => {
      const ids = state.activeAgent.api_key_ids ?? [];
      state.activeAgent.api_key_ids = checkbox.checked ? [...ids, key.id] : ids.filter((id) => id !== key.id);
      renderAgentKeySelection();
    });
    const label = document.createElement("span");
    label.textContent = `${key.label} · •••• ${key.last_four}`;
    checkLabel.append(checkbox, label);
    row.append(checkLabel);
    if (selected.includes(key.id)) {
      const order = selected.indexOf(key.id) + 1;
      const controls = document.createElement("div");
      controls.className = "key-order-controls";
      const number = document.createElement("span");
      number.textContent = String(order);
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.disabled = order === 1;
      up.title = "Use this key earlier";
      up.addEventListener("click", () => moveAgentKey(key.id, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.disabled = order === selected.length;
      down.title = "Use this key later";
      down.addEventListener("click", () => moveAgentKey(key.id, 1));
      controls.append(number, up, down);
      row.append(controls);
    }
    container.append(row);
  }
}

function moveAgentKey(keyId, direction) {
  const ids = [...(state.activeAgent?.api_key_ids ?? [])];
  const index = ids.indexOf(keyId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  state.activeAgent.api_key_ids = ids;
  renderAgentKeySelection();
}

async function loadApiKeys() {
  const data = await api("/api/keys");
  state.apiKeys = data.keys;
  state.environmentKeyAvailable = data.environmentKeyAvailable;
  $("#environment-key-status").textContent = state.environmentKeyAvailable ? ".env key available as fallback" : "";
  renderKeyManager();
  renderAgentKeySelection();
}

async function loadServiceSettings() {
  const data = await api("/api/service");
  state.startupSupported = data.startupSupported;
  $("#startup-enabled").checked = data.startupEnabled;
  $("#startup-enabled").disabled = !data.startupSupported;
  $("#service-status").textContent = data.running ? "Running on this computer" : "Stopped";
  if (!data.startupSupported) {
    $("#service-status").textContent += " · sign-in startup is Windows-only";
  }
}

async function setStartupEnabled(enabled) {
  try {
    const data = await api("/api/service", {
      method: "POST",
      body: JSON.stringify({ action: "startup", enabled }),
    });
    $("#startup-enabled").checked = data.startupEnabled;
    toast(data.startupEnabled ? "StingClaw will start when you sign in." : "Automatic startup is turned off.");
  } catch (error) {
    $("#startup-enabled").checked = !enabled;
    toast(error.message);
  }
}

async function stopBackend() {
  const button = $("#stop-service-button");
  button.disabled = true;
  try {
    await api("/api/service", { method: "POST", body: JSON.stringify({ action: "stop" }) });
    $("#service-status").textContent = "Stopping…";
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}

function renderKeyManager() {
  const container = $("#key-list");
  if (!container) return;
  container.replaceChildren();
  if (!state.apiKeys.length) {
    const empty = document.createElement("p");
    empty.className = "empty-key-copy";
    empty.textContent = state.environmentKeyAvailable ? "No saved keys. Agents can use the .env key." : "No keys saved yet.";
    container.append(empty);
    return;
  }
  for (const key of state.apiKeys) {
    const row = document.createElement("div");
    row.className = "key-row managed-key-row";
    const description = document.createElement("span");
    description.textContent = `${key.label} · OpenRouter · •••• ${key.last_four}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button danger-text";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeApiKey(key.id));
    row.append(description, remove);
    container.append(row);
  }
}

async function removeApiKey(keyId) {
  try {
    await api(`/api/keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
    state.activeAgent.api_key_ids = (state.activeAgent.api_key_ids ?? []).filter((id) => id !== keyId);
    state.agents = state.agents.map((agent) => agent.id === state.activeAgent.id
      ? { ...agent, api_key_ids: agent.api_key_ids.filter((id) => id !== keyId) }
      : agent);
    await loadApiKeys();
    toast("API key removed from this computer and all agents.");
  } catch (error) {
    toast(error.message);
  }
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
    if (message.sender === "user" && state.activeAgent) {
      const remember = document.createElement("button");
      remember.type = "button";
      remember.className = "text-button remember-message-button";
      remember.textContent = "Remember this";
      remember.addEventListener("click", () => saveMemory(message.content, true));
      content.append(remember);
    }
    row.append(content);
    messageList.append(row);
  }

  messageList.scrollTop = messageList.scrollHeight;
}

async function loadAgentMemories(agentId = state.activeAgent?.id) {
  if (!agentId) return;
  const data = await api(`/api/agents/${encodeURIComponent(agentId)}/memories`);
  state.memories = data.memories;
  renderMemories();
}

function renderMemories() {
  const container = $("#memory-list");
  if (!container) return;
  container.replaceChildren();
  if (!state.memories.length) {
    const empty = document.createElement("p");
    empty.className = "empty-key-copy";
    empty.textContent = "No saved memories. You can remember a user message from the chat.";
    container.append(empty);
    return;
  }
  for (const memory of state.memories) {
    const card = document.createElement("article");
    card.className = "memory-card";
    const editor = document.createElement("textarea");
    editor.rows = 3;
    editor.maxLength = 2000;
    editor.value = memory.content;
    const actions = document.createElement("div");
    actions.className = "memory-card-actions";
    const importantLabel = document.createElement("label");
    importantLabel.className = "permission-row";
    const important = document.createElement("input");
    important.type = "checkbox";
    important.checked = memory.important;
    const labelText = document.createElement("span");
    labelText.textContent = "Important";
    importantLabel.append(important, labelText);
    const buttons = document.createElement("div");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "text-button";
    save.textContent = "Save";
    save.addEventListener("click", () => updateMemory(memory.id, editor.value, important.checked));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button danger-text";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteMemory(memory.id));
    buttons.append(save, remove);
    actions.append(importantLabel, buttons);
    card.append(editor, actions);
    container.append(card);
  }
}

async function saveMemory(content, important) {
  if (!state.activeAgent) return false;
  try {
    await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}/memories`, {
      method: "POST",
      body: JSON.stringify({ content, important }),
    });
    await loadAgentMemories();
    toast("Saved to this agent’s memory.");
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
}

async function updateMemory(memoryId, content, important) {
  if (!state.activeAgent) return;
  try {
    await api(`/api/memories/${encodeURIComponent(memoryId)}`, {
      method: "PATCH",
      body: JSON.stringify({ agentId: state.activeAgent.id, content, important }),
    });
    await loadAgentMemories();
    toast("Memory updated.");
  } catch (error) {
    toast(error.message);
  }
}

async function deleteMemory(memoryId) {
  if (!state.activeAgent) return;
  try {
    await api(`/api/memories/${encodeURIComponent(memoryId)}?agentId=${encodeURIComponent(state.activeAgent.id)}`, { method: "DELETE" });
    await loadAgentMemories();
    toast("Memory deleted.");
  } catch (error) {
    toast(error.message);
  }
}

async function loadNotifications() {
  const data = await api("/api/notifications");
  state.notifications = data.notifications;
  state.unreadNotifications = data.unreadCount;
  const badge = $("#notification-count");
  badge.textContent = state.unreadNotifications > 99 ? "99+" : String(state.unreadNotifications);
  badge.classList.toggle("hidden", state.unreadNotifications === 0);
  if ($("#notification-dialog").open) renderNotifications();
}

function renderNotifications() {
  const container = $("#notification-list");
  container.replaceChildren();
  if (!state.notifications.length) {
    const empty = document.createElement("p");
    empty.className = "notification-empty";
    empty.textContent = "You’re all caught up.";
    container.append(empty);
    return;
  }
  for (const notification of state.notifications) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `notification-item${notification.read_at ? "" : " unread"}`;
    const title = document.createElement("strong");
    title.textContent = notification.title;
    const message = document.createElement("span");
    message.textContent = notification.message;
    const time = document.createElement("time");
    time.textContent = new Date(notification.created_at).toLocaleString();
    item.append(title, message, time);
    item.addEventListener("click", () => openNotification(notification));
    container.append(item);
  }
}

async function openNotification(notification) {
  try {
    await api(`/api/notifications/${encodeURIComponent(notification.id)}`, { method: "POST", body: JSON.stringify({}) });
    await loadNotifications();
    $("#notification-dialog").close();
    if (notification.agent_id && state.activeAgent?.id !== notification.agent_id) {
      await selectAgent(notification.agent_id);
    }
    if (notification.conversation_id && state.conversations.some((conversation) => conversation.id === notification.conversation_id)) {
      await selectConversation(notification.conversation_id);
    }
  } catch (error) {
    toast(error.message);
  }
}

async function markAllNotificationsRead() {
  try {
    await api("/api/notifications/read-all", { method: "POST", body: JSON.stringify({}) });
    await loadNotifications();
  } catch (error) {
    toast(error.message);
  }
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
  await loadApiKeys();
  await loadServiceSettings();
  await loadNotifications();
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
  await loadAgentMemories(agentId);

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
  let pollCount = 0;
  state.polling = setInterval(async () => {
    if (state.activeConversation?.id !== conversationId) return;
    try {
      await loadConversationState();
      await loadNotifications();
      pollCount += 1;
      if (pollCount % 5 === 0 && !document.activeElement?.closest("#memory-list")) {
        await loadAgentMemories(state.activeAgent?.id);
      }
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
        modelId: $("#settings-model").value,
        apiKeyIds: state.activeAgent.api_key_ids ?? [],
        permissions: {
          allowShellExecution: $("#permission-shell").checked,
          allowFileModification: $("#permission-file-modify").checked,
          allowFileCreation: $("#permission-file-create").checked,
          allowFolderCreation: $("#permission-folder-create").checked,
        },
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

async function addApiKey(event) {
  event.preventDefault();
  try {
    await api("/api/keys", {
      method: "POST",
      body: JSON.stringify({ label: $("#key-label").value, key: $("#key-secret").value, provider: "openrouter" }),
    });
    $("#key-label").value = "";
    $("#key-secret").value = "";
    await loadApiKeys();
    toast("API key encrypted and saved. Assign it to an agent to use it.");
  } catch (error) {
    toast(error.message);
  }
}

async function addMemoryFromForm(event) {
  event.preventDefault();
  const input = $("#memory-new-content");
  if (!input.value.trim()) return;
  if (await saveMemory(input.value, $("#memory-new-important").checked)) input.value = "";
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
$("#key-add-form").addEventListener("submit", addApiKey);
$("#memory-add-form").addEventListener("submit", addMemoryFromForm);
$("#startup-enabled").addEventListener("change", (event) => setStartupEnabled(event.target.checked));
$("#stop-service-button").addEventListener("click", stopBackend);
$("#notifications-button").addEventListener("click", async () => {
  await loadNotifications();
  renderNotifications();
  $("#notification-dialog").showModal();
});
$("#close-notifications").addEventListener("click", () => $("#notification-dialog").close());
$("#mark-all-notifications-read").addEventListener("click", markAllNotificationsRead);
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
