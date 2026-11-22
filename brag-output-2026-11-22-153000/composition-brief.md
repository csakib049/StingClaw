# Hyperframes Composition Brief: StingClaw

## Objective
Create a restrained, polished five-minute SaaS product launch film for StingClaw. Keep all 12 sections from the supplied PDF's on-screen outline, compressed to 300 seconds. Use chapter titles, product demonstrations, interface typography, and an end card. No narration is requested; use music and sparse interface SFX only.

## Output
- Composition directory: `brag-output-2026-11-22-153000/composition/`
- Rendered video: `brag-output-2026-11-22-153000/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 300 seconds

## Source Material
- Project root: `D:/StingClaw`
- Primary files read: `README.md`, `package.json`, `landing/content.json`, `landing/styles.css`, app UI source and feature documentation.
- Product name: StingClaw
- Strongest claim: named AI agents run on your computer, and proposed file and shell changes wait for your review.
- Real product materials: landing screenshots/assets and `Images_and_videos/agentChat.mp4`, `telegram_ss.png`, `Logo.png`.
- Keep personal data out. Use fictional sample agent names and text. Avoid showing raw user messages, local paths, account names, keys, tokens, or personal identifiers in supplied captures; crop/cover any such areas or recreate the panel as a fictional UI.
- Copy that must appear verbatim:
  - “AI agents that run on your computer.”
  - “Nothing changes until you review it.”
  - “Your agents. Your keys. Your computer. Your call.”

## Creative Direction
- Tone preset: cinematic
- Creative direction: quiet, confident developer product launch; dark canvas, maroon light, real UI details, grounded claims
- Interpretation: cinematic scale through camera movement and typography, not exaggerated claims or loud effects.
- Angle: an agent can help on the computer while the person stays in control of its access and every proposed change.
- Hook: a maroon cursor pauses before a change can reach a file.
- Outro: resolve to the maroon cursor, StingClaw mark, and live site/repository links.
- Avoid generic SaaS language, invented metrics, abstract filler, misleading data-privacy claims, and exposure of personal data.

## Visual Identity
- Background: #111114
- Text: #E5E1E4
- Accent: #C32148
- Display font: JetBrains Mono; use bundled local font asset
- Body font: JetBrains Mono
- Visual references: the animated landing-page hero network, the local agent/chat interface, approvals diff, agent settings, Telegram screen, StingClaw mark.

## Storyboard
Use the 12 scenes and timings in `brag-plan.md`. Each chapter has its own visual state and a clear readable title; do not present this as a slide deck. The central demo is the task-to-review flow. Use source screenshots/recording only after removing any personal content visible in them.

Scene summary:
1. The hook — 22s — cursor, task, stop-before-change promise
2. What is StingClaw — 23s — local app and agent interface
3. Who it is for — 23s — developers, technical users, recurring project tasks
4. Getting started — 24s — clone, install, run, local URL, API key setup
5. Multiple agents — 28s — named agents and configuration
6. Three modes — 28s — Ask, Plan, Agent, accurately distinguished
7. You stay in control — 30s — staged diff, approve/reject outcomes
8. Power features — 22s — read-only agent collaboration, skills, optional Firecrawl
9. Telegram — 26s — pairing, task updates, review controls
10. Memory, schedules, background — 30s — user-defined schedules and background requirements
11. Privacy and honesty — 24s — local storage and real provider data flows
12. Close — 20s — logo and links

## Audio
- Audio role: quiet cinematic bed with sparse interface accents
- Audio arc: restrained opening, gentle lifts at product/review moments, clean ending
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, loop or extend carefully to 300s
- Music treatment: start and end fades; keep unobtrusive below any UI SFX
- Music cue guidance: bundled vol. 12 cue preset is empty; natural timing, no forced sync
- Audio-reactive treatment: subtle maroon background light only; no waveform/equalizer graphics
- Audio-coupled moments: menu selection, approval decision, Telegram message, logo resolve
- SFX selection: sparse and quiet; match actual interface gestures
- Audio files: local copies under `composition/assets/`

## Hyperframes Instructions
- Use one seek-safe composition with a finite 300-second root duration.
- Use a single paused timeline registered under the matching composition ID.
- No page-load animation loops, wall-clock reads, unseeded randomness, network media, or playback calls; any repeat must be bounded by the finite composition duration.
- Keep all source media local. Mute captured media if its sound is not intentionally part of the film.
- If captured text has personal data, crop/cover it or use a faithful fictional mockup instead.
- Run `npx hyperframes check` before rendering. Render locally only.
