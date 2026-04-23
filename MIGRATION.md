# KHEDMA — Migration Notes

What was deleted, what was refactored, and why.

---

## Deleted Files

| File / Folder | Reason |
|---|---|
| `mvp.html` | Replaced by the new multi-page structure (`index.html` + separate pages) |
| `landing.html` | Duplicate landing experiment — superceded by the new `index.html` |
| `khedma-app/` | Half-built SvelteKit port. We stay vanilla — no frameworks |
| `solana-sniper/` | Unrelated crypto trading bot. Had nothing to do with Khedma |
| `prisma/` + `prisma.config.ts` | We use Supabase directly — no ORM needed |
| `drizzle/` | Same reason as Prisma |
| `package.json` + `package-lock.json` | Only existed to support Prisma/Drizzle. Removed with them |
| `css/styles.css` (old) | Replaced by `css/main.css` — shared, cleaned-up design tokens |
| `js/app.js` (old) | Replaced by `js/shared.js`, `js/jobs.js`, `js/workers.js` |
| `FIREBASE_INTEGRATION.md` | We use Supabase, not Firebase |
| `TESTING_REPORT.md` | Stale report from old version |
| `supabase-setup.md` | Replaced by `supabase-setup.sql` with actual runnable SQL |
| `index.html.tmp` | Temp file |
| `.codex` | IDE artifact |

---

## Refactored

### Scope: Casablanca → Tangier only
- All city/district references updated to: Centre-ville, Iberia, Branes, Malabata
- Districts wired as a `CONFIG.DISTRICTS` array in `js/shared.js` — add more in one place

### Monolith split
- Single `index.html` (was 3141–5700 lines) → 6 focused pages
- Shared styles in `css/main.css`
- Shared JS in `js/shared.js`
- Page-specific logic in `js/jobs.js` and `js/workers.js`

### Supabase read path added
- `loadJobs()` now fetches from `jobs` table on page load
- `loadWorkers()` fetches from `workers` table
- Realtime subscription (`subscribeRealtime()`) — new jobs appear without refresh
- Stats (job count, worker count) come from `SELECT count(*)` on live DB
- All fake/hardcoded numbers removed
- localStorage used as offline cache fallback only

### Fake data removed
- Hardcoded job array removed
- Hardcoded worker array (12 fake profiles) removed
- Hardcoded stats (24 jobs, 156 workers, 89% success rate) removed
- Payment history demo data removed
- Seed data in `supabase-setup.sql` is commented out behind a block comment

### Branding
- Name: **KHEDMA** (not "خدماتي")
- Tagline: **خدمة قريبة منك في طنجة** (i18n-ready, shows in selected language)
- Primary color: `#25D366` (WhatsApp green) — unchanged
- Font: Cairo (Arabic) + Inter (Latin) — loaded once in each page head

### WhatsApp message
Updated to the spec-mandated format:
> السلام عليكم، رأيت إعلانكم على KHEDMA حول [JOB TITLE]. هل ما زال متاحاً؟

### Job post form
Switched to Temper-style shift structure:
- Title, Category (3), District (4), Date, Start time, Duration (hours), Pay (single MAD number), Description, Poster phone, Referral code (optional)
- Removed salary range (min/max) — replaced with single `pay` field

### Language support
- Added full i18n system: AR, EN, FR, ES, Darija
- Language toggle in every page header — persists to localStorage
- Only Arabic is complete; others have all keys populated
- RTL/LTR switches automatically (Arabic + Darija = RTL, others = LTR)

### Deleted features (deferred to v2)
- Ratings / review system
- Verification badges
- Worker subscriptions / promoted jobs
- In-app chat
- Map view
- Earnings dashboard
- Saved jobs
- Onboarding profile completion (replaced by single-screen role picker)

---

## Ambiguities Resolved

| Question | Decision |
|---|---|
| Categories | Café Waiter, Cleaning, Restaurant Staff (per user instruction) |
| District Arabic labels | وسط المدينة (Centre-ville), أيبيريا (Iberia), براني (Branes), مالاباطا (Malabata) |
| Supabase credentials | Placeholders — connect via Vercel env vars when ready |
| RLS without OTP auth | INSERT allows all for now; OTP-ready version commented in SQL ready to swap |
| Job ID routing | `job-detail.html?id=<uuid>` via URLSearchParams |
| Worker ID routing | `worker-profile.html?id=<uuid>` via URLSearchParams |
| localStorage fallback | Kept — shows cached data while Supabase loads; degrades gracefully |
| Language toggle behavior | Persists to localStorage; clicking updates all `data-i18n` elements live |
| `vercel.json` rewrite | Removed catch-all → each `.html` serves directly; `cleanUrls: true` for clean paths |
