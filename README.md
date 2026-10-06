# QueryOut

A browser based SQL learning game. Tap an arrow that has a clear path, finish the SQL query to send it flying off the board, and clear every arrow to beat the level.

Status: early build. Step 1 of 8 (project setup) is complete.

## Stack

Vite, React, TypeScript. SQL checking with sql.js in the browser. Hosting on Vercel. Question bank and leaderboard in Google Sheets through serverless functions.

## Repo layout

```
api/                 Vercel serverless functions (questions, leaderboard)
docs/                Design notes, level plan, demo GIF plan
public/              Static assets
src/components/      React UI components
src/game/            Board logic, blocking rules, scoring
src/sql/             sql.js loading and query validation
src/storage/         GameStorage interface (swap Sheets for Supabase later)
src/data/fallback/   Bundled JSON used when the network or Sheets is unavailable
src/styles/          Shared styles
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
npm run preview   Preview the production build
```
