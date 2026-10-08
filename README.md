# QueryOut

A browser based SQL learning game. Tap an arrow that has a clear path, finish the SQL query to send it sliding off the board, and clear the whole pattern to beat the level. Each level adds more arrows on a bigger grid, and the SQL gets harder.

Status: early build. Steps 1 to 3 of 8 are complete (project setup, the arrow board and the SQL challenges). Combo scoring, the Google Sheets question bank and the leaderboard come next.

## Stack

Vite, React, TypeScript. SQL checking with sql.js in the browser. Hosting on Vercel. Question bank and leaderboard in Google Sheets through serverless functions.

## How it plays

1. The board is a big dot grid with a symmetrical pattern of snake shaped arrows in the middle.
2. An arrow can leave only if nothing is in the straight line ahead of its head. Start with the arrows on the outside and work inward.
3. Tapping a free arrow opens a SQL challenge. A correct answer fires the arrow. A wrong answer costs a life. Tapping a blocked arrow also costs a life. A game has 3 lives, shared across levels.
4. Each level has 2 free hints. A hint highlights an arrow that is free to tap. More hints cost 50 points.
5. Zoom with the mouse wheel, a pinch, or the plus and minus buttons. Drag to move around. The fit button returns to the full pattern.
6. Light and dark themes, switchable at the bottom right.

More detail in docs/game-design.md.

## How levels are built

1. A shape (square, circle, cross, ring or diamond) is chosen for one quadrant, and the number of cells it covers rises every level.
2. The quadrant is filled with snakes, placed from the center outward.
3. Each snake is mirrored left to right and top to bottom, so the pattern is symmetrical.
4. A snake is accepted only if its head has a clear path at the moment it is placed. Clearing the arrows in reverse placement order always works, so no level can be deadlocked. Tests check this for the first 45 levels.
5. The same level number always gives the same board.

## Repo layout

```
api/                 Vercel serverless functions (questions, leaderboard)
docs/                Game design notes, level plan, demo GIF plan
public/              Static assets
src/components/      Board, ArrowShape, challenge dialog, result table, zoom and pan hook, icons
src/game/            Arrow model, blocking rules, level generator, curriculum, constants, tests
src/sql/             sql.js loading and query checking
src/storage/         GameStorage interface (swap Sheets for Supabase later)
src/data/fallback/   Bundled JSON used when the network or Sheets is unavailable
src/styles/          Board and challenge styles
src/theme.ts         Light and dark theme hook
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

Game feel values live in src/game/constants.ts: lives per game, lives lost on a blocked tap, free hints per level, hint cost, points per cleared arrow, and the slide animation speed. Level growth lives in getLevelConfig in src/game/levels.ts.
