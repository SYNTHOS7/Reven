# Reven deployment artifacts

Generated 2026-08-21.

| File | Destination | SHA-256 |
|---|---|---|
| `reven-vercel-frontend.zip` | Extract and deploy its root to Vercel | `1A4DD73DBE73BCC83638D45FCDFADC07FF82D87E7A9919558B86D23594DDFCAE` |
| `reven-render-backend.zip` | Extract and use as the Render service root | `6FC742A33408A65B8C19D70B97A3076D5384D7AD4D40E8B4F943C30753CF5BB9` |
| `reven-supabase-schema.sql` | Run once in Supabase SQL Editor | `269953CA2CF4FF1942FAC14E4F41AE7214D50F21DCC5D1C2DB1313378D5787F9` |

No `.env`, API credential, `node_modules`, `.next`, cache, or local test data is included. Use the hosting dashboards to add environment variables from `DEPLOYMENT.md`.

GitHub-based deployment is preferred because Vercel and Render can then rebuild automatically. The zip files are clean source handoff bundles when a manual upload/extraction workflow is required.
