# StingClaw landing page

This is a standalone static landing page. Its copy lives in `content.json`; rebuild the page after editing copy:

The local font is JetBrains Mono Variable from `@fontsource-variable/jetbrains-mono` 5.3.0. Its license is in `assets/JETBRAINS-MONO-LICENSE.txt`.

```powershell
bun run landing:build
```

To preview it locally from the repository root:

```powershell
python -m http.server 4173 --directory landing
```

Then open `http://127.0.0.1:4173`. The page does not need the StingClaw app server or additional packages.
