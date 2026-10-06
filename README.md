# QueryOut

A browser based SQL learning game. Tap an arrow that has a clear path, finish the SQL query to send it flying off the board, and clear every arrow to beat the level.

Status: early build. Steps 1 and 2 of 8 are complete (project setup, arrow board). SQL challenges arrive in step 3, so for now a tap on a clear arrow removes it directly.

## Stack

Vite, React, TypeScript. SQL checking with sql.js in the browser. Hosting on Vercel. Question bank and leaderboard in Google Sheets through serverless functions.

## How the board works

1. An arrow can leave the board only if every cell between it and the edge, in the direction it points, is empty. Tapping a blocked arrow shakes it, highlights the arrow in its way, and costs a small score penalty (no life is lost).
2. Levels are generated from the level number, so the same level is always the same board.
3. Every generated board is solvable. Arrows are placed one at a time, and each new arrow must have a clear path at the moment it is placed. Clearing arrows in reverse placement order therefore always works, so deadlocks such as two arrows pointing at each other cannot occur. Tests check this for the first 40 levels.
4. Difficulty follows the level plan: 4 to 6 arrows on levels 1 to 3, up to 12 arrows by level 9, and 12 or more from level 10, with the grid growing from 5 by 5 to 8 by 8.

## Repo layout

```
api/                 Vercel serverless functions (questions, leaderboard)
docs/                Design notes, level plan, demo GIF plan
public/              Static assets
src/components/      React UI: Board, ArrowIcon
src/game/            Blocking rules, level generator, constants, tests
src/sql/             sql.js loading and query validation (step 3)
src/storage/         GameStorage interface (swap Sheets for Supabase later)
src/data/fallback/   Bundled JSON used when the network or Sheets is unavailable
src/styles/          Board styles
```

## Run locally

```
npm install
npm run dev
```

## Scripts

```
npm run dev       Start the dev server
npm run build     Type check and production build
npm run lint      Lint with oxlint
npm test          Run the unit tests (vitest)
npm run preview   Preview the production build
```

## Tuning

Game feel values live in src/game/constants.ts: the blocked tap penalty, the points per cleared arrow, and the fly off animation time.
