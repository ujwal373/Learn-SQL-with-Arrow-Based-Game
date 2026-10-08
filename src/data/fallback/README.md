Bundled fallback data
=====================

This folder is the offline copy of the question bank and the datasets. The game reads it through
src/storage/fallbackStorage.ts. In step 5 the game will try Google Sheets first (through a serverless
function) and use these files if that request fails or the free quota is used up.

questions.json
  The question bank. Eight questions for each of the nine tiers (see docs/game-design.md).
  Each question has the fields described in src/storage/types.ts. The same fields become the
  columns of the Google Sheet in step 5.

datasets/*.sql
  One file per dataset. Each file creates and fills a few small tables. The file name is the dataset
  name used by the "dataset" field of a question (school, shop, company).

Editing the bank
  After any change run: npm test
  src/data/bank.test.ts runs every answer against its dataset and checks that every wrong word bank
  choice really gives a wrong result. It catches typos and answers that are accidentally also right.
