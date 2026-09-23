# Fan wall backend (Supabase) — setup in five minutes

1. https://supabase.com → New project (free tier, any region; name it `dear-united`).
2. SQL editor → paste `schema.sql` → Run. This creates `wall_bricks`, row-level security
   (public read of approved bricks, public insert, nothing else), a site-wide brake of
   60 bricks/minute, and your founding brick (edit the message in the last statement first).
3. Project settings → API → copy the **Project URL** and the **anon public** key into
   `src/lego/wall/config.js` in the site repo. Both are public by design; the service-role key
   never leaves the dashboard.
4. Moderation: Table editor → `wall_bricks` → set `approved` to false on anything you don't
   want shown (it vanishes on the next page load). Deleting the row also works; the wall
   re-flows because positions are computed from insertion order.

Without config the wall runs in local-only mode (bricks stay in the visitor's browser).
