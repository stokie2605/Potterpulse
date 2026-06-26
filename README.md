# Potter Pulse

Potter Pulse is a work-in-progress local Stoke City tracker app built around a small SQLite database and a lightweight Node renderer. It presents the squad and fixture run as a premium black-and-red sports app interface inspired by modern products such as Sky Sports, EA Sports, and bet365, while keeping the look recognisably Stoke-focused. This is not a finished production app yet; it is an actively evolving prototype with real data, a live local renderer, and a documented design direction.

## Project Status

Potter Pulse is currently a work in progress. The core local architecture is working, the SQLite data is populated, and the sports-app visual direction is established, but the project still needs refinement before it should be treated as production-ready.

Known WIP areas:

- Replace placeholder crest blocks with real club crest assets.
- Add richer fixture detail screens and interaction states.
- Improve responsive polish across more viewport sizes.
- Decide whether to keep the current no-build Node renderer or migrate to a fuller frontend stack later.
- Add a proper saved dashboard image at `docs/screenshots/dashboard_latest.png`.
## Current Architecture

```text
Potterpulse/
├── index.html                         # Single-page sports app shell and CSS
├── potter_pulse.db                    # SQLite database used by the renderer
├── scripts/
│   ├── server.mjs                     # Local Node HTTP server and SQLite renderer
│   └── seed-potter-pulse.mjs          # Initial seed script for core players/fixtures
├── docs/
│   └── screenshots/
│       └── dashboard_latest.png       # Intended location for the latest dashboard screenshot
└── potterpulse-mobile.png             # Local verification screenshot generated during QA
```

## How It Works

The app is intentionally simple:

1. `potter_pulse.db` stores the squad and fixture data.
2. `scripts/server.mjs` opens the SQLite database with Node's built-in `node:sqlite` module.
3. The server reads `index.html` as a template.
4. It injects live database values into placeholders such as `{{heroOpponent}}`, `{{squadCards}}`, and `{{fixtureTimeline}}`.
5. The page is served locally at `http://localhost:4173`.

This means there is no framework build step, package install, or frontend bundler required for the current version. The app is a fast local prototype with real persisted data.

## Database

Database file:

```text
potter_pulse.db
```

Tables:

```sql
stoke_squad
```

Purpose: stores tracked Stoke City players.

Important columns:

```text
id
player_name
position
squad_number
nationality
date_of_birth
created_at
updated_at
```

```sql
efl_fixtures
```

Purpose: stores Stoke City fixtures.

Important columns:

```text
id
competition
match_date
opponent
venue
status
stoke_score
opponent_score
created_at
updated_at
```

Dates are stored as clean `YYYY-MM-DD` text so the frontend can format them consistently.

Venues are normalized as lowercase values:

```text
home
away
neutral
```

## Data Currently Seeded

The squad table contains the initial core squad:

```text
Viktor Johansson #1, goalkeeper
Bae Jun-ho #10, midfielder
Junior Tchamadeu #22, defender
Million Manhoef #42, forward
```

The fixture table contains the full 47-match layout supplied during the build, starting with:

```text
2026-08-08 | EFL Cup | Oldham Athletic | home
2026-08-15 | Championship | Swansea City | home
2026-08-22 | Championship | Southampton | away
```

and ending with:

```text
2027-05-01 | Championship | Millwall | away
```

## Running Locally

Start the local server:

```powershell
node scripts\server.mjs
```

Open the app:

```text
http://localhost:4173
```

If another process is already using port `4173`, stop the old Node server or run with another port:

```powershell
$env:PORT = '4174'
node scripts\server.mjs
```

## Design Direction

The original interface looked closer to a traditional admin dashboard: large desktop panels, a broad hero card, and a flat information layout.

The current direction is closer to a native modern sports app:

- Compact top app bar
- Horizontal pill navigation
- Premium match-centre card
- Bold uppercase match typography
- Black-and-red Stoke colour system
- Soft crimson glow effects
- Dense fixture rows
- Horizontal squad strip
- Bottom navigation inspired by mobile sports apps

The goal is not to copy Sky Sports, EA Sports, or bet365 directly. The goal is to borrow the shared product language: compact hierarchy, strong live-match modules, pill tabs, dense rows, dark surfaces, and high-contrast action areas.

## Engineering Struggle Log

### 1. Hand-coded data fatigue vs automated Node REPL bulk data ingestion

At the start, adding fixture data manually would have meant repeatedly writing individual SQL inserts and checking them by hand. That was slow, error-prone, and exactly the kind of work that creates subtle inconsistencies in dates, venues, and competition labels.

The solution was to use the Node REPL MCP with Node's SQLite support to parse the complete pipe-delimited fixture table and insert all 47 rows using clean parameters. The import normalized dates to `YYYY-MM-DD` and venues to lowercase `home` / `away` / `neutral`. That made the data reliable for the CSS frontend and removed the fatigue of hand-coded rows.

### 2. Browser sandbox process breakpoint crash `0x80000003` vs manual browser inspection workaround

During visual verification, browser automation hit environment and sandbox friction. Playwright initially could not find the expected Chromium runtime from the Node REPL environment, and browser launching from the sandboxed MCP runtime was blocked. This class of failure was treated as a browser sandbox/process breakpoint problem, including the kind of local Windows crash/debug behaviour represented by `0x80000003`.

The workaround was practical: run the local Node server directly, open the app manually in the browser, and use Playwright from the terminal where browser process launch permissions were available. Screenshots were captured with `npx playwright screenshot`, then inspected from the generated image. When the image viewer could not read from the temp path, the screenshot was saved into the project and emitted through the Node REPL as an inline image.

That gave us a reliable visual inspection loop without blocking the build on sandbox-specific browser launch behaviour.

### 3. Flat old-school admin styling vs ultra-premium glassmorphic sports design

The first version worked, but it looked like a dark admin dashboard rather than a modern sports product. It had useful panels, but the styling lacked the compact, immersive feel of high-end sports apps.

The redesign moved the interface toward a premium mobile sports app language:

- Radial dark backgrounds instead of flat solid fills
- Translucent cards and layered dark surfaces
- Thin semi-transparent borders
- Deep outer shadows
- Heavy uppercase typography
- Crimson glow behind the match module
- App-style tabs, cards, fixture rows, and bottom navigation

The result keeps Potter Pulse black and red, but gives it more of the energy and density seen in modern match-centre apps.

## Screenshot Workflow

Save the latest dashboard image here:

```text
docs/screenshots/dashboard_latest.png
```

That path is intentionally reserved for the current best visual reference of the dashboard.

## Verification Performed

The app has been checked locally with:

```powershell
node --check scripts\server.mjs
```

The rendered page was also checked over `http://localhost:4173` to confirm:

```text
No unreplaced template placeholders
47 fixture rows rendered
4 squad cards rendered
App frame present
```

A mobile screenshot was generated during visual QA:

```text
potterpulse-mobile.png
```

## GitHub Linking Steps

After `git init` and staging are complete, link this local project to a GitHub repository with these commands.

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub details:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git commit -m "Initial Potter Pulse app"
git push -u origin main
```

If the remote already exists, update it instead:

```powershell
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

To check your configured remote:

```powershell
git remote -v
```

## Next Steps

Good next improvements:

- Add real Stoke and opponent crests as image assets.
- Move inline CSS into `src` or `styles` if the project grows.
- Add a route for JSON fixture data.
- Add filtering by competition, month, and home/away.
- Add a proper screenshot in `docs/screenshots/dashboard_latest.png`.

