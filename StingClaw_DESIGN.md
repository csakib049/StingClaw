# StingClaw Design System

Design specification for the StingClaw landing page (v1).
Product: a local-first workspace for running several named AI agents, used from a web interface on your computer or from Telegram.
Audience: developers and technical power users who want agents they control, running on their own machine with their own API keys.

This document is written for an AI coding agent (Claude Code, Codex, OpenCode) to implement without guessing. Every value is exact. When this file and your instincts disagree, this file wins.

---

## 0. Read this first

### 0.1 Direction

The page follows the structure of modern open developer-tool sites (announcement bar, hero with "where you can use it" rows next to the real product, short "why" pillars, mode tabs, FAQ), rendered in StingClaw's own language: JetBrains Mono, Deep Charcoal, Bright Maroon, and the claw cursor.

Borrow structure only. Do not copy any other site's copy, logos, imagery, video, or fonts.

### 0.2 Product ground truth (verified against the repository, v0.0.1)

Marketing copy may state only things in this list, or things the owner confirms. Items tagged `[VERIFY]` in this document need owner confirmation before launch.

- Runs locally. A local web interface and a background service; tasks continue after the browser closes while the computer and service are running.
- Multiple named agents, each with a name, description, instructions, a model, API keys, and permissions.
- Three working modes in code: **Ask**, **Plan**, **Agent**.
- Agent tools: read, create, modify, and delete files and folders; list and search files; analyze a codebase; run shell commands; use skills; delegate work to another agent.
- Proposed file changes and shell actions are collected and shown for review (grouped per file, with diffs) before they are applied. `[VERIFY]` exact behavior in the web UI per permission setting.
- Telegram access to the same agents, and scheduled jobs.
- Data stored locally in a SQLite file at `~/.stingclaw/stingclaw.sqlite`.
- Models are reached through OpenRouter with the user's own API keys.
- API keys are encrypted with **Windows DPAPI only**; the code throws on other platforms. Do not claim macOS or Linux support.

### 0.3 Not true yet (never claim, never imply)

- "Open source" or "MIT": the repo has no LICENSE file and an empty README. Publish a license first, or omit.
- A one-line installer (`curl ... | bash`), a package-manager install, or an app download. Today setup is clone, install with Bun, and run.
- "Enterprise", SSO/SAML, SOC 2 or other compliance, VPC/on-prem/cloud hosting, team accounts, sign-in.
- Customer logos, user counts, token counts, uptime, testimonials, awards.
- Cross-platform secure key storage.
- Pricing. Decide it first.

### 0.4 Placeholder policy

- `[PLACEHOLDER]`: invented copy for layout only. Do not ship.
- `[VERIFY]`: probably true, owner must confirm.
- `[CONDITIONAL]`: render only if its condition becomes true (for example, the repo is public and licensed).
- All marketing strings live in one content file so these tags are easy to find.

### 0.5 Build order for agents

1. Tokens, fonts, base styles. 2. Navigation, hero. 3. Remaining sections top to bottom. 4. Component states. 5. Motion. 6. Accessibility and responsive pass. Screenshot at 1440, 768, and 390 px after each step and compare with this spec.

---

## 1. Brand and design principles

**The look in one line:** a calm dark console with one recurring mark, the maroon block cursor, and the real product on display.

### 1.1 Principles

1. **Show the real product.** The hero visual is the actual StingClaw interface (screenshot or faithful HTML replica), not an abstract illustration or a fake terminal.
2. **Charcoal dominates.** Deep Charcoal family surfaces are at least 85% of any viewport.
3. **Maroon is a signal, not a theme.** Bright Maroon marks the one thing that matters in a viewport (primary action, active step, the cursor). Budget: at most 5% of any viewport's pixels. Soft Maroon: at most 3%.
4. **One memorable element.** The claw cursor (1.2). Nothing else competes with it for distinctiveness.
5. **Monospace with hierarchy.** JetBrains Mono everywhere; hierarchy comes from size, weight, color, and spacing, not from all-caps or decoration.
6. **Structure carries information.** Borders, rules, numbers, and labels appear only where they encode something real (a true sequence, a status, a boundary).
7. **Flat and precise.** No drop-shadow cards, no glass, no large radii. Depth comes from surface steps and 1px borders.
8. **Restraint in motion.** One orchestrated moment on load. Everything else responds to the user.
9. **Claim only what's true.** An honest, specific page beats an impressive invented one. Section 0.2 and 0.3 are binding.

### 1.2 The claw cursor (signature element)

Implemented in CSS, not as a glyph, so it renders identically everywhere.

```css
.sc-cursor {
  display: inline-block;
  width: 0.55ch;
  height: 1.05em;
  background: var(--sc-brand);
  vertical-align: -0.15em;
  margin-left: 0.15ch;
}
.sc-cursor--blink { animation: sc-blink 1.06s steps(1) infinite; }
@keyframes sc-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .sc-cursor--blink { animation: none; } }
```

Permitted uses (only these):
- Wordmark: `stingclaw` + cursor.
- Favicon: 32x32 `#111114` square with a centered `#C32148` block (10x18 px).
- The "running" state in buttons and transcripts (`running` + blinking cursor).
- The composer prompt inside the hero app frame.
- End of the final CTA headline, static, once per page.

Not permitted: bullets, dividers, list markers, hover decoration on every link, skeleton loaders.

### 1.3 Voice

Plain, specific, developer to developer. Speak to "you" and "your computer". Sentence case. Active verbs. Headlines of 8 words or fewer. Buttons name the action ("Get StingClaw", "Read the docs"), never "Learn more".

| Instead of | Write |
|---|---|
| "Leverage autonomous AI orchestration" | "Agents that run on your computer" |
| "Enterprise-grade security" | "Changes wait for your approval" |
| "Seamless multi-channel experience" | "Chat from the web or from Telegram" |

---

## 2. Color

### 2.1 Core palette (brand-provided, exact)

| Name | Hex | Role |
|---|---|---|
| Deep Charcoal | `#111114` | Page background |
| Bright Maroon | `#C32148` | Primary accent: fills, active markers, cursor, large display accents |
| Soft Maroon | `#B5406C` | Secondary accent: tints, secondary markers, human-in-loop elements |
| Off White | `#E5E1E4` | Primary text |

### 2.2 Full token set

Prefix `--sc-`. Use tokens, never raw hex, in components.

**Surfaces**

| Token | Hex | Use |
|---|---|---|
| `--sc-bg-base` | `#111114` | Page, default section background |
| `--sc-bg-inset` | `#0C0C0F` | Terminals, code blocks, app frames, input wells, modes and approvals sections, footer |
| `--sc-bg-raised` | `#17171B` | Cards, panels, CTA panel |
| `--sc-bg-elevated` | `#1E1E23` | Hovered rows, selected tabs, menus, popovers, disabled fills |
| `--sc-bg-scrim` | `rgba(12,12,15,0.80)` | Mobile menu backdrop, modals |

**Text**

| Token | Hex | Use |
|---|---|---|
| `--sc-text-primary` | `#E5E1E4` | Headings, body, key labels |
| `--sc-text-secondary` | `#B8B3B9` | Supporting body, nav links (default) |
| `--sc-text-muted` | `#8E8A91` | Captions, metadata, placeholders, inactive tabs |
| `--sc-text-faint` | `#6B676E` | Disabled text, line numbers, decorative only. Never for meaningful text. |
| `--sc-text-on-brand` | `#FFFFFF` | Text on any maroon fill |
| `--sc-text-accent` | `#E8587A` | Small accent text and links on dark (lighter tint of Bright Maroon, passes AA) |
| `--sc-text-accent-soft` | `#D0698F` | Small secondary accent text (tint of Soft Maroon, passes AA) |

**Brand**

| Token | Value | Use |
|---|---|---|
| `--sc-brand` | `#C32148` | Primary button fill, cursor, active step border |
| `--sc-brand-hover` | `#CC2A52` | Primary button hover |
| `--sc-brand-active` | `#A81C3E` | Primary button pressed |
| `--sc-brand-tint` | `rgba(195,33,72,0.12)` | Active node fill, brand badge fill |
| `--sc-brand-border` | `rgba(195,33,72,0.50)` | Brand badge / active outline |
| `--sc-soft` | `#B5406C` | Secondary markers, human-approval node border |
| `--sc-soft-tint` | `rgba(181,64,108,0.12)` | Secondary badge fill |
| `--sc-soft-border` | `rgba(181,64,108,0.45)` | Secondary badge / dashed borders |

**Borders**

| Token | Hex | Use |
|---|---|---|
| `--sc-border-subtle` | `#26262C` | Dividers, card edges, section rules |
| `--sc-border-default` | `#34343B` | Secondary button resting border, connector lines |
| `--sc-border-strong` | `#4A4A53` | Hovered card edge, secondary button border |
| `--sc-border-control` | `#6B676E` | **Form control borders** (needs 3:1 against background per WCAG 1.4.11) |

**Status**

| Token | Hex | Use |
|---|---|---|
| `--sc-success` | `#5CCB8B` | Succeeded, operational |
| `--sc-warning` | `#E3B341` | Needs attention, awaiting approval |
| `--sc-error` | `#FF7A59` | Failed, validation error (coral, deliberately distinct from maroon) |
| `--sc-success-tint` / `--sc-warning-tint` / `--sc-error-tint` | same hue at `0.12` alpha | Badge fills |
| `--sc-diff-add-bg` | `rgba(92,203,139,0.10)` | Added line in a diff |
| `--sc-diff-del-bg` | `rgba(255,122,89,0.10)` | Removed line in a diff |

There is no info color. Informational states use `--sc-text-secondary` with an icon.

### 2.3 Contrast (measured, WCAG 2.x relative luminance)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#E5E1E4` | `#111114` | 14.56 | AAA, all text |
| `#E5E1E4` | `#17171B` | 13.81 | AAA |
| `#B8B3B9` | `#111114` | 9.14 | AAA |
| `#8E8A91` | `#17171B` | 5.27 | AA, captions and placeholders OK |
| `#8E8A91` | `#1E1E23` | 4.90 | AA |
| `#FFFFFF` | `#C32148` | 5.78 | AA, button labels |
| `#FFFFFF` | `#CC2A52` | 5.22 | AA, hover |
| `#FFFFFF` | `#B5406C` | 5.36 | AA |
| `#E8587A` | `#111114` | 5.48 | AA, small accent text |
| `#E8587A` | `#1E1E23` | 4.83 | AA |
| `#D0698F` | `#17171B` | 5.19 | AA |
| `#FF7A59` | `#17171B` | 6.96 | AA |
| `#6B676E` | `#111114` | 3.40 | Controls/borders only, never text |
| **`#C32148`** | **`#111114`** | **3.26** | **Fails AA for normal text.** Large text (24px+, or 18.66px+ bold) and graphics only. |
| **`#B5406C`** | **`#111114`** | **3.51** | **Fails AA for normal text.** Same restriction. |
| **`#E5E1E4`** | **`#C32148`** | **4.47** | **Fails AA by 0.03.** Use `#FFFFFF` on maroon fills, not Off White. |

**Rules that follow from this:**
- Never set small text in `--sc-brand` or `--sc-soft`. Use `--sc-text-accent` / `--sc-text-accent-soft`.
- Label text on any maroon fill is `#FFFFFF`.
- Bright Maroon as a headline accent is allowed only at 24px or larger.
- Brand maroon never appears as an error color. Errors use `--sc-error` (coral) plus an icon plus text, so the brand hue never signals failure.

### 2.4 Gradients and glow (the complete list)

Only these exist. Do not add others.

| Name | Value | Where |
|---|---|---|
| Hero wash | `radial-gradient(60% 55% at 80% -5%, rgba(195,33,72,0.16), transparent 70%)` | Behind the hero, top-right |
| CTA wash | `radial-gradient(55% 80% at 100% 0%, rgba(195,33,72,0.14), transparent 70%)` | Final CTA panel |
| App-frame halo | `0 0 0 1px rgba(195,33,72,0.20), 0 24px 64px -16px rgba(195,33,72,0.18)` | Hero app frame only |
| Button glow | `0 0 24px rgba(195,33,72,0.28)` | Primary button hover only |
| Active-node glow | `0 0 20px rgba(195,33,72,0.22)` | Currently executing flow node only |
| Top hairline | `linear-gradient(90deg, transparent, #C32148 50%, transparent)`, 1px tall | Top edge of the hero app frame and the CTA panel |

Maximum glow alpha anywhere: 0.28. Never stack two glows in one viewport region.

---

---

## 3. Typography

### 3.1 Family and loading

Single family: **JetBrains Mono** (SIL OFL 1.1, free to self-host).

```css
--sc-font: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
```

- Self-host a variable woff2, Latin subset, weight axis 400-700 only. Package: `@fontsource-variable/jetbrains-mono` (or download from the JetBrains/JetBrainsMono repo). Do not load from a third-party CDN in production.
- `font-display: swap`. Preload the regular-weight file. Tune a size-adjusted fallback so layout shift stays under CLS 0.1.
- Weights used: 400, 500, 600, 700. Weight 700 is reserved for the wordmark.
- Global: `font-feature-settings: "calt" 0;` and `font-variant-ligatures: none;` for prose and UI. Enable ligatures (`"calt" 1`) inside code blocks and terminals only.
- `font-variant-numeric: tabular-nums` is already inherent in mono; do not add right-aligned number tricks.

### 3.2 Mono-specific rules

- One character is `0.6em` wide. A monospace face fits roughly 20% fewer characters per line than a typical sans at the same size. Scale type down accordingly and cap line length by characters, not pixels.
- Body max line length: **64ch**. Hero subtext: **56ch**. Never justify. Left-align everything except where noted.
- Headlines: `text-wrap: balance`. Body: `text-wrap: pretty`. `overflow-wrap: anywhere` on tokens like URLs and IDs.
- Sentence case everywhere. Uppercase is allowed only for status badges (11px, tracked). No all-caps eyebrow above every heading. An eyebrow label is allowed only where it names a real category (for example "Security" over a security block).

### 3.3 Scale

Desktop is >= 1024px. Tablet 768-1023. Mobile < 768.

| Token | Desktop | Tablet | Mobile | Weight | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `display` | 56/60 | 44/48 | 34/38 | 600 | -0.03em | Hero headline only |
| `h2` | 36/42 | 30/36 | 26/32 | 600 | -0.025em | Section headings |
| `h3` | 20/28 | 20/28 | 18/26 | 600 | -0.01em | Card and block titles |
| `h4` | 16/24 | 16/24 | 16/24 | 600 | 0 | Sub-blocks, accordion triggers |
| `body-lg` | 18/30 | 17/28 | 16/26 | 400 | -0.005em | Hero subtext, section intros |
| `body` | 15/26 | 15/26 | 15/26 | 400 | 0 | Default body |
| `body-sm` | 13/22 | 13/22 | 13/22 | 400 | 0 | Card descriptions, dense UI |
| `nav` | 14/20 | 14/20 | 18/28 (menu sheet) | 500 | 0 | Navigation |
| `button` | 14/20 | 14/20 | 14/20 | 600 | 0.01em | Buttons |
| `label` | 12/16 | 12/16 | 12/16 | 500 | 0.02em | Form labels, table headers |
| `badge` | 11/16 | 11/16 | 11/16 | 600 | 0.08em, uppercase | Status/category badges |
| `caption` | 12/18 | 12/18 | 12/18 | 400 | 0 | Captions, footnotes |
| `meta` | 11/16 | 11/16 | 11/16 | 400 | 0.02em | Timestamps, IDs in terminals |
| `code` | 13/22 | 13/22 | 12.5/21 | 400 | 0 | Code and terminal body |
| `stat` | 40/44 | 36/40 | 32/36 | 500 | -0.02em | Numeric callouts (use sparingly) |
| `wordmark` | 18/24 | 18/24 | 18/24 | 700 | -0.02em | Logo only |

Hierarchy differentiators to use instead of case or size alone: weight steps (400 / 500 / 600), the four text colors, and spacing (headline-to-body gap of 24px on desktop).

Hero headline length guide: at 56px with -0.03em tracking, one character is about 32px, so an 8-column span (~780px) holds roughly 24 characters per line. Write headlines of 8 words or fewer that wrap to at most 3 lines. Test with real copy before approving.

---

## 4. Layout, spacing, shape

### 4.1 Spacing scale (4px base)

| Token | px | Token | px |
|---|---|---|---|
| `--sc-space-1` | 4 | `--sc-space-8` | 32 |
| `--sc-space-2` | 8 | `--sc-space-10` | 40 |
| `--sc-space-3` | 12 | `--sc-space-12` | 48 |
| `--sc-space-4` | 16 | `--sc-space-16` | 64 |
| `--sc-space-5` | 20 | `--sc-space-20` | 80 |
| `--sc-space-6` | 24 | `--sc-space-24` | 96 |
| | | `--sc-space-32` | 128 |

Do not use values outside the scale.

### 4.2 Containers and grid

| Token | Value | Use |
|---|---|---|
| `--sc-container` | 1200px max, centered | Default content |
| `--sc-container-wide` | 1320px max | Announcement bar, nav, hero (app frame), flow diagram |
| `--sc-prose` | 64ch | Text blocks |
| Page gutter | 24px (>= 768), 20px (< 768) | Left/right padding |

Grid: 12 columns >= 1024 (gap 24px), 8 columns 768-1023 (gap 20px), 4 columns < 768 (gap 16px). Beyond 1536px the container stays capped and the page background extends; do not scale type or spacing up.

### 4.3 Section rhythm

| Breakpoint | Section padding (top and bottom) | Heading-to-content gap |
|---|---|---|
| >= 1024 | 128px | 64px |
| 768-1023 | 96px | 48px |
| < 768 | 72px | 40px |

Sections are separated by background change or a 1px `--sc-border-subtle` rule, never both. Alternate `--sc-bg-base` and `--sc-bg-inset` only where listed in section 6.

### 4.4 Shape and edges

| Token | Value | Use |
|---|---|---|
| `--sc-radius-xs` | 2px | Badges |
| `--sc-radius-sm` | 4px | Buttons, inputs, cards, workflow nodes |
| `--sc-radius-md` | 6px | Terminals, code blocks, large panels |
| `--sc-radius-full` | 9999px | Status dots only |

Borders are always 1px, solid (dashed only for human-approval nodes). No box shadows on cards. Menus and popovers only: `0 12px 32px rgba(0,0,0,0.5)` plus a 1px `--sc-border-default` border.

### 4.5 Breakpoints

| Name | Min width | Behavior summary |
|---|---|---|
| `xs` | 0 | Single column, stacked CTAs, vertical workflow |
| `sm` | 480 | Buttons may sit side by side |
| `md` | 768 | 8-column grid, two-column feature rows, inline nav still collapsed |
| `lg` | 1024 | 12-column grid, full nav, hero two-column |
| `xl` | 1280 | Container reaches 1200px content width |
| `2xl` | 1536 | Layout capped; no further scaling |

Minimum supported width: 320px with no horizontal scroll (except inside code blocks and the tab list).

---

## 5. Components

All interactive components share: focus ring `outline: 2px solid #E8587A; outline-offset: 3px;` (visible on `:focus-visible` only), minimum touch target 44x44px, transitions 160ms `--sc-ease-out`.
### 5.1 Buttons

| Size | Height | Padding X | Use |
|---|---|---|---|
| `sm` | 36px | 14px | Navigation CTA |
| `md` | 44px | 20px | Default |
| `lg` | 52px | 24px | Hero and final CTA |

Radius `--sc-radius-sm` (4px). Label uses the `button` type token. Sentence case. No trailing arrows or icons by default. If an icon is needed, 16px, 8px gap, left of the label.

**Primary**

| State | Spec |
|---|---|
| Default | bg `#C32148`, text `#FFFFFF`, no border |
| Hover | bg `#CC2A52`, glow `0 0 24px rgba(195,33,72,0.28)` |
| Active | bg `#A81C3E`, glow off, `translateY(1px)` |
| Focus-visible | Default + focus ring |
| Disabled | bg `#1E1E23`, text `#6B676E`, border `1px #26262C`, `cursor: not-allowed`, no hover |
| Loading | Label becomes `running` followed by `.sc-cursor--blink`; `aria-busy="true"`; width locked to prevent shift |

**Secondary**

| State | Spec |
|---|---|
| Default | bg transparent, text `#E5E1E4`, border `1px #4A4A53` |
| Hover | bg `#1E1E23`, border `#6B676E` |
| Active | bg `#17171B`, `translateY(1px)` |
| Focus-visible | Default + focus ring |
| Disabled | text `#6B676E`, border `#26262C`, no hover |

**Text button (tertiary):** text `#E5E1E4`, 1px underline in `#4A4A53` at 4px offset. Hover: underline `#E8587A`. Used for "Sign in", inline "Read the docs".

Rule: one primary button per viewport region. Pair it with a secondary, never with another primary.
### 5.2 Navigation links

Default `#B8B3B9`, `nav` type. Hover `#E5E1E4`. Current page: `#E5E1E4` with a 2px `#C32148` underline at 8px offset. Focus-visible: ring. Padding 8px 12px so the hit area is at least 44px tall including the bar. No dropdown in v1; if added, menu surface is `--sc-bg-elevated` with the popover shadow and 4px radius.
### 5.3 Badges and labels

`badge` type, padding 2px 8px, radius 2px, 1px border.

| Variant | Fill | Border | Text |
|---|---|---|---|
| Neutral | `#1E1E23` | `#34343B` | `#B8B3B9` |
| Brand | `--sc-brand-tint` | `--sc-brand-border` | `#E8587A` |
| Secondary | `--sc-soft-tint` | `--sc-soft-border` | `#D0698F` |
| Success | success-tint | success @ 0.40 | `#5CCB8B` |
| Warning | warning-tint | warning @ 0.40 | `#E3B341` |
| Error | error-tint | error @ 0.40 | `#FF7A59` |

Badges are not interactive. If a badge must be clickable, make it a button with the secondary button states instead.
### 5.4 Feature cards

- bg `--sc-bg-raised`, border `1px #26262C`, radius 4px, padding 24px (20px mobile), internal gap 16px.
- Structure: 20px line icon (stroke 1.5px, color `#8E8A91`), `h3` title in `#E5E1E4`, `body-sm` description in `#B8B3B9`. Optional footer: `caption` metadata in `#8E8A91`.
- **Static cards have no hover state.** Only cards that link somewhere get hover: border `#4A4A53` plus a 1px top rule in `#C32148` that draws left-to-right over 200ms (`transform: scaleX`, origin left). Focus-visible matches hover plus the focus ring.
- Do not make a grid of identical cards. Pillars use a ruled row (5.17); other sections mix tabs, split panels, and diff blocks.
### 5.5 Code blocks

- bg `--sc-bg-inset`, border `1px #26262C`, radius 6px, padding 16px 20px, `code` type, `overflow-x: auto`.
- Header bar (optional): 36px tall, bottom border `#26262C`, filename in `#8E8A91` (`meta`), copy button at right (secondary `sm` button, icon only, `aria-label="Copy code"`; on success the label changes to "Copied" for 1.5s and an `aria-live="polite"` region announces it).
- Line numbers: `#6B676E`, `aria-hidden`, `user-select: none`, 3ch gutter.

| Syntax token | Hex |
|---|---|
| Text / identifiers | `#E5E1E4` |
| Keywords | `#E8587A` |
| Strings | `#7FD99A` |
| Numbers / constants | `#E3B341` |
| Properties / types | `#B8B3B9` |
| Comments / punctuation | `#8E8A91` |

Keywords are the only maroon in syntax, which keeps code blocks from reading as red.
### 5.6 Terminal, command, and transcript blocks

Three related blocks share one visual base: bg `--sc-bg-inset`, border `1px #26262C`, radius 6px, `code` type. No window-control dots.

**Command block** (setup commands): single line (or a few), `$` prompt in `#8E8A91`, command in `#E5E1E4`, copy button at the right (secondary `sm`, icon only, `aria-label="Copy command"`; "Copied" for 1.5s with an `aria-live="polite"` announcement). Padding 12px 16px. Long commands scroll horizontally inside the block.

**Transcript block** (agent run, used inside the app frame 5.16 and the mode tabs): fixed height so animation cannot shift layout, newest line at the bottom, overflow hidden.

| Marker | Meaning | Color |
|---|---|---|
| `you` | User message label | `#8E8A91` |
| `✓` | Step completed | `#5CCB8B` |
| `▸` | Step running | `#E8587A` |
| `○` | Step queued | `#6B676E` |
| `!` | Waiting for approval | `#E3B341` |
| timestamp | `+0.4s`, right-aligned | `#8E8A91`, `meta` |

Tool rows read like the product: a verb, a target, and a result, for example `Read 4 files`, `Edited checkout.spec.ts +12 -3`, `Ran bun test`. The live prompt line ends with `.sc-cursor--blink`.

**Accessibility:** animated text is `aria-hidden="true"`. Provide one `role="img"` wrapper with an `aria-label` summarizing the run in a sentence. Under reduced motion or no-JS, render the final state.

### 5.7 Request-flow diagram

Used once, in "How a task flows" (6.9). Inline SVG or CSS grid plus SVG connectors.

- **Node:** bg `--sc-bg-raised`, border `1px #34343B`, radius 4px, padding 12px 16px, `label` title in `#E5E1E4`, `caption` subtitle in `#8E8A91`. Min width 136px.
- **Nodes, in order:** You (web or Telegram), Background service, Agent (model + tools), Your review, Your files. Node identity comes from the title text and a 12px glyph, never color alone.
- **Review node:** border `1px dashed #B5406C`, bg `--sc-soft-tint`, subtitle "Waits for you".
- **Executing node:** border `#C32148`, bg `--sc-brand-tint`, active glow (2.4). One at a time.
- **Connector:** 1px `#34343B`, orthogonal, 4px corner radius. Active path: 1px `#C32148`. A 4x4px `#C32148` square travels the active path (2.4s linear loop) only while in the viewport.
- Mobile (< 768): vertical stack, vertical connectors, node width 100%.
- Reduced motion: no traveling square; the active path stays highlighted.

### 5.8 Input fields

No form is required on the v1 landing page. Use these specs if one is added (for example a waitlist) and for any replica of the app's settings panel.

| Part | Spec |
|---|---|
| Label | `label` type, `#B8B3B9`, 8px above the control, always visible (never placeholder-only) |
| Control | height 44px (textarea min-height 120px), bg `--sc-bg-inset`, border `1px #6B676E`, radius 4px, padding 0 14px, text `#E5E1E4` 14/20, `caret-color: #E8587A` |
| Placeholder | `#8E8A91` |
| Helper text | `caption`, `#8E8A91`, 6px below |

| State | Change |
|---|---|
| Hover | border `#8E8A91` |
| Focus | border `#E8587A` plus `box-shadow: 0 0 0 2px rgba(232,88,122,0.35)` |
| Filled | no change |
| Error | border `#FF7A59`, message below in `#FF7A59` with a 14px icon and descriptive text ("Enter a work email like name@company.com"), `aria-invalid="true"`, linked via `aria-describedby` |
| Disabled | bg `#17171B`, border `#26262C`, text `#6B676E` |
### 5.9 Tabs

- Tab list: bottom border `1px #26262C`, horizontally scrollable on mobile with a 24px edge fade mask; scrollbar hidden but scrolling by keyboard and touch works.
- Tab: `nav` type, padding 12px 16px, `#8E8A91`. Hover `#E5E1E4`. Selected `#E5E1E4` with a 2px `#C32148` bottom indicator that slides between tabs (200ms). Focus-visible: ring.
- Panel: opacity-only crossfade, 160ms, no movement.
- Semantics: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, roving `tabindex`, Left/Right/Home/End keys, activation on focus.
### 5.10 Accordions

- Rows separated by `1px #26262C`. Trigger is a `<button>`, full width, `h4` type, padding 20px 0, `aria-expanded`, `aria-controls`.
- Indicator: a `+` that becomes `-` (mono glyphs, 14px) at the right, `#8E8A91`, `#E8587A` when open. Hover on trigger: text stays, indicator brightens to `#E5E1E4`.
- Panel: `body-sm` in `#B8B3B9`, padding-bottom 20px, max 64ch. Height animates 200ms via `grid-template-rows: 0fr -> 1fr`. No height animation under reduced motion.
- Focus-visible: ring around the full row.
### 5.11 Status indicators

| Status | Dot | Text color | Notes |
|---|---|---|---|
| Operational / succeeded | `#5CCB8B` | `#B8B3B9` | Static |
| Running | `#E8587A` | `#B8B3B9` | 2s opacity pulse (0.45 to 1) |
| Awaiting approval | `#E3B341` | `#B8B3B9` | Static |
| Failed | `#FF7A59` | `#B8B3B9` | Static, icon in addition to dot |
| Queued / idle | `#6B676E` | `#8E8A91` | Static |

Dot is 8px, `--sc-radius-full`. A text label always accompanies the dot (status is never color-only).
### 5.12 CTA component

Container bg `--sc-bg-raised`, border `1px #26262C`, radius 6px, padding 64px desktop / 40px 24px mobile, CTA wash, top hairline gradient. Contents: `h2` headline, `body-lg` supporting line (max 48ch), button row (primary `lg` + secondary `lg`), optional `caption` reassurance in `#8E8A91`. Left-aligned; at >= 1024 the button row sits right-aligned on the headline baseline.
### 5.13 Footer elements

Footer bg `--sc-bg-inset`, top border `1px #26262C`. Column headings `label` type in `#E5E1E4`. Links `body-sm`, `#8E8A91`, hover `#E5E1E4`, 12px vertical rhythm, 44px minimum hit height on mobile. Legal row: `caption` in `#8E8A91`, separated by a `#26262C` rule. A status link (dot + "All systems operational") is allowed only if wired to a real status feed.

---
### 5.14 Announcement bar

Optional. Render only for real news (a release, a new mode). If there is no news, do not render the bar.

- Height 40px, bg `--sc-bg-raised`, bottom border `1px #26262C`, content centered in `--sc-container-wide`.
- Contents: brand badge ("New"), `body-sm` sentence in `#B8B3B9` (max one line on desktop, two on mobile), text button link in `#E5E1E4`, dismiss button (44x44 hit area, 16px "x" glyph in `#8E8A91`, `aria-label="Dismiss announcement"`).
- Dismissal is remembered per announcement ID in `localStorage`, wrapped in try/catch.
- This is the only centered text block on the page.

### 5.15 Surface row

A compact row stating one place to use StingClaw. Rows stack in a bordered list.

```
| Web app          Chat with your agents in the browser.             [Open]  |
| Telegram         Message the same agents from your phone.         [Set up]  |
```

- Row: padding 16px 0, top border `1px #26262C` (list also has a bottom border), grid `[name 160px] [description 1fr] [action auto]`.
- Name: `h4`. Description: `body-sm` `#B8B3B9`. Action: secondary `sm` button or text button.
- Hover (row is not a link; only the action is): no change to the row. If the whole row is a link, hover bg `--sc-bg-raised` and the focus ring wraps the row.
- Mobile: name above description, action below at full width or hidden if it duplicates the primary CTA.

### 5.16 App frame (real-product visual)

Shows the actual interface in the hero and optionally in other sections.

- Container: bg `--sc-bg-inset`, border `1px #26262C`, radius 6px, overflow hidden, plus App-frame halo and top hairline (2.4) in the hero instance only.
- Contents, in order of preference: (1) an HTML replica built from these tokens, (2) a screenshot exported as AVIF/WebP at 2x with explicit `width` and `height` and descriptive `alt`.
- The replica must match the product's structure (agent sidebar, conversation, task status, composer) but use this design system's tokens, not the app's current CSS. Replica content uses the transcript grammar in 5.6.
- No fake browser chrome, no window dots, no device frames.
- Caption (optional) in `caption` type, `#8E8A91`, 12px below.
- The replica is decorative at the page level: wrap in `role="img"` with an `aria-label`, and hide inner text from assistive tech, or make the content real and navigable but not focusable.

### 5.17 Pillar block

Three columns separated by shared 1px `#26262C` borders (a ruled row, not separate cards).

- Each column: padding 32px 24px, `h3` title, `body` line in `#B8B3B9`, then a list of 3 facts (`body-sm`, `#B8B3B9`, items separated by 1px `#26262C` rules, no bullet glyphs), then a text button link.
- Column hover: none unless the column is a link.
- Tablet: stack to one column with horizontal rules. Mobile: same.

### 5.18 Diff block

Shows a file change awaiting approval. Extends the code block (5.5).

- Header (36px): file path in `meta` `#8E8A91` at left; counts at right: `+12` in `#5CCB8B`, `-3` in `#FF7A59`.
- Body lines: `code` type, line prefix character (`+`, `-`, or a space) in the first column, always present so color is never the only signal.

| Line | Fill | Prefix color |
|---|---|---|
| Added | `--sc-diff-add-bg` `rgba(92,203,139,0.10)` | `#5CCB8B` |
| Removed | `--sc-diff-del-bg` `rgba(255,122,89,0.10)` | `#FF7A59` |
| Context | none | `#6B676E` (aria-hidden) |
| Hunk header | none | `#8E8A91` |

- Footer (optional, 56px, top border `#26262C`): "Approve" (primary `sm`) and "Reject" (secondary `sm`). In the marketing page these are illustrative: buttons are not wired, use `aria-disabled="true"`, and a caption says "Illustration of the review step". Never present them as a live control.

### 5.19 Mode tabs

Tabs (5.9) with a larger panel: left text, right visual.

- Tab labels are the three modes: Ask, Plan, Agent. Selected tab shows a one-line description under the label on desktop.
- Panel layout (>= 1024): 5 columns of text (`h3`, `body`, a "Can" / "Can't" pair of short lists or a tools list), 7 columns of visual (a transcript block or app-frame crop for that mode).
- Panel text must reflect real mode behavior `[VERIFY]`.
- Tablet/mobile: visual below text, tab list scrolls horizontally.

---

---

## 6. Page sections

Order is fixed. Backgrounds: bar `--sc-bg-raised`, nav base, hero base, proof base, pillars base, modes inset, agents base, approvals inset, flow base, FAQ base, CTA base, footer inset. All copy below is `[PLACEHOLDER]` or `[VERIFY]` unless it comes from section 0.2.

### 6.1 Announcement bar `[CONDITIONAL]`

Component 5.14. Render only when there is real news. When absent, the nav is the first element on the page.

### 6.2 Navigation

```
| stingclaw▌    Modes  Agents  Approvals  FAQ  Docs  GitHub               [Get StingClaw] |
```

- Height 64px, sticky, bg `#111114` (solid, no blur), bottom border `1px #26262C` that fades in (opacity 0 to 1, 160ms) after 8px of scroll.
- Left: wordmark. Center-left: links, 8px gaps. The first four are in-page anchors with smooth scroll disabled under reduced motion. "Docs" and "GitHub" appear only if those destinations exist (`[CONDITIONAL]`).
- Right: one primary `sm` button "Get StingClaw" (goes to the setup block in the hero, or the repo). There is no "Sign in" because the product has no accounts.
- Type `nav`. Container `--sc-container-wide`.
- Mobile (< 1024): wordmark + a 44x44 menu button. Opens a full-screen sheet on `--sc-bg-base`: links at 18/28, 24px apart, primary `lg` CTA pinned at the bottom with safe-area padding. Focus trapped, Escape closes, body scroll locks.
- First focusable element is a "Skip to content" link: off-screen until focused, then bg `#E5E1E4`, text `#111114`.

### 6.3 Hero

```
lg+:
+------------------------------------------------------------------+
| AI agents that run              +-----------------------------+  |
| on your computer.               | app frame (real interface)  |  |
|                                 | sidebar | conversation      |  |
| body-lg subtext                 |         | ✓ Read 6 files    |  |
|                                 |         | ▸ Editing imports |  |
| [Get StingClaw] [Read the docs] |         | ! 3 changes wait  |  |
| $ bun run dev          [copy]   | composer ▌                  |  |
|                                 +-----------------------------+  |
| Web app      ... [Open]                                           |
| Telegram     ... [Set up]                                         |
| Background   ... [Learn how]                                      |
+------------------------------------------------------------------+
cols:  1-5 text, command, surface rows        6-12 app frame (bleeds to container edge)
```

- Padding: top 96px (72 tablet, 56 mobile), bottom 128px (96 / 72). bg `#111114` plus hero wash (2.4).
- Left column order: `display` headline in `#E5E1E4` (24px gap) -> `body-lg` in `#B8B3B9`, max 56ch (32px gap) -> buttons: primary `lg` + secondary `lg`, 16px gap (24px gap) -> command block (5.6) (40px gap) -> surface rows (5.15).
- Left-aligned. No eyebrow, no single-word accent in the headline.
- Right column: app frame (5.16), 520px tall at >= 1024. The frame plays the orchestrated moment once (7.2). Render the final state in the initial HTML.
- Tablet/mobile: stack in the order text, buttons, command, app frame, surface rows. App frame height 380px tablet, 320px mobile.
- Copy: headline "AI agents that run on your computer." Subtext "Create named agents, chat with them from the web or Telegram, and approve every change before it touches your files." `[VERIFY]`
- Command shown: `[PLACEHOLDER]` e.g. `bun install && bun run dev`. It must be the real, tested command. If setup needs more steps (API key, `.env`), link to the docs instead of pretending it is one line.
- Surface rows (real): Web app (local interface), Telegram (same agents from your phone), Background service (tasks keep running after you close the browser). A "Terminal" row only if the CLI is meant for users.

### 6.4 Proof strip

Replaces the "trusted by" logo row. It states four verifiable facts, not credentials.

- bg `#111114`, padding 48px top and bottom, top and bottom `1px #26262C` rules.
- Four items in one row (2x2 on tablet, 1 column on mobile), separated by 1px vertical rules. Each: `h4` statement in `#E5E1E4`, `caption` in `#8E8A91`.
- `[VERIFY]` items: "Runs on your computer" / "Your data stays in a local file"; "Your own API keys" / "Models through OpenRouter"; "You approve changes" / "Review diffs before they apply"; "Works from Telegram" / "Same agents, same conversations".
- No numbers, no logos, no stars, unless real and sourced. A GitHub star count is allowed only when the repo is public and the number is fetched live or build-time.

### 6.5 Pillars

```
+---------------------+---------------------+---------------------+
| Local first         | Your own keys       | You stay in control |
| line                | line                | line                |
| ---                 | ---                 | ---                 |
| fact                | fact                | fact                |
| ---                 | ---                 | ---                 |
| fact                | fact                | fact                |
| link                | link                | link                |
+---------------------+---------------------+---------------------+
```

- bg `#111114`. Section heading block: `h2` ("Built to stay on your side") plus `body-lg`, cols 1-7, left-aligned. Gap 64px, then the pillar row (5.17).
- Pillar 1, Local first: "Agents, chats, and settings live in a local SQLite file." / "Tasks keep running after you close the browser." / "No account needed." `[VERIFY]`
- Pillar 2, Your own keys: "Bring your OpenRouter keys." / "Pick a model per agent." / "No markup from StingClaw." `[VERIFY]` (depends on pricing decision)
- Pillar 3, You stay in control: "Changes wait for your approval." / "Per-agent permissions." / "Every action is logged." `[VERIFY]`
- `[CONDITIONAL]` Pillar "Inspectable": only if the repo is public and licensed. Then use four columns at >= 1280 or replace Pillar 3's third fact.

### 6.6 Modes

- bg `--sc-bg-inset`, top and bottom `1px #26262C` rules, padding 128px (96 / 72). Heading block: `h2` ("Three ways to work with an agent"), `body-lg`.
- Mode tabs (5.19): **Ask**, **Plan**, **Agent**.
  - Ask: questions and answers, no changes to your files. `[VERIFY]`
  - Plan: research and a written plan before any action, can use web tools. `[VERIFY]`
  - Agent: does the work with tools (files, shell, other agents) and waits for approval on changes. `[VERIFY]`
- The visual for each tab is a transcript block (5.6) showing a short, realistic exchange. Use tool names that exist in the product.

### 6.7 Agents

```
lg+:
 Text (cols 1-5)                         Settings panel mock (cols 6-12)
 h2 + body-lg                            name / label / description
 4 short facts                           model / keys / permissions
                                         allowed tools  [x] read  [ ] shell ...
```

- bg `#111114`. Left: `h2` ("An agent for each job"), `body-lg`, then 4 facts as a ruled list: "Each agent has its own instructions, model, and keys." "Agents can hand work to other agents." "Permissions are set per agent." "Schedule recurring jobs." `[VERIFY]`
- Right: a replica of the agent settings panel in an app frame (5.16, no halo). Shows real fields: name, label, description, model, allowed tools with checkboxes.
- Below, optional row of example agent names as neutral badges: Executive Assistant, Research, Writing, Finance (from the product plan; examples, not shipped templates unless true).
- Tablet/mobile: stacked, settings panel below text.

### 6.8 Approvals (the differentiator)

```
lg+:
 Diff block with Approve / Reject (cols 1-7)      Text (cols 8-12)
                                                   h2 + body-lg
                                                   2-3 facts
```

- bg `--sc-bg-inset`, top and bottom `1px #26262C` rules, padding 128px (96 / 72).
- Right text: `h2` ("Nothing changes until you say so"), `body-lg` ("Proposed file edits and shell commands are collected and shown as diffs. You approve or reject them."), then 2-3 facts. `[VERIFY]` that this holds for every permission setting; weaken the headline if not.
- Left: diff block (5.18) with a realistic small change, plus one line below in `caption`: "Illustration of the review step".
- Where your data lives: one `body-sm` line with the path in a code span `~/.stingclaw/stingclaw.sqlite`. Mention key encryption only with its real scope: "API keys are encrypted with Windows user-level encryption (DPAPI)." `[VERIFY]` Do not generalize.
- Reveal per 7.3.

### 6.9 How a task flows

```
 You  -->  Background  -->  Agent  -->  Your review  -->  Your files
 (web /     service         (model +     (approve or       (changes
 Telegram)                   tools)       reject)           applied)
```

- bg `#111114`. Heading block: `h2` ("How a task flows"), short `body-lg`.
- Request-flow diagram (5.7), full container width. Under it, four numbered steps (this is a true sequence, so `01`-`04` markers are allowed: `meta` type, `#8E8A91`) each with a `h4` and one `body-sm` line: Ask, Work, Review, Apply.
- Mobile: vertical, steps below the diagram.

### 6.10 FAQ

- bg `#111114`. Two columns at >= 1024: heading (cols 1-4: `h2` "Questions", `body` link to docs), accordion (cols 5-12, 5.10).
- Draft questions and answers `[VERIFY]` (keep each answer under 3 sentences):
  1. **What is StingClaw?** A local app for running named AI agents. Chat from a web interface on your computer or from Telegram.
  2. **Does my data leave my computer?** Agents, chats, and settings are stored locally. What you send to an agent goes to the model provider you choose through OpenRouter, and to the web tools if you use them.
  3. **Can an agent change my files without asking?** No. Proposed changes are shown for review first. State the exact rule per mode once confirmed.
  4. **Which models can I use?** Models available through OpenRouter, with your own API keys.
  5. **What do I need to run it?** Bun and an OpenRouter API key. Secure key storage currently uses Windows encryption, so Windows is the supported platform today.
  6. **Can I use it from my phone?** Yes, through Telegram. Your computer and the background service must be running.
  7. **Does it keep working when I close the browser?** Yes, while the computer and the background service are running.
  8. **Is it free and open source?** `[PLACEHOLDER]` Answer depends on the license and pricing decisions.

### 6.11 Final CTA

- bg `#111114`, padding 128px (96 / 72). One CTA component (5.12).
- Headline `h2`: "Set up your first agent." with one static `.sc-cursor` at the end. Supporting line: "Install it, add an API key, and talk to it from your browser or Telegram." `[VERIFY]` Buttons: "Get StingClaw" (primary `lg`), "Read the docs" (secondary `lg`).
- Mobile: buttons stack at full width, 12px gap.

### 6.12 Footer

```
 stingclaw▌ + one line            Product      Resources     Project
 (cols 1-4)                       Modes        Docs          License
                                  Agents       GitHub        Contact
                                  Approvals    Changelog
                                  FAQ
 ------------------------------------------------------------------
 © 2026 StingClaw                                    Windows today
```

- bg `--sc-bg-inset`. Padding 80px top, 40px bottom (64 / 32 mobile). Link columns per 5.13. Only link to pages that exist (`[CONDITIONAL]`).
- The bottom-right platform note is optional and must be true ("Windows today" until other platforms are supported).
- Mobile: brand block, then link columns in a 2-column grid, then legal.

### 6.13 Deliberately not on the page

Customer logos, user and token statistics, testimonials, pricing table, blog/recent posts, "Sign in", marquee of integrations, compliance badges, uptime claims. Add them only when real content exists.

---

## 7. Motion and interaction

### 7.1 Tokens

| Token | Value |
|---|---|
| `--sc-ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--sc-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--sc-dur-press` | 100ms |
| `--sc-dur-hover` | 160ms |
| `--sc-dur-reveal` | 240ms |
| `--sc-dur-draw` | 400ms |
| Cursor blink | 1.06s `steps(1)` |

Animate only `opacity` and `transform` (plus color and border-color on hover). Never animate layout properties, except the accordion's `grid-template-rows`.

### 7.2 The one orchestrated moment: hero app frame

On load, once: the composer fills with a short request and sends; tool rows appear in the conversation with a 120ms stagger (`▸` flips to `✓`); a `!` row appears ("3 changes wait for your review"); the cursor starts blinking in the composer. Total under 3.5s. The headline, subtext, and CTAs render immediately and the page is interactive during playback. No replay on scroll, no loop.

### 7.3 Scroll reveals (two targets)

`IntersectionObserver`, threshold 0.2, fire once:
1. How-a-task-flows diagram: connectors draw via `stroke-dashoffset` over 400ms; nodes fade in with a 40ms stagger.
2. Approvals diff block: opacity 0 to 1, 240ms.

Nothing else reveals on scroll. No fade-up on sections or cards.

### 7.4 Interaction responses

| Element | Response |
|---|---|
| Primary button | Hover glow and color (160ms); active `translateY(1px)` (100ms) |
| Linked cards or rows | Hover surface change (160ms); linked cards draw the top maroon rule (200ms) |
| Tabs | Indicator slides (200ms); panel crossfades (160ms, opacity only) |
| Accordion | Height eases 200ms; indicator color shifts |
| Nav | Bottom border fades in after scroll (160ms) |
| Flow node | Connector highlights on hover or focus (160ms) |
| Status "running" | 2s opacity pulse |

### 7.5 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Plus: the app frame renders its final state, the flow diagram shows a static highlighted path, the cursor is static, and nothing stays hidden waiting for a reveal. With JS disabled, all content is visible (reveals are progressive enhancement via a `.js` class on `<html>`).

---

## 8. Accessibility

- **Contrast:** meets WCAG 2.2 AA throughout. See the table in 2.3 for the three combinations that look fine but fail and the rules that prevent them.
- **Focus:** `:focus-visible` ring `2px #E8587A`, offset 3px, on every interactive element. Never `outline: none` without a replacement. Ring has 5.48:1 against `#111114`.
- **Targets:** minimum 44x44px for buttons, links in nav and footer, menu button, tab triggers, accordion triggers.
- **Semantics:** landmarks (`header`, `nav`, `main`, `footer`), one `h1` (the hero headline), headings never skip levels, a skip link first.
- **App frames, transcripts, and diagrams:** animated visuals are `aria-hidden` with a text equivalent (`role="img"` + `aria-label`, or a visually hidden summary list). The flow diagram's nodes are real focusable elements with accessible names.
- **Color is never the only signal:** every status has a text label; node types have glyphs and titles; errors have icons and text.
- **Forms:** visible labels, `aria-describedby` for helper/error text, `autocomplete` attributes (`name`, `email`, `organization`), errors announced via `aria-live="polite"` on submit.
- **Patterns:** tabs, accordions, and the mobile menu follow WAI-ARIA Authoring Practices keyboard behavior as specified in 5.9, 5.10, and 6.2.
- **Reflow and zoom:** no horizontal scroll at 320px or at 400% zoom, except inside code blocks. Respect user font-size settings: type in `rem`, not `px`, in the implementation.
- **Preferences:** `color-scheme: dark`, `prefers-reduced-motion` (7.5). Under `prefers-contrast: more`, raise `--sc-border-subtle` to `#4A4A53` and `--sc-text-muted` to `#B8B3B9`.
- **Language:** `<html lang="en">`; page titles unique and descriptive.

---

## 9. Implementation

### 9.1 CSS tokens (paste into the global stylesheet)

```css
:root {
  color-scheme: dark;

  /* surfaces */
  --sc-bg-base: #111114;
  --sc-bg-inset: #0c0c0f;
  --sc-bg-raised: #17171b;
  --sc-bg-elevated: #1e1e23;
  --sc-bg-scrim: rgba(12, 12, 15, 0.8);

  /* text */
  --sc-text-primary: #e5e1e4;
  --sc-text-secondary: #b8b3b9;
  --sc-text-muted: #8e8a91;
  --sc-text-faint: #6b676e;
  --sc-text-on-brand: #ffffff;
  --sc-text-accent: #e8587a;
  --sc-text-accent-soft: #d0698f;

  /* brand */
  --sc-brand: #c32148;
  --sc-brand-hover: #cc2a52;
  --sc-brand-active: #a81c3e;
  --sc-brand-tint: rgba(195, 33, 72, 0.12);
  --sc-brand-border: rgba(195, 33, 72, 0.5);
  --sc-soft: #b5406c;
  --sc-soft-tint: rgba(181, 64, 108, 0.12);
  --sc-soft-border: rgba(181, 64, 108, 0.45);

  /* borders */
  --sc-border-subtle: #26262c;
  --sc-border-default: #34343b;
  --sc-border-strong: #4a4a53;
  --sc-border-control: #6b676e;

  /* status */
  --sc-success: #5ccb8b;
  --sc-warning: #e3b341;
  --sc-error: #ff7a59;
  --sc-diff-add-bg: rgba(92, 203, 139, 0.1);
  --sc-diff-del-bg: rgba(255, 122, 89, 0.1);

  /* type */
  --sc-font: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;

  /* shape */
  --sc-radius-xs: 2px;
  --sc-radius-sm: 4px;
  --sc-radius-md: 6px;
  --sc-radius-full: 9999px;

  /* motion */
  --sc-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --sc-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --sc-dur-press: 100ms;
  --sc-dur-hover: 160ms;
  --sc-dur-reveal: 240ms;
  --sc-dur-draw: 400ms;
}

html { background: var(--sc-bg-base); color: var(--sc-text-primary); }
body {
  font-family: var(--sc-font);
  font-size: 0.9375rem;      /* 15px */
  line-height: 1.733;        /* 26px */
  font-variant-ligatures: none;
  font-feature-settings: "calt" 0;
  -webkit-font-smoothing: antialiased;
}
code, pre, .sc-terminal { font-variant-ligatures: contextual; font-feature-settings: "calt" 1; }
::selection { background: rgba(195, 33, 72, 0.35); color: #fff; }
:focus-visible { outline: 2px solid var(--sc-text-accent); outline-offset: 3px; }
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; max-width: 64ch; }
```

Spacing tokens (`--sc-space-*`) from section 4.1 go in the same block.

### 9.2 Tailwind

If the project uses Tailwind, map the tokens above in the theme (v4 `@theme` or v3 `theme.extend`) as `colors.sc.*`, `fontFamily.sc`, `borderRadius`, and `spacing`, and set breakpoints to `sm 480`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Keep the component classes (`.sc-cursor`, terminal, workflow) in a plain CSS layer; do not rebuild them from utility soup.

### 9.3 Suggested structure

```
/src
  /styles   tokens.css  base.css  components.css
  /components  AnnouncementBar  Nav  Hero  AppFrame  Transcript  CommandBlock
               SurfaceRows  ProofStrip  Pillars  ModeTabs  AgentSettingsMock
               DiffBlock  FlowDiagram  Faq  CtaPanel  Footer
               Tabs  Accordion  Badge  Button  Field
  /content  copy.ts   (every marketing string, each tagged PLACEHOLDER / VERIFY / CONDITIONAL)
```

All marketing copy lives in one content file so unverified claims are easy to find and replace.

### 9.4 Performance targets

- LCP element is the hero headline (text, no image). Target LCP < 2.0s on a mid-range mobile profile, CLS < 0.1, no render-blocking third-party scripts.
- Font: one variable woff2 (Latin), preloaded.
- Prefer an HTML replica for the app frame (crisp, accessible, tiny). If screenshots are used: AVIF/WebP at 2x, explicit `width` and `height`, `fetchpriority="high"` only if above the fold. Icons are inline SVG. Diagrams are SVG.
- JavaScript budget: app-frame playback, tabs, accordion, mobile menu, observer reveals. No animation library.

---

---

## 10. Do and don't

**Do**
- Keep charcoal at 85% or more of any viewport; check with a screenshot.
- Use `#FFFFFF` on maroon fills and `#E8587A` for small maroon text.
- Show the real interface in the hero and keep every claim traceable to section 0.2.
- Use the claw cursor as the one signature mark, only where 1.2 allows.
- Vary layout hierarchy: ruled pillar row, tabs with a visual, a split settings panel, a diff block. Not six identical cards.
- Cap line lengths in characters (`ch`) and write short headlines for mono.
- Give every status a text label and every control a visible label; keep `+` and `-` prefixes in diffs.
- Keep all copy in the content file and tag anything unverified.

**Don't**
- Don't set small text in `#C32148` or `#B5406C`; they fail AA on charcoal.
- Don't put Off White text on a maroon button (4.47:1).
- Don't use maroon for errors, success, or any status.
- Don't add gradients, glows, or glass beyond the list in 2.4. No `backdrop-filter` blur.
- Don't round anything beyond 6px (status dots excepted). No pill buttons.
- Don't use an all-caps eyebrow above every heading, numbered markers on non-sequences, or a fade-up on every section.
- Don't use more than one primary button per viewport region.
- Don't use ligatures in prose or UI text.
- Don't ship invented logos, statistics, testimonials, uptime, compliance, "open source", installer, or cross-platform claims.
- Don't copy another site's text, logos, imagery, video, or font files.

---

## 11. Iteration guide

**Pass order for the implementing agent**
1. Tokens, font loading, base styles, nav, hero (with a static app-frame replica). Screenshot at 1440 / 768 / 390.
2. Remaining sections in order, with copy from the content file.
3. Full component state coverage (hover, active, focus, disabled, loading, error).
4. Motion: 7.2 first, then 7.3, then reduced-motion verification.
5. Accessibility pass: keyboard-only walkthrough, 200% and 400% zoom, screen-reader skim of headings and landmarks.

**Self-review checklist (run before calling a pass done)**
- Maroon budget: does bright maroon exceed about 5% of any viewport? If so, remove something.
- Remove one accessory: delete the least necessary decorative element.
- Any text below 4.5:1 that is not on the allowed list (large text, controls, decorative)?
- Any element that animates without a user action, other than the two listed?
- Does every claim on the page appear in 0.2 or carry a `[VERIFY]` tag in the content file?
- Does the hero read as StingClaw with the logo hidden? (The cursor, the type, and the real interface should do that.)

**Prompts that work with a coding agent**
- "Implement section 6.3 exactly as specified in StingClaw_DESIGN.md, using tokens only. List any value you had to invent."
- "Audit the current page against sections 0.3, 2.3, and 10. Report violations with file and line, then fix them."
- "Compare the 390px screenshot with sections 4.5 and 6.3 mobile rules and fix mismatches."

**When the design changes:** edit this file first, then the code. Token changes go in 2.2 and 9.1 together so they never drift.

---

## 12. Open decisions for the owner

These block parts of the page. Until decided, the related sections stay out or carry placeholders.

| Decision | Blocks |
|---|---|
| Publish the repo and choose a license (or stay closed) | "Open source" pillar, GitHub nav link, star count, footer license link |
| Define the real install path (one command, installer, or docs) | Hero command block, "Get StingClaw" destination |
| Write minimal docs (setup, modes, permissions) | "Read the docs" CTA, nav and footer docs links, FAQ links |
| Decide pricing (free, paid, or "bring your own keys, app is free") | Pillar 2 wording, FAQ 8 |
| Platform support: add macOS/Linux key storage, or state "Windows today" | Footer note, FAQ 5, any platform claim |
| Confirm approval behavior per mode and permission | Headline of 6.8, FAQ 3, Pillar 3 |
| Pick a domain and a contact method | Footer, nav |
