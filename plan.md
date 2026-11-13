# StingClaw: Full Project Plan

This file describes the product we plan to build and how its features should work. It is a guide for us to follow one step at a time. **This document does not mean the features have been implemented.** We will agree on and build each stage separately.

## The idea in plain words

StingClaw will be a local-first assistant app for running several named AI agents. The user can talk to agents from a web interface on their computer or from Telegram on their phone. Both places show the same conversations and task updates. Agents can keep working in the background while the user does other things, as long as the computer and StingClaw's background service are running.

The web interface will run on the user's computer at a local address, such as `http://localhost:3000`. It will not require publishing StingClaw as a public website. A command such as `npm run dev` (or a Bun command, depending on the final setup) will start the local app during development.

We will use AI model APIs, such as OpenRouter, with the user's API keys. **We do not plan to use Ollama or require a model to run locally.**

## What the screenshots suggest for the interface

The attached screenshots are visual references for the web interface:

- A left sidebar lists the user's agents. The user can search, select an agent, or create another one.
- The center area shows the selected agent's conversation, with messages from both the user and the agent.
- An agent settings panel lets the user edit its name, label, description, and notification preference.
- The design can use a dark theme, but the exact layout and colors can be decided during interface design.

These screenshots are guidance for the layout and basic interaction. They do not define every screen or require an exact copy.

## Main goals

1. Make agents easy to create, configure, and chat with.
2. Let the user see what each agent is doing and what it has done.
3. Keep the web interface and Telegram in sync.
4. Let work continue after the user closes the browser or terminal.
5. Make model choice, API-key use, and agent permissions understandable to the user.
6. Build the project in stages so each part works before the next one depends on it.

## Detailed feature plan

### 1. Multiple agents

The user can create more than one agent. Each agent has its own identity and purpose, such as Executive Assistant, Research, Writing, or Finance.

Each agent should have:

- A name and optional short label.
- A description explaining what work it is for.
- Instructions describing how it should behave and what kind of work it should do.
- A selected model and API-key policy.
- A set of allowed tools and permissions.
- Its own conversation and task history.
- Optional scheduled jobs and notification settings.

The sidebar in the screenshot should make it easy to switch between these agents. Creating an agent should not silently grant it broad access to files, shell commands, websites, or browser sessions.

### 2. Chat with an agent

The user can open an agent and chat in a familiar message interface, similar to common AI chat apps.

The chat should support:

- A readable message history for that agent.
- Clear separation between user messages, agent responses, progress updates, and approval requests.
- A visible working, completed, failed, or waiting-for-user status for tasks.
- A way to see the result or error when a task ends.
- Continued conversations after closing and reopening the web page.

Long work should be represented as a task linked to the conversation, so the user can tell the difference between a normal reply and work that is still running.

### 3. Agent names, roles, work, and scheduled jobs

The user can give every agent a name, a role, and instructions for the kind of work it should handle. An agent's job description should be clear enough that the user knows when to use it.

Agents may also run scheduled jobs (sometimes called cron jobs), such as a daily summary or a weekly report. The user should be able to:

- Choose when a job runs and which time zone it uses.
- See the next run time and previous results.
- Pause, resume, edit, or delete a schedule.
- Decide what permissions the scheduled task has.
- Receive a notification if it succeeds, fails, or needs approval.

Scheduled jobs should be added after persistent tasks and permissions work reliably. The system must explain what happens when the computer is off at a scheduled time.

### 4. Local web interface

The web interface runs on the user's own computer and is opened in a browser. It is not hosted on a public domain as part of the initial plan.

The interface should let the user:

- View, search, create, and configure agents.
- Chat with an agent and see its previous messages.
- See task progress, completion, failure, and approval requests.
- Review the changes an agent proposes before they are applied.
- Manage API keys, models, notifications, and background startup settings.

The development workflow should have one clear command, such as `npm run dev`, that starts the local app and prints or opens its local address. The final command may change depending on whether the project uses npm or Bun.

### 5. Telegram access and shared conversations

Telegram is the phone interface for controlling the same agents when the user is away from the computer. It should use the same task system and saved conversation history as the web interface.

When a user sends a message or command through Telegram:

- The message should appear in the matching agent's web conversation.
- The agent's response and progress updates should appear in Telegram and in the web conversation.
- Completion, failure, and approval-needed notices should be available in both places.
- If the user responds from either place, the other place should show the updated status and conversation.

This requires one shared source of truth for messages, tasks, and approvals. The web UI and Telegram should be two ways to access the same agent, rather than separate copies of its work.

Remote Telegram access depends on the user's computer being on, connected to the internet, and running StingClaw's background service. If the computer is off or the service is stopped, its local agents cannot do work or reply until the service is available again.

### 6. Persistent memory

StingClaw should be able to remember useful information from earlier work, such as preferences, project context, or instructions the user has marked as important.

Memory should be:

- Saved between runs, rather than existing only in the current process.
- Separate from ordinary conversation and task history.
- Visible to the user, with ways to correct or delete it.
- Used only when relevant to the current agent and task.
- Designed so secrets and sensitive personal data are not saved by default.

The user should be able to mark an instruction as important. The agent should still follow the user's current request if it changes an older preference.

### 7. Browser navigation

Agents may eventually use a browser to visit websites and complete web-based tasks. This is a powerful feature and should come after the background task and permission systems.

The user should be able to see what the agent is doing in the browser. Actions that submit forms, change accounts, publish content, make purchases, or affect other people should require clear permission. The detailed browser permission rules are an open design decision.

### 8. Completion and failure notifications

When a task finishes, fails, or needs the user's input, the user should be notified:

- In the web interface, through the conversation, task status, and notification area.
- In Telegram, when Telegram notifications are enabled for that agent.

Notifications should identify the agent and task, explain what happened, and give the user a way to open or continue that task. A notification failure should not erase the task result.

### 9. Agent configuration: models and behavior

The user should be able to configure how an agent works, including:

- Its name, purpose, and behavior instructions.
- Which model API and model it uses.
- Which API key or key-selection policy it uses.
- Which tools it can use, such as reading files, editing files, shell commands, web access, or browser access.
- Whether changes require approval.
- Its notification preferences and schedules.

The interface should show the active model and permissions before a task starts. Configuration should be checked for missing keys or invalid settings and explain how to fix them.

### 10. Multiple API keys and fallback

The user can save multiple API keys for supported model API services, such as OpenRouter. The user wants this so work may continue if one key reaches a limit, expires, or is temporarily unavailable.

The system should:

- Let the user label and manage each saved key.
- Store keys securely on the user's computer and avoid displaying the full key after it is saved.
- Let the user choose which keys an agent may use and in what order.
- Detect errors that are safe to retry with another key, such as a rate limit or unavailable account, and explain when fallback happens.
- Avoid retrying with another key for errors that will not be fixed by changing keys.
- Show the user which key label was used, without exposing the key itself.

Keys from different accounts may have different access, limits, or billing. Adding another key does not guarantee that a task can continue, and the user remains responsible for those accounts and costs. Keys are provider credentials; they do not have to be tied to Gmail accounts specifically.

### 11. Background work and long tasks

Agents should run in a persistent background service, rather than depending on an open CLI window or browser tab. The user should be able to close the terminal or web page while a task continues.

The background service should:

- Save task progress and messages so they survive a restart where possible.
- Show which tasks are running, waiting for approval, completed, or failed.
- Allow the user to stop a task and, where safe, retry or resume it.
- Report when a task cannot continue, such as when the computer loses power or internet access.
- Deliver results to both the web interface and Telegram when available.

Background work only continues while the computer is powered on and the StingClaw service is running. Closing the browser should not stop work; shutting down the computer will.

### 12. Start the backend when the computer turns on

The user can choose whether StingClaw's background service starts automatically when they sign in or start their computer. The web settings should provide a clear on/off control and show whether the backend is currently running.

When turned off, the backend should stop starting automatically. The user should also have a way to stop it now. The app should explain that stopping the backend pauses agent work, local web access, scheduled jobs, and Telegram responses until it runs again.

The exact startup method depends on the operating system. The first implementation should target the user's main operating system and document the setup clearly; other operating systems can be supported later.

### 13. Security and personal data (open design decision)

Agents can access personal files and accounts, so security is a major concern. The user has not decided on the full security design yet; it will be decided before building features that grant agents more access.

This is an open decision, not permission to ignore security. Before enabling browser actions, shell commands, broad file access, remote control, or automatic startup, we need to decide:

- Which folders and tools each agent may access.
- Which actions always require user approval.
- How API keys and local task data are stored and protected.
- How the local web interface is protected from other websites and devices on the network.
- How Telegram users are authenticated and what they are allowed to do.
- How logs and persistent memory avoid storing secrets unnecessarily.
- How the user can review, revoke, or remove access.

Until those decisions are made, agents should have limited access and actions that can change files, run commands, or affect accounts should require approval.

### 14. Clear README

The README should explain in simple words:

- What StingClaw does and which features are available today.
- How to install it and which runtime to use.
- How to configure model API keys and Telegram.
- How to start the CLI, local web interface, and background service.
- How agents, permissions, approvals, memory, schedules, and notifications work.
- Important security limits and troubleshooting steps.

The README must distinguish features that are planned from features that are already available.

## Recommended build order

This is the proposed order. We will work through it one stage at a time and can adjust it together.

1. **Document and stabilize the current project.** Write the README, make setup clear, and review existing file, shell, web, and Telegram behavior.
2. **Build one persistent task service.** Store agents, conversations, task status, progress, approvals, and results locally. Make task state recover after a restart.
3. **Build the local web interface.** Start with the screenshot's agent sidebar, conversation view, and agent settings panel. Connect it to the shared task service.
4. **Connect Telegram to the same service.** Sync messages, progress, approvals, and results between the phone and the local web interface.
5. **Add agent settings and multiple API keys.** Support named agents, model choices, permissions, secure key storage, and controlled fallback.
6. **Add background and startup controls.** Keep tasks running without an open CLI or browser, and let the user enable or disable automatic startup.
7. **Add persistent memory and notifications.** Give the user visibility and controls over saved memory and notification preferences.
8. **Add scheduled jobs.** Support time zones, pause/resume, run history, and permission rules.
9. **Design and add browser navigation.** Finalize the security rules first, then build visible and permission-controlled browser actions.
10. **Add multi-agent coordination.** Let specialized agents share a larger task after task ownership, shared state, permissions, and failure recovery are reliable.

## Decisions to make together later

- Which operating system to support first for automatic startup and background work.
- Whether to use npm or Bun for the main development command and package workflow.
- Which local storage format to use for agents, messages, task state, and memory.
- Which model API providers to support first and how key fallback should work for each.
- The security and approval rules for file, shell, web, browser, and Telegram actions.
- How multi-agent tasks are divided, coordinated, and reviewed.
- How long conversations, task logs, and memory are kept, and how the user deletes them.

## What this plan does not claim

This is a product plan, not a list of completed features. The current CLI and Telegram code are the starting point. We will implement the plan in small steps, check each step, and update this file when we make decisions or change direction.
