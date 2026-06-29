# PotterPulse Data Sources

PotterPulse is intentionally local-first with optional cloud/live integrations.

| Area | Current Source | Notes |
| --- | --- | --- |
| Fixtures | Football-data.org when `FOOTBALL_API_KEY` is configured; otherwise SQLite seed data | Scheduled match sync only. |
| Squad | SQLite `stoke_squad`; optional Supabase table | Seeded only when empty so manual/cloud changes can persist. |
| Transfers | SQLite; optional Supabase table | Portfolio data unless a trusted feed is added. |
| Votes and player ratings | SQLite endpoints | Firebase can be enabled for selected client-side realtime flows. |
| Terrace Threads | PotterPulse first-party supporter feed | The Oatcake is linked externally and is not scraped or mirrored. |
| Injuries | Not live yet | Recommended path is an editorial `injury_updates` table with clear source labels. |

## Why This Matters

The app should be impressive without implying unavailable live feeds. Showing source labels keeps the dashboard honest and makes the engineering boundaries clear to reviewers.
