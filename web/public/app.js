const state = {
  agents: [],
  apiKeys: [],
  memories: [],
  schedules: [],
  notifications: [],
  unreadNotifications: 0,
  environmentKeyAvailable: false,
  firecrawlKey: { configured: false },
  telegram: { configured: false, paired: false, pending: false },
  telegramPairTimer: null,
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
  $("#permission-web").checked = Boolean(state.activeAgent.permissions?.allowWebAccess);
  $("#permission-shell").checked = Boolean(state.activeAgent.permissions?.allowShellExecution);
  $("#permission-file-create").checked = Boolean(state.activeAgent.permissions?.allowFileCreation);
  $("#permission-file-modify").checked = Boolean(state.activeAgent.permissions?.allowFileModification);
  $("#permission-folder-create").checked = Boolean(state.activeAgent.permissions?.allowFolderCreation);
  $("#delete-agent-button").disabled = false;
  $("#settings-button").disabled = false;
  $("#new-chat-button").disabled = false;
  $("#message-input").disabled = false;
  $("#send-button").disabled = false;
  $("#welcome-panel h2").textContent = "What can I help you with?";
  $("#welcome-panel p").textContent = "Choose an agent and send a message. Tasks keep running if you close this page.";
  renderAgentKeySelection();
}

function showNoAgents() {
  if (state.polling) clearInterval(state.polling);
  state.polling = null;
  state.activeAgent = null;
  state.activeConversation = null;
  state.conversations = [];
  state.messages = [];
  state.tasks = [];
  state.schedules = [];
  state.memories = [];
  $("#active-agent-name").textContent = "No agents yet";
  $("#active-agent-description").textContent = "Create an agent to start chatting.";
  $("#header-avatar").textContent = "+";
  $("#settings-avatar").textContent = "+";
  $("#settings-button").disabled = true;
  $("#new-chat-button").disabled = true;
  $("#message-input").disabled = true;
  $("#send-button").disabled = true;
  $("#delete-agent-button").disabled = true;
  $("#welcome-panel h2").textContent = "Create your first agent";
  $("#welcome-panel p").textContent = "Select the + button in the sidebar to create an agent and start chatting.";
  setSettingsOpen(false);
  renderAgents($("#agent-search").value);
  renderConversations();
  renderMessages();
  renderTasks();
}

async function deleteActiveAgent() {
  const agent = state.activeAgent;
  if (!agent) return;
  const confirmed = window.confirm(`Delete “${agent.name}”? Its conversations, memories, and scheduled jobs will also be permanently deleted.`);
  if (!confirmed) return;
  try {
    await api(`/api/agents/${encodeURIComponent(agent.id)}`, { method: "DELETE" });
    state.agents = state.agents.filter((item) => item.id !== agent.id);
    renderAgents($("#agent-search").value);
    if (state.agents.length) await selectAgent(state.agents[0].id);
    else showNoAgents();
    toast(`Agent “${agent.name}” deleted.`);
  } catch (error) {
    toast(error.message);
  }
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
  const firecrawl = await api("/api/provider-keys/firecrawl");
  state.firecrawlKey = firecrawl;
  state.apiKeys = data.keys;
  state.environmentKeyAvailable = data.environmentKeyAvailable;
  $("#environment-key-status").textContent = state.environmentKeyAvailable ? ".env key available as fallback" : "";
  renderKeyManager();
  renderAgentKeySelection();
  $("#firecrawl-key-status").textContent = firecrawl.configured
    ? `Configured${firecrawl.last_four ? ` · •••• ${firecrawl.last_four}` : firecrawl.environmentLastFour ? ` · •••• ${firecrawl.environmentLastFour}` : ""}${firecrawl.source === "environment" ? " · environment fallback" : ""}`
    : "Not configured";
  $("#firecrawl-key-remove").disabled = !firecrawl.configured || firecrawl.source === "environment";
}

async function saveFirecrawlKey(event) {
  event.preventDefault();
  const key = $("#firecrawl-key-input").value.trim();
  if (!key) return toast("Enter a Firecrawl API key.");
  try {
    await api("/api/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key }) });
    $("#firecrawl-key-input").value = "";
    await loadApiKeys();
    toast("Firecrawl key saved securely.");
  } catch (error) { toast(error.message); }
}

async function removeFirecrawlKey() {
  try {
    await api("/api/provider-keys/firecrawl", { method: "DELETE" });
    await loadApiKeys();
    toast("Saved Firecrawl key removed.");
  } catch (error) { toast(error.message); }
}

function showTelegramPairingLink(pairingUrl, botUsername) {
  const link = $("#telegram-pair-link");
  link.href = pairingUrl;
  link.classList.remove("hidden");
  $("#telegram-status").textContent = `Waiting for pairing with @${botUsername}`;
  $("#telegram-pair-again").classList.add("hidden");
  $("#telegram-disconnect").classList.remove("hidden");
  if (state.telegramPairTimer) clearInterval(state.telegramPairTimer);
  state.telegramPairTimer = setInterval(async () => {
    try {
      const status = await api("/api/telegram");
      state.telegram = status;
      if (status.paired) {
        clearInterval(state.telegramPairTimer);
        state.telegramPairTimer = null;
        renderTelegramSettings();
        toast("Telegram connected. You can now message the bot.");
      }
    } catch { /* retry while pairing remains open */ }
  }, 2000);
}

function renderTelegramSettings() {
  const status = state.telegram;
  $("#telegram-status").textContent = status.paired
    ? `Connected${status.source === "environment" ? " · environment setup" : ""}`
    : status.pending ? "Waiting for pairing" : "Not connected";
  $("#telegram-connect-form").classList.toggle("hidden", status.paired || status.pending);
  $("#telegram-disconnect").classList.toggle("hidden", !status.configured);
  $("#telegram-pair-again").classList.toggle("hidden", !status.pending);
  if (!status.pending && !status.paired) $("#telegram-pair-link").classList.add("hidden");
}

async function loadTelegramSettings() {
  state.telegram = await api("/api/telegram");
  renderTelegramSettings();
}

function telegramUiError(error) {
  return error.message === "Not found."
    ? "The running StingClaw backend is outdated. Stop it, run bun run dev again, refresh this page, and retry."
    : error.message;
}

async function connectTelegram(event) {
  event.preventDefault();
  try {
    const result = await api("/api/telegram", {
      method: "POST",
      body: JSON.stringify({ action: "connect", token: $("#telegram-bot-token").value }),
    });
    $("#telegram-bot-token").value = "";
    state.telegram = { configured: true, paired: false, pending: true, source: "settings" };
    renderTelegramSettings();
    showTelegramPairingLink(result.pairingUrl, result.botUsername);
  } catch (error) {
    toast(telegramUiError(error));
    await loadTelegramSettings().catch(() => {});
  }
}

async function regenerateTelegramPairing() {
  try {
    const result = await api("/api/telegram", {
      method: "POST",
      body: JSON.stringify({ action: "pair" }),
    });
    state.telegram = { configured: true, paired: false, pending: true, source: "settings" };
    renderTelegramSettings();
    showTelegramPairingLink(result.pairingUrl, result.botUsername);
  } catch (error) {
    toast(telegramUiError(error));
    await loadTelegramSettings().catch(() => {});
  }
}

async function disconnectTelegram() {
  try {
    await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "disconnect" }) });
    if (state.telegramPairTimer) clearInterval(state.telegramPairTimer);
    state.telegramPairTimer = null;
    state.telegram = { configured: false, paired: false, pending: false };
    renderTelegramSettings();
    toast("Telegram disconnected.");
  } catch (error) { toast(error.message); }
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

function renderMessages({ forceBottom = false } = {}) {
  const previousScrollTop = messageList.scrollTop;
  const previousMessageCount = messageList.children.length;
  const wasNearBottom = messageList.scrollHeight - messageList.clientHeight - previousScrollTop < 80;
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

  const hasNewMessages = state.messages.length > previousMessageCount;
  if (forceBottom || (wasNearBottom && hasNewMessages)) {
    messageList.scrollTop = messageList.scrollHeight;
  } else {
    messageList.scrollTop = previousScrollTop;
  }
}

async function loadAgentMemories(agentId = state.activeAgent?.id) {
  if (!agentId) return;
  const data = await api(`/api/agents/${encodeURIComponent(agentId)}/memories`);
  state.memories = data.memories;
  renderMemories();
}

function scheduleTime(value, timeZone) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function appendSchedulePermissions(container, permissions = {}) {
  const settings = [
    ["allowWebAccess", "Search/read public pages"],
    ["allowFileCreation", "Create files"],
    ["allowFileModification", "Modify or delete files"],
    ["allowFolderCreation", "Create folders"],
    ["allowShellExecution", "Run shell commands"],
  ];
  const group = document.createElement("div");
  group.className = "schedule-permissions";
  const title = document.createElement("span");
  title.textContent = "Job permissions (limited by the agent’s permissions)";
  group.append(title);
  for (const [field, labelText] of settings) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.permission = field;
    checkbox.checked = Boolean(permissions[field]);
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(checkbox, text);
    group.append(label);
  }
  container.append(group);
}

function readSchedulePermissions(container) {
  return Object.fromEntries([...container.querySelectorAll("input[data-permission]")]
    .map((input) => [input.dataset.permission, input.checked]));
}

function renderSchedules() {
  const container = $("#schedule-list");
  if (!container) return;
  container.replaceChildren();
  if (!state.schedules.length) {
    const empty = document.createElement("p");
    empty.className = "empty-key-copy";
    empty.textContent = "No scheduled jobs for this agent yet.";
    container.append(empty);
    return;
  }

  for (const schedule of state.schedules) {
    const details = document.createElement("details");
    details.className = "schedule-card";
    const summary = document.createElement("summary");
    const title = document.createElement("strong");
    title.textContent = schedule.name;
    const next = document.createElement("span");
    next.textContent = schedule.enabled
      ? `Next run: ${scheduleTime(schedule.next_run_at, schedule.timezone)}`
      : "Paused";
    summary.append(title, next);

    const body = document.createElement("div");
    body.className = "schedule-card-body";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Job name";
    const name = document.createElement("input");
    name.maxLength = 80;
    name.value = schedule.name;
    nameLabel.append(name);
    const promptLabel = document.createElement("label");
    promptLabel.textContent = "Job instructions";
    const prompt = document.createElement("textarea");
    prompt.rows = 3;
    prompt.maxLength = 10000;
    prompt.value = schedule.prompt;
    promptLabel.append(prompt);
    const grid = document.createElement("div");
    grid.className = "schedule-grid";
    const frequencyLabel = document.createElement("label");
    frequencyLabel.textContent = "Repeat";
    const frequency = document.createElement("select");
    for (const [value, labelText] of [["daily", "Daily"], ["weekly", "Weekly"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      frequency.append(option);
    }
    frequency.value = schedule.frequency;
    frequencyLabel.append(frequency);
    const timeLabel = document.createElement("label");
    timeLabel.textContent = "Local run time";
    const time = document.createElement("input");
    time.type = "time";
    time.value = schedule.time_local;
    timeLabel.append(time);
    grid.append(frequencyLabel, timeLabel);
    const weekdayLabel = document.createElement("label");
    weekdayLabel.textContent = "Day of week";
    const weekday = document.createElement("select");
    for (const [value, labelText] of [["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["0", "Sunday"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      weekday.append(option);
    }
    weekday.value = String(schedule.weekday ?? 1);
    weekdayLabel.append(weekday);
    const showWeekday = () => weekdayLabel.classList.toggle("hidden", frequency.value !== "weekly");
    frequency.addEventListener("change", showWeekday);
    showWeekday();
    const timezoneLabel = document.createElement("label");
    timezoneLabel.textContent = "Time zone";
    const timezone = document.createElement("input");
    timezone.maxLength = 100;
    timezone.value = schedule.timezone;
    timezoneLabel.append(timezone);
    body.append(nameLabel, promptLabel, grid, weekdayLabel, timezoneLabel);
    appendSchedulePermissions(body, schedule.permissions);

    const actions = document.createElement("div");
    actions.className = "schedule-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "quiet-button";
    save.textContent = "Save changes";
    save.addEventListener("click", () => updateSchedule(schedule.id, {
      name: name.value,
      prompt: prompt.value,
      frequency: frequency.value,
      timeLocal: time.value,
      weekday: frequency.value === "weekly" ? Number(weekday.value) : null,
      timezone: timezone.value,
      permissions: readSchedulePermissions(body),
    }));
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "quiet-button";
    pause.textContent = schedule.enabled ? "Pause" : "Resume";
    pause.addEventListener("click", () => changeScheduleState(schedule.id, schedule.enabled ? "pause" : "resume"));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet-button danger-button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => removeSchedule(schedule.id));
    actions.append(save, pause, remove);
    body.append(actions);

    if (schedule.runs?.length) {
      const runList = document.createElement("div");
      runList.className = "schedule-run-list";
      const runHeading = document.createElement("strong");
      runHeading.textContent = "Recent runs";
      runList.append(runHeading);
      for (const run of schedule.runs) {
        const runItem = document.createElement("article");
        runItem.className = "schedule-run";
        const runStatus = document.createElement("strong");
        runStatus.textContent = run.status.replaceAll("_", " ").toUpperCase();
        const runTime = document.createElement("span");
        runTime.textContent = scheduleTime(run.scheduled_at, schedule.timezone);
        runItem.append(runStatus, runTime);
        if (run.task_result) {
          const result = document.createElement("span");
          result.textContent = shortText(run.task_result, 220);
          runItem.append(result);
        } else if (run.error) {
          const errorText = document.createElement("span");
          errorText.textContent = shortText(run.error, 220);
          runItem.append(errorText);
        }
        if (run.task_id) {
          const open = document.createElement("button");
          open.type = "button";
          open.className = "text-button";
          open.textContent = "Open task conversation";
          open.addEventListener("click", () => openScheduleConversation(schedule.conversation_id));
          runItem.append(open);
        }
        runList.append(runItem);
      }
      body.append(runList);
    }

    details.append(summary, body);
    container.append(details);
  }
}

async function loadSchedules(agentId = state.activeAgent?.id) {
  if (!agentId) return;
  const data = await api(`/api/agents/${encodeURIComponent(agentId)}/schedules`);
  state.schedules = data.schedules;
  renderSchedules();
}

async function createSchedule(event) {
  event.preventDefault();
  if (!state.activeAgent) return;
  try {
    await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}/schedules`, {
      method: "POST",
      body: JSON.stringify({
        name: $("#schedule-new-name").value,
        prompt: $("#schedule-new-prompt").value,
        frequency: $("#schedule-new-frequency").value,
        timeLocal: $("#schedule-new-time").value,
        weekday: $("#schedule-new-frequency").value === "weekly" ? Number($("#schedule-new-weekday").value) : null,
        timezone: $("#schedule-new-timezone").value,
        permissions: {
          allowWebAccess: $("#schedule-new-web").checked,
          allowFileCreation: $("#schedule-new-create").checked,
          allowFileModification: $("#schedule-new-modify").checked,
          allowFolderCreation: $("#schedule-new-folder").checked,
          allowShellExecution: $("#schedule-new-shell").checked,
        },
      }),
    });
    $("#schedule-new-name").value = "";
    $("#schedule-new-prompt").value = "";
    await loadSchedules();
    const conversations = await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}/conversations`);
    state.conversations = conversations.conversations;
    renderConversations();
    toast("Scheduled job created.");
  } catch (error) {
    toast(error.message);
  }
}

async function updateSchedule(scheduleId, changes) {
  try {
    await api(`/api/schedules/${encodeURIComponent(scheduleId)}`, { method: "PATCH", body: JSON.stringify(changes) });
    await loadSchedules();
    toast("Schedule updated.");
  } catch (error) {
    toast(error.message);
  }
}

async function changeScheduleState(scheduleId, action) {
  try {
    await api(`/api/schedules/${encodeURIComponent(scheduleId)}`, { method: "POST", body: JSON.stringify({ action }) });
    await loadSchedules();
    toast(action === "pause" ? "Schedule paused." : "Schedule resumed.");
  } catch (error) {
    toast(error.message);
  }
}

async function removeSchedule(scheduleId) {
  try {
    await api(`/api/schedules/${encodeURIComponent(scheduleId)}`, { method: "DELETE" });
    await loadSchedules();
    toast("Scheduled job deleted. Existing tasks and conversations remain saved.");
  } catch (error) {
    toast(error.message);
  }
}

async function openScheduleConversation(conversationId) {
  try {
    if (!state.conversations.some((conversation) => conversation.id === conversationId)) {
      const data = await api(`/api/agents/${encodeURIComponent(state.activeAgent.id)}/conversations`);
      state.conversations = data.conversations;
      renderConversations();
    }
    await selectConversation(conversationId);
  } catch (error) {
    toast(error.message);
  }
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
  await loadTelegramSettings();
  await loadNotifications();
  const data = await api("/api/agents");
  state.agents = data.agents;
  if (state.agents.length === 0) {
    showNoAgents();
    return;
  }
  if (!state.activeAgent || !state.agents.some((agent) => agent.id === state.activeAgent.id)) {
    state.activeAgent = state.agents[0] ?? null;
  }
  renderAgents($("#agent-search").value);
  if (state.activeAgent) await loadAgentWorkspace(state.activeAgent.id);
}

async function loadAgentWorkspace(agentId) {
  state.activeAgent = state.agents.find((agent) => agent.id === agentId) ?? null;
  if (!state.activeAgent) return;
  state.schedules = [];
  renderAgents($("#agent-search").value);
  renderHeader();
  await loadAgentMemories(agentId);
  await loadSchedules(agentId);

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
  await loadConversationState({ forceBottom: true });
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
  await loadConversationState({ forceBottom: true });
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

async function loadConversationState({ forceBottom = false } = {}) {
  if (!state.activeConversation) return;
  const data = await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}`);
  state.activeConversation = data.conversation;
  state.messages = data.messages;
  state.tasks = data.tasks;
  renderMessages({ forceBottom });
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
      if (pollCount % 5 === 0 && !document.activeElement?.closest("#schedule-list")) {
        await loadSchedules(state.activeAgent?.id);
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
    await loadConversationState({ forceBottom: true });
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
      ...(data.delegatedTasks?.length ? [
        "Delegated subtasks:",
        ...data.delegatedTasks.map((child) => `• ${child.agent_name} — ${statusLabel(child.status)} (conversation ${child.conversation_id})${child.error ? `: ${child.error}` : ""}`),
        "Select that agent in the sidebar to open its delegated conversation.",
        "",
      ] : []),
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
          allowWebAccess: $("#permission-web").checked,
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
$("#delete-agent-button").addEventListener("click", deleteActiveAgent);
$("#key-add-form").addEventListener("submit", addApiKey);
$("#firecrawl-key-form").addEventListener("submit", saveFirecrawlKey);
$("#firecrawl-key-remove").addEventListener("click", removeFirecrawlKey);
$("#telegram-connect-form").addEventListener("submit", connectTelegram);
$("#telegram-pair-again").addEventListener("click", regenerateTelegramPairing);
$("#telegram-disconnect").addEventListener("click", disconnectTelegram);
$("#memory-add-form").addEventListener("submit", addMemoryFromForm);
$("#schedule-add-form").addEventListener("submit", createSchedule);
$("#schedule-new-frequency").addEventListener("change", (event) => {
  $("#schedule-new-weekday-wrap").classList.toggle("hidden", event.target.value !== "weekly");
});
$("#startup-enabled").addEventListener("change", (event) => setStartupEnabled(event.target.checked));
$("#stop-service-button").addEventListener("click", stopBackend);
$("#notifications-button").addEventListener("click", async () => {
  await loadNotifications();
  renderNotifications();
  $("#notification-dialog").showModal();
});
$("#close-notifications").addEventListener("click", () => $("#notification-dialog").close());
$("#mark-all-notifications-read").addEventListener("click", markAllNotificationsRead);

$("#schedule-new-timezone").value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
