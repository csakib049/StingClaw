# StingClaw landing hero motion

## PAGE

- **Problem:** People hesitate to give an agent access to files if they cannot see when a change is about to happen.
- **Audience:** A first time visitor, often watching the page muted and for only a few seconds.
- **Goal:** Understand that the agent returns a proposed change for review before it reaches the workspace.
- **Emotion:** Move from uncertainty to control.

## Brand inventory

| Cue | Decision |
|---|---|
| Mark | The StingClaw ray silhouette and custom wordmark identify the product; the film does not turn the mark into a generic mascot or metaphor. |
| Core control | Per agent permissions and the review step before applying changes. |
| Material | The actual dark local workspace UI from the product and reference recording. |
| Verb | Stage, then review. |
| Success moment | A proposed file change waits with the status “Waiting for your review.” |
| Voice | Plain, concise, specific. |
| Colour logic | StingClaw red marks the send action; amber means a person’s review is needed; green stays with local service status. |
| Type | The landing page’s JetBrains Mono, with the real interface copy at its normal UI scale. |

## Idea options

1. **UI documentary of a task — selected.** Type the existing request “Review the changes in my project.”, send it to the named agent, show the agent’s existing response, then let the proposed change settle into its amber review state. The camera moves toward that state because it is the product’s meaningful result.
2. **Held approval shot.** Begin on the real change review surface and show a cursor move between the proposal and the approval choice. This would make the review control legible but would skip how a task reaches it.
3. **Web-to-Telegram relay.** Carry one request from the local app to a phone and back into the same agent thread. This would demonstrate multiple surfaces, but it spends the short hero window on channel switching instead of the review promise.

The selected idea still reads as StingClaw when the logo is covered: its subject is a real agent task that stops at the user’s review. Swapping the logo would change neither the behaviour nor the UI, so the identity comes from the real product interface and its local, permissioned workflow rather than an invented category metaphor.

## World and timing

- **Ground:** The existing StingClaw workspace is the full ground; its sidebar, chat, composer, status and task row provide the real density.
- **Light:** Existing red and amber UI accents stay tied to send and review states. No extra glow or scene-by-scene colour changes.
- **Depth:** One short camera push toward the review row; no fake 3D device.
- **Texture:** Crisp product UI and its existing borders. No generated plate or borrowed frame from the screen recording.
- **Sound:** None. The hero motion is silent and works in an autoplay context.

| Beat | Importance | Buys | Action and handoff |
|---|---:|---|---|
| Request | 2 | The viewer sees a task begin in the same workspace they can use. | The existing composer text appears with an authored typing rhythm; a cursor presses Send. The prompt becomes the user message. |
| Work and response | 2 | The viewer sees the named agent answer the request. | “Working” follows the send; the existing agent reply arrives from the opposite side of the chat. The status change prepares the review state. |
| Review | 3 | The viewer understands that a proposed edit pauses for their decision. | “Working” yields to “Waiting for review”; the existing amber task row enters. A measured camera push lands on the review row and holds for about one second. |

**Screenshot frame:** the real mock workspace, with “Waiting for your review” and “1 proposed file change” readable in the amber task row.

## Reference use

The supplied `agentChat.mp4` is a 67 second screen recording of the local app. It informed the task sequence and calm UI pace only. Its browser chrome, cursor trail, other open tabs and any text shown inside it were not copied as design instructions or assets.
