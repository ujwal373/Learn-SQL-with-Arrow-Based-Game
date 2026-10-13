# QueryOut

> Learn SQL by clearing a puzzle. Tap an arrow that has a free path, answer the SQL challenge, and watch it slide off the board. Clear every arrow to beat the level.

**Live demo:** _coming soon — deploying to Vercel_

---

## How it plays

![QueryOut gameplay](docs/demo.gif)
_Demo GIF coming soon_

1. The board shows a symmetrical pattern of snake-shaped arrows on a dot grid.
2. An arrow can only leave if the straight line ahead of its head is empty. Work from the outside in.
3. Tapping a free arrow opens a SQL challenge. Answer correctly and the arrow fires off the board.
4. A wrong answer costs one life and shows you the correct query. Tapping a blocked arrow also costs a life.
5. You have 3 lives shared across all levels. Lose them all and it is game over.
6. Each level gives 2 free hints. A hint highlights a free arrow. Extra hints cost 50 points.
7. Build a combo: each correct answer in a row multiplies your score. One mistake resets it.
8. Levels grow bigger and the SQL gets harder — from basic SELECT all the way up to window functions.

---

## Features

- Arrow puzzle board with symmetrical patterns, deterministic generation, zoom, pan, and drag
- SQL checked live in the browser with sql.js (SQLite compiled to WebAssembly) — no server round trip
- 72 questions across 9 SQL tiers, served from Google Sheets with the bundled JSON as offline fallback
- Two question styles: fill in the blanks (word bank on early levels, typed from level 9) and complete the query
- Combo multiplier, 3 shared lives, free hints and paid hints, pause, restart, fullscreen
- Light and dark themes, follows system preference on first visit
- Runs entirely on free tiers: Vercel for hosting, Google Sheets as the data source

---

## SQL curriculum

Each two levels the player advances one tier. A level mostly asks its own tier plus a few review questions from the two tiers before it.

| Tier | Topic |
|------|-------|
| 1 | SELECT and FROM |
| 2 | WHERE |
| 3 | ORDER BY, LIMIT, DISTINCT |
| 4 | LIKE, IN, BETWEEN, NULL |
| 5 | Aggregate functions |
| 6 | GROUP BY and HAVING |
| 7 | JOINs |
| 8 | Subqueries, CASE, WITH |
| 9 | Window functions |

---

## Tech stack

| Technology | Role | Why |
|------------|------|-----|
| Vite 8 + React 19 | UI and build | Fast HMR, React 19 concurrent features |
| TypeScript 6 (strict) | Type safety | `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals` |
| sql.js | SQL evaluation | SQLite compiled to WASM — runs entirely in the browser, no backend needed for answer checking |
| Vercel | Hosting + serverless | Free tier, zero-config deploys from GitHub |
| Google Sheets | Question bank + leaderboard | Zero-cost database, easy to edit questions without a deploy |
| oxlint | Linting | Much faster than ESLint, strict React rules |
| vitest | Testing | Co-located with Vite, fast test runner |

---

## Repo layout

```
api/                    Vercel serverless functions (questions, datasets, leaderboard)
docs/                   Game design notes, level plan, demo GIF plan
scripts/                One-time utilities (CSV export for Google Sheets setup)
public/                 Static assets
src/
  components/           Board, ArrowShape, ChallengeModal, ResultTable, icons, zoom/pan hook
  game/                 Arrow model, blocking rules, level generator, curriculum, constants
  sql/                  sql.js loading and in-browser query checking
  storage/              GameStorage interface — swap Sheets for Supabase without touching game code
  data/fallback/        Bundled question bank and datasets (used offline and in local dev)
  styles/               Board and challenge CSS
  theme.ts              Light/dark theme hook
```

---

## Run locally

```bash
npm install
npm run dev
```

The game works fully offline in dev. The SQL engine and question bank are bundled. The Google Sheets functions in `api/` are only called on Vercel.

```bash
npm run build     # type-check + production build
npm run lint      # lint with oxlint
npm test          # run vitest (bank tests + level tests)
npm run preview   # preview the production build locally
```

---

## Google Sheets setup

The live question bank is loaded from a Google Spreadsheet at runtime. The bundled JSON is always available as a fallback.

### 1. Create a Google Cloud API key

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Enable the **Google Sheets API** under APIs & Services > Library.
3. Create an API key under APIs & Services > Credentials.
4. Restrict the key to the Sheets API and your Vercel domain.

### 2. Create the spreadsheet

1. Create a Google Spreadsheet and make it publicly viewable (Share > Anyone with the link > Viewer).
2. Add a tab named **questions** and a tab named **datasets** (lowercase, exact spelling).
3. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

### 3. Populate the spreadsheet

Run the export script to generate CSV files from the bundled data:

```bash
npm run export-sheets
```

This writes `questions.csv` and `datasets.csv` at the project root. Import each into its matching tab:

- In Google Sheets: **File > Import > Upload**, choose the file, select *Replace current sheet*, separator *Comma*, uncheck *Convert text to numbers*.
- Delete the CSV files after importing — they are already in `.gitignore`.

The **answers** and **wordBank** columns use `|` as a delimiter (e.g. `name|age`). The **orderMatters** column uses `TRUE` or `FALSE`.

### 4. Set Vercel environment variables

In your Vercel project: **Settings > Environment Variables**. Add:

| Variable | Value |
|----------|-------|
| `GOOGLE_SHEETS_API_KEY` | The API key from step 1 |
| `SPREADSHEET_ID` | The spreadsheet ID from step 2 |

Copy `.env.example` to `.env.local` if you want to run `vercel dev` locally.

---

## Deploy to Vercel

1. Push the repo to GitHub under your account (`github.com/ujwal373/queryout`).
2. Go to [vercel.com](https://vercel.com), import the repository.
3. Vercel auto-detects Vite. The default settings are correct.
4. Add the two environment variables from the section above.
5. Deploy. The `api/` folder is automatically served as serverless functions.

---

## Tuning

Game-feel constants live in `src/game/constants.ts`:

| Constant | Default | Effect |
|----------|---------|--------|
| `LIVES_PER_GAME` | 3 | Lives shared across all levels |
| `BASE_ARROW_SCORE` | 100 | Points per cleared arrow before combo |
| `COMBO_CAP` | 8 | Maximum combo multiplier |
| `FREE_HINTS_PER_LEVEL` | 2 | Free hints before the score cost kicks in |
| `EXTRA_HINT_SCORE_COST` | 50 | Points deducted per paid hint |

Level growth (board size, snake length, shape) lives in `getLevelConfig` in `src/game/levels.ts`.

---

## Build roadmap

| Step | Status | Description |
|------|--------|-------------|
| 1 | Done | Project setup, Vite, TypeScript, vitest, oxlint |
| 2 | Done | Arrow board, blocking rules, animations, zoom/pan, themes |
| 3 | Done | SQL challenges with sql.js, question bank, in-browser answer checking |
| 4 | Done | Lives, combo multiplier, score, run timer, level progression |
| 5 | In progress | Question bank from Google Sheets, serverless functions, offline fallback |
| 6 | Planned | Global leaderboard in Google Sheets, server-side score validation, anti-cheat |
| 7 | Planned | Sound, mobile layout polish, accessibility |
| 8 | Planned | Demo GIF, deploy, LinkedIn launch post |

---

## License

MIT — see [LICENSE](LICENSE)
