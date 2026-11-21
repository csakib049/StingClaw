import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const copy = JSON.parse(await readFile(path.join(root, "content.json"), "utf8"));
const e = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const link = (label, href, className = "") => `<a${className ? ` class="${className}"` : ""} href="${e(href)}">${e(label)}</a>`;
const list = (items, className = "") => `<ul${className ? ` class="${className}"` : ""}>${items.map((item) => `<li>${e(item)}</li>`).join("")}</ul>`;

const navLinks = copy.navigation.map((item) => link(item.label, item.href)).join("");
const surfaceRows = copy.hero.surfaceRows.map((row) => `
  <div class="surface-row">
    <h3>${e(row.name)}</h3><p>${e(row.description)}</p>${link(row.action, row.href, "surface-action")}
  </div>`).join("");
const appAgents = copy.appFrame.agents.map((agent, index) => `
    <div class="app-agent${index === 0 ? " is-selected" : ""}"><span class="app-agent-mark">${e(agent.name.slice(0, 1))}</span><span><strong>${e(agent.name)}</strong><small>${e(agent.description)}</small></span></div>`).join("");
const proof = copy.proof.map((item) => `<div class="proof-item"><h3>${e(item.title)}</h3><p>${e(item.description)}</p></div>`).join("");
const pillars = copy.pillars.items.map((item) => `
  <article class="pillar">
    <h3>${e(item.title)}</h3><p class="pillar-intro">${e(item.description)}</p>
    ${list(item.facts, "ruled-facts")}${link(item.link, item.href, "text-link")}
  </article>`).join("");
const modeTabs = copy.modes.items.map((item, index) => `
  <button class="mode-tab${index === 0 ? " is-active" : ""}" id="mode-tab-${index}" role="tab" type="button" aria-selected="${index === 0}" aria-controls="mode-panel-${index}" tabindex="${index === 0 ? "0" : "-1"}">
    <span>${e(item.name)}</span><small>${e(item.short)}</small>
  </button>`).join("");
const modePanels = copy.modes.items.map((item, index) => {
  const lines = item.conversation.map((line, lineIndex) => {
    if (line.kind === "you") return `<div class="transcript-you" data-seq="${lineIndex}"><span>you</span><p>${e(line.text)}</p></div>`;
    if (line.kind === "step") return `<div class="transcript-step" data-seq="${lineIndex}"><span class="step-mark ${line.state === "done" ? "is-done" : "is-running"}">${line.state === "done" ? "✓" : "▸"}</span><p>${e(line.text)}</p><time>+0.${lineIndex + 1}s</time></div>`;
    if (line.kind === "approval") return `<div class="transcript-approval" data-seq="${lineIndex}"><span>!</span><p>${e(line.text)}</p></div>`;
    if (line.kind === "choice") return `<div class="transcript-choice" data-seq="${lineIndex}">${e(line.text)}</div>`;
    return `<div class="transcript-answer" data-seq="${lineIndex}"><span>agent</span><p>${e(line.text)}</p></div>`;
  }).join("");
  return `
  <section class="mode-panel${index === 0 ? " is-active" : ""}" id="mode-panel-${index}" role="tabpanel" aria-labelledby="mode-tab-${index}"${index === 0 ? "" : " hidden"}>
    <div class="mode-copy"><h3>${e(item.heading)}</h3><p>${e(item.body)}</p><div class="can-pair"><div><h4>Can</h4>${list(item.can)}</div><div><h4>Cannot</h4>${list(item.cannot)}</div></div></div>
    <div class="transcript" role="img" aria-label="Example ${e(item.name)} conversation: ${e(item.conversation.map((line) => line.text).join(". "))}"><div class="transcript-top"><span>Example · ${e(item.name)} mode</span><span>Local task</span></div><div class="transcript-lines">${lines}</div><div class="transcript-prompt"><span>$</span><span>Continue the task</span><i class="sc-cursor sc-cursor--blink"></i></div></div>
  </section>`;
}).join("");
const agentSettings = copy.agents.settings.map((item) => `<label class="mock-field"><span>${e(item.label)}</span><strong>${e(item.value)}</strong></label>`).join("");
const permissions = copy.agents.permissions.map((item) => `<div class="mock-permission"><span class="mock-check${item.enabled ? " is-on" : ""}" aria-hidden="true">${item.enabled ? "✓" : ""}</span><span>${e(item.label)}</span></div>`).join("");
const diffLines = copy.approvals.lines.map((line) => `<div class="diff-line diff-${e(line.kind)}"><span aria-hidden="true">${e(line.text.slice(0, 1))}</span><code>${e(line.text.slice(1))}</code></div>`).join("");
const flowNodes = copy.flow.nodes.map((node, index) => `<div class="flow-node${node.review ? " is-review" : index === 2 ? " is-active" : ""}" tabindex="0" aria-label="${e(`${node.title}: ${node.description}`)}"><span class="flow-icon">${e(node.icon)}</span><span><strong>${e(node.title)}</strong><small>${e(node.description)}</small></span></div>`).join("");
const flowSteps = copy.flow.steps.map((step, index) => `<article class="flow-step"><span class="step-number">0${index + 1}</span><h3>${e(step.title)}</h3><p>${e(step.description)}</p></article>`).join("");
const faqItems = copy.faq.items.map((item, index) => `
  <article class="faq-item"><h3><button class="faq-trigger" id="faq-trigger-${index}" type="button" aria-expanded="false" aria-controls="faq-answer-${index}"><span>${e(item.question)}</span><span class="faq-indicator" aria-hidden="true">+</span></button></h3>
  <div class="faq-answer" id="faq-answer-${index}" role="region" aria-labelledby="faq-trigger-${index}"><p>${e(item.answer)}</p></div></article>`).join("");
const footerLinks = (items) => items.map((label) => {
  const item = copy.navigation.find((candidate) => candidate.label === label);
  const href = item?.href ?? (label === "Local setup" ? "#get-started" : label === "Task flow" ? "#task-flow" : "#");
  return link(label, href);
}).join("");

const html = `<!doctype html>
<html lang="en" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111114">
  <meta name="description" content="${e(copy.description)}">
  <title>${e(copy.title)}</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="preload" href="./assets/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="./styles.css">
  <script>document.documentElement.className = 'js';</script>
  <script src="./app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <nav class="nav-wrap" aria-label="Main navigation">
      <a class="wordmark" href="#top" aria-label="StingClaw home">stingclaw<span class="sc-cursor" aria-hidden="true"></span></a>
      <div class="desktop-nav">${navLinks}</div>
      ${link(copy.hero.primary, "#get-started", "button button-primary nav-cta")}
      <button class="menu-button" type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="mobile-menu"><span></span><span></span></button>
    </nav>
    <dialog class="mobile-menu" id="mobile-menu" aria-label="Navigation menu">
      <div class="mobile-menu-head"><a class="wordmark" href="#top">stingclaw<span class="sc-cursor" aria-hidden="true"></span></a><button class="menu-close" type="button" aria-label="Close navigation">×</button></div>
      <nav aria-label="Mobile navigation">${navLinks}</nav>
      ${link(copy.hero.primary, "#get-started", "button button-primary mobile-cta")}
    </dialog>
  </header>

  <main id="main">
    <section class="hero section-wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <h1 id="hero-title">${e(copy.hero.headline)}</h1>
        <p class="hero-description">${e(copy.hero.description)}</p>
        <div class="hero-actions">${link(copy.hero.primary, "#get-started", "button button-primary button-lg")}${link(copy.hero.secondary, "#modes", "button button-secondary button-lg")}</div>
        <div class="setup-block" id="get-started">
          <div class="setup-label">${e(copy.hero.setupLabel)}</div>
          <div class="command-block"><div class="command-lines">${copy.hero.setupCommands.map((command) => `<code><span>$</span> ${e(command)}</code>`).join("")}</div><button class="copy-button" type="button" aria-label="Copy setup commands" data-copy="${e(copy.hero.setupCommands.join("\n"))}"><span aria-hidden="true">▢</span><span class="copy-label">Copy</span></button></div>
          <p class="setup-note">${e(copy.hero.setupNote)}</p>
        </div>
        <div class="surface-list" aria-label="Ways to use StingClaw">${surfaceRows}</div>
      </div>
      <div class="hero-visual">
        <div class="app-mock" role="img" aria-label="StingClaw local workspace showing two agents, a conversation, and proposed changes waiting for review">
          <div class="app-mock-sidebar"><div class="app-local"><span class="status-dot is-live"></span>${e(copy.appFrame.label)}</div><div class="mock-search">⌕ <span>Search agents</span></div><h2>${e(copy.appFrame.agentsTitle)}</h2>${appAgents}<div class="app-sidebar-foot"><span class="status-dot is-live"></span>Background service connected</div></div>
          <div class="app-mock-main"><div class="app-mock-header"><span class="app-avatar">${e(copy.appFrame.activeAgent.slice(0, 1))}</span><span><strong>${e(copy.appFrame.activeAgent)}</strong><small>${e(copy.appFrame.activeDescription)}</small></span><span class="app-status is-waiting">${e(copy.appFrame.taskStatus)}</span></div><div class="mock-chat"><div class="mock-message from-user"><span>you</span><p>${e(copy.appFrame.userMessage)}</p></div><div class="mock-message from-agent"><span>agent</span><p>${e(copy.appFrame.agentMessage)}</p></div><div class="mock-task"><span class="task-mark">!</span><span><strong>${e(copy.appFrame.taskLabel)}</strong><small>${e(copy.appFrame.taskDescription)}</small></span></div></div><div class="mock-composer"><span>${e(copy.appFrame.composer)}</span><button type="button" tabindex="-1" aria-hidden="true">↑</button></div></div>
        </div>
        <p class="app-caption">A local workspace for conversations, tasks, and review.</p>
      </div>
    </section>

    <section class="proof-strip" aria-label="StingClaw at a glance"><div class="proof-grid section-wrap">${proof}</div></section>

    <section class="section section-wrap pillars-section" aria-labelledby="pillars-title">
      <div class="section-heading"><h2 id="pillars-title">${e(copy.pillars.title)}</h2><p>${e(copy.pillars.description)}</p></div>
      <div class="pillar-grid">${pillars}</div>
    </section>

    <section class="section section-inset" id="modes" aria-labelledby="modes-title">
      <div class="section-wrap">
        <div class="section-heading"><h2 id="modes-title">${e(copy.modes.title)}</h2><p>${e(copy.modes.description)}</p></div>
        <div class="mode-tabs" role="tablist" aria-label="Agent modes">${modeTabs}</div>
        <div class="mode-panels">${modePanels}</div>
      </div>
    </section>

    <section class="section section-wrap agents-section" id="agents" aria-labelledby="agents-title">
      <div class="agents-copy"><h2 id="agents-title">${e(copy.agents.title)}</h2><p>${e(copy.agents.description)}</p>${list(copy.agents.facts, "agent-facts")}<div class="agent-examples">${copy.agents.examples.map((name) => `<span>${e(name)}</span>`).join("")}</div></div>
      <div class="settings-mock" role="img" aria-label="Agent settings example showing a model, API keys, and per-agent permissions"><div class="settings-mock-head"><span>Agent settings</span><span class="settings-state">Saved locally</span></div><div class="settings-mock-body"><div class="settings-avatar">R</div>${agentSettings}<fieldset class="settings-permissions"><legend>Agent permissions</legend>${permissions}</fieldset><div class="settings-save">Save settings</div></div></div>
    </section>

    <section class="section section-inset approvals-section" id="approvals" aria-labelledby="approvals-title">
      <div class="section-wrap approvals-grid">
        <div class="diff-wrap" data-reveal="approval">
          <div class="diff-block"><div class="diff-header"><code>${e(copy.approvals.file)}</code><span>${e(copy.approvals.counts)}</span></div><div class="diff-content">${diffLines}</div><div class="diff-actions"><button class="button button-primary button-sm" type="button" disabled aria-disabled="true">Approve</button><button class="button button-secondary button-sm" type="button" disabled aria-disabled="true">Reject</button></div></div>
          <p class="diff-caption">${e(copy.approvals.caption)}</p>
        </div>
        <div class="approvals-copy"><h2 id="approvals-title">${e(copy.approvals.title)}</h2><p>${e(copy.approvals.description)}</p>${list(copy.approvals.facts, "approval-facts")}<p class="data-line">${e(copy.approvals.dataLine)}</p></div>
      </div>
    </section>

    <section class="section section-wrap flow-section" id="task-flow" aria-labelledby="flow-title">
      <div class="section-heading"><h2 id="flow-title">${e(copy.flow.title)}</h2><p>${e(copy.flow.description)}</p></div>
      <div class="flow-diagram" data-reveal="flow" role="img" aria-label="Task flow: you send a task to the local background service; an agent works with a model and tools; proposed changes wait for your review before reaching your files."><div class="flow-path" aria-hidden="true"></div>${flowNodes}</div>
      <div class="flow-steps">${flowSteps}</div>
    </section>

    <section class="section section-wrap faq-section" id="faq" aria-labelledby="faq-title">
      <div class="faq-layout"><div class="faq-heading"><h2 id="faq-title">${e(copy.faq.title)}</h2><p>Clear answers about where StingClaw runs and what it sends to model providers.</p></div><div class="faq-list">${faqItems}</div></div>
    </section>

    <section class="final-cta section-wrap" aria-labelledby="cta-title">
      <div class="cta-inner"><div><h2 id="cta-title">${e(copy.cta.title)}<span class="sc-cursor" aria-hidden="true"></span></h2><p>${e(copy.cta.description)}</p></div><div class="cta-actions">${link(copy.cta.primary, "#get-started", "button button-primary button-lg")}${link(copy.cta.secondary, "#modes", "button button-secondary button-lg")}</div></div>
    </section>
  </main>

  <footer class="site-footer"><div class="section-wrap footer-main"><div class="footer-brand"><a class="wordmark" href="#top">stingclaw<span class="sc-cursor" aria-hidden="true"></span></a><p>${e(copy.footer.tagline)}</p></div><div class="footer-column"><h2>Product</h2>${footerLinks(copy.footer.product)}</div><div class="footer-column"><h2>Setup</h2>${footerLinks(copy.footer.setup)}</div></div><div class="section-wrap footer-bottom"><span>© ${new Date().getFullYear()} StingClaw</span><span>${e(copy.footer.platform)}</span></div></footer>
</body>
</html>`;

await writeFile(path.join(root, "index.html"), html, "utf8");
console.log("Built landing/index.html from landing/content.json");
