Bundled fallback data
=====================

questions.json and datasets.json are the offline fallback for the question bank and datasets.
In step 5 the game will try the Google Sheets serverless endpoint first and use these files if
the request fails or the free tier quota is hit.

Both files are empty arrays for now. Real content arrives in step 3 (first questions) and step 5 (sheet export).
