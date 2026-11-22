# StingClaw landing page

This is a standalone static landing page. Its copy lives in `content.json`; rebuild the page after editing copy:

The local font is JetBrains Mono Variable from `@fontsource-variable/jetbrains-mono` 5.3.0. Its license is in `assets/JETBRAINS-MONO-LICENSE.txt`.

```powershell
bun run landing:build
```

To preview it locally from the repository root:

```powershell
bun run landing:dev
```

Then open `http://127.0.0.1:4173`. Running `bun run dev` also starts this landing page alongside the local StingClaw app.
