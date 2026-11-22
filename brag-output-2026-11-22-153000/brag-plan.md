# Brag Plan: StingClaw

## What is this app?
StingClaw runs named AI agents on a Windows computer, from a local web app or Telegram, with agent permissions and review gates for proposed file and shell changes.

## The angle
An AI agent should work on your computer without taking control away from you. The film moves from an untrusted, unfinished task into a grounded product tour: create a named agent, choose its access, watch it work, review its proposal, and decide what gets applied. This is a practical product launch film, not a generic AI promise.

## Hook (first 2-3 seconds)
A maroon block cursor blinks on a near-black screen. A task appears: “Let an agent work on your project.” It pauses before touching a file. StingClaw wordmark resolves.

## Key moments (the middle)
- A real local web UI, with agents and separate conversations.
- Ask, Plan, and Agent modes, shown as distinct and accurate capabilities.
- A proposed file diff waits for approval; show approve and reject outcomes.
- The same saved agents are available through Telegram, plus memory, schedules, and the background service.

## Outro / punchline
Return to the blinking maroon cursor and StingClaw logo. Final line: “Your agents. Your keys. Your computer. Your call.” Then the live landing page and GitHub repository URLs.

## User flow worth showing
Open the local app → choose an agent and send a task → inspect its staged change and approve or reject it. A short Telegram follow-on demonstrates the same saved agents away from the desk.

## Tone
- Preset: cinematic
- Creative direction: restrained, confident developer product launch; maroon light and real interface details, with enough time to understand each capability
- Interpretation: deliberate chapter pacing, crisp UI cuts, restrained SFX, clear claims, no exaggerated metrics or voiceover.

## Format: landscape — 1920x1080
## Duration: 300 seconds (5:00)

## Visual identity (from the project)
- Background: #111114
- Accent: #C32148
- Text: #E5E1E4
- Display font: JetBrains Mono (local project font)
- Body font: JetBrains Mono (local project font)
- Strongest visual element: maroon cursor and network lines behind a real local agent UI

## Source notes and factual guardrails
- PDF visual directions are adapted into a 5:00 cut; its full script target is 7:00–7:30.
- Use project screenshots and a clean opening workspace still cropped from the supplied 67-second `Images_and_videos/agentChat.mp4`. The remaining source recording contains personal browser/chat details and is excluded.
- Use fictional agent names and example messages. Do not show API keys, Telegram bot tokens, personal paths, or personal accounts.
- Do not claim open-source support, enterprise/team features, macOS/Linux support, or one-click install.
- Do not say messages go “nowhere else.” Agent prompts are sent to the selected model provider; optional public web search uses Firecrawl, and Telegram traffic passes through Telegram.
- Do not imply scheduled jobs catch up after downtime. Missed runs are skipped and recorded.
- New agents default to allowing file creation, file changes, and shell commands; permissions should be shown as something users can configure.

## Share copy (draft)
Meet StingClaw: named AI agents on your Windows computer, with configurable permissions and changes waiting for your review.

## Audio direction
- Role: restrained cinematic support, with a quiet music bed and sparse interface accents.
- Music: bundled Happy Beats / Business Moves vol. 12, used quietly and looped cleanly to cover the five-minute runtime.
- Music treatment: slow fade-in, low steady level, occasional gentle swells at the product and review reveals, smooth fade-out before the closing card.
- Music cue guidance: the bundled vol. 12 cue preset is empty; use natural timing and no forced beat sync.
- Audio-reactive treatment: subtle background-light presence only; no generic visualizer graphics.
- SFX posture: sparse and motion-matched; never mask product content.
- Audio-coupled moments: quiet cursor pulse, menu/agent selection, review decision, closing logo.
- Restraint rule: no loud trailer booms, dense ticking, or voiceover.

## Storyboard

### Scene 1 — The hook — 22s
Black-charcoal canvas. A maroon block cursor blinks, a short project task types in, then pauses at the words “before anything changes.” StingClaw mark lands. Product colors and type only.
Sequential/interaction: type one short line, then show a diff cursor stopping before a file change.
Audio intent: low, curious start; one quiet UI tick.
Audio-coupled idea: cursor blink and logo land get soft accents.
Music: low cinematic pulse begins and fades up.
Transition mood: dramatic, restrained → Scene 2

### Scene 2 — What is StingClaw — 23s
Use the actual web-app screenshot and screen recording. Slow camera move across agent list, chat, and local status. On-screen labels: “Local web app”, “Named agents”, “Telegram”.
Sequential/interaction: frame agent selection, then the conversation and local status.
Audio intent: informative and calm.
Audio-coupled idea: three labels reveal in order and remain readable.
Music: steady, low.
Transition mood: soft crossfade → Scene 3

### Scene 3 — Who it is for — 23s
Three restrained cards: “Developers”, “Technical power users”, “Routine project tasks”. Each card gets a specific example: inspect a codebase, research a question, prepare a repeatable task. Use product UI as the background anchor.
Sequential/interaction: show one persona and one grounded task at a time.
Audio intent: confident, direct.
Audio-coupled idea: card reveal accents only.
Music: steady.
Transition mood: clean slide → Scene 4

### Scene 4 — Getting started — 24s
Show the GitHub clone, Bun install, and `bun run dev` commands in a terminal-style panel. Cut to the local browser address and OpenRouter key settings with a fictional masked placeholder only.
Sequential/interaction: commands appear in order, then show the local app opening.
Audio intent: practical and unhurried.
Audio-coupled idea: light typing, no per-character sound spam.
Music: restrained.
Transition mood: terminal wipe → Scene 5

### Scene 5 — Multiple agents — 28s
Recreate the agent list and settings from the real interface: “Reznov · General purpose” and “Research · Read-only research”. Show separate instructions, model selection, key order, and permission toggles. Do not promise unlimited agent count.
Sequential/interaction: create an agent, then change its model/permissions in order.
Audio intent: useful, grounded.
Audio-coupled idea: soft UI selection sounds on two actions.
Music: slightly brighter, still quiet.
Transition mood: smooth lateral move → Scene 6

### Scene 6 — Three modes — 28s
Three panels carry “Ask”, “Plan”, and “Agent”. Ask reads and searches files and responds; Plan returns up to 15 read-only steps for the user to choose; Agent uses enabled tools and stages changes for review.
Sequential/interaction: one panel activates at a time; show the real limits as small, readable supporting labels.
Audio intent: distinguish capabilities without hype.
Audio-coupled idea: a gentle switch accent between panels.
Music: steady.
Transition mood: precise wipe → Scene 7

### Scene 7 — You stay in control — 30s
Centerpiece: show a realistic proposed diff in the app. The task status says “Waiting for your review”. Inspect the diff; demonstrate one approval and a second rejection as separate examples. Never show a change applying without the explicit review action.
Sequential/interaction: task completes → review card opens → diff is inspected → approve; then a distinct proposal is rejected.
Audio intent: reassuring payoff.
Audio-coupled idea: subtle clicks; one restrained confirmation sound for each decision.
Music: controlled swell at the first review card.
Transition mood: deliberate crossfade → Scene 8

### Scene 8 — Power features — 22s
Show one agent asking up to three saved agents for read-only research, a supported skill file being selected, and an optional public web page result labeled Firecrawl. Keep claims conditional on configuration.
Sequential/interaction: three quick, legible feature demonstrations.
Audio intent: capable, not overwhelming.
Audio-coupled idea: three soft accents, one per feature.
Music: low rhythmic movement.
Transition mood: quick clean cuts → Scene 9

### Scene 9 — Telegram — 26s
Use `telegram_ss.png` or a phone mockup based on the screenshot. Show pairing as a setup prerequisite; send a task to a saved agent; receive progress; show review controls. Note that the computer and StingClaw service must be running.
Sequential/interaction: pair → send → progress → review request.
Audio intent: connected but realistic.
Audio-coupled idea: light message arrival, no notification barrage.
Music: warm and steady.
Transition mood: phone-to-desktop match cut → Scene 10

### Scene 10 — Memory, schedules, background service — 30s
Show saving a useful preference, then creating a daily or weekly job with time zone and permissions. Show a run history and the Windows background-service setting. On-screen note: “Missed runs are skipped and recorded.”
Sequential/interaction: save memory → schedule job → show run record → toggle background service.
Audio intent: dependable and precise.
Audio-coupled idea: gentle toggle and status accent.
Music: steady, slight lift.
Transition mood: smooth crossfade → Scene 11

### Scene 11 — Privacy and limits — 24s
Show local SQLite storage and Windows user-level encryption for saved keys. A clear data-flow diagram labels the local computer, selected model provider (OpenRouter), optional public web search (Firecrawl), and Telegram. State: Windows supported today; computer/service must remain on for background tasks.
Sequential/interaction: animate data paths one by one and hold each label.
Audio intent: transparent, calm.
Audio-coupled idea: restrained line-draw tones.
Music: minimal.
Transition mood: quiet fade → Scene 12

### Scene 12 — Close — 20s
Return to the maroon cursor and logo. Hold “Your agents. Your keys. Your computer. Your call.” End with the landing page `https://stingclaw.onrender.com/` and repository `https://github.com/csakib049/StingClaw`.
Sequential/interaction: logo resolves, then URLs fade on and hold.
Audio intent: confident close with a clean tail.
Audio-coupled idea: one soft logo accent, then silence at the end.
Music: fade out over the last seconds.
Transition mood: resolved end card.

**Music mood for this video:** restrained cinematic.
**Audio summary:** Quiet underscore carries the story, with a few clean interface sounds at meaningful product moments and a gentle final logo accent.
