# KHEDMA

> Hyperlocal WhatsApp-first job marketplace for Tangier, Morocco.
> Inspired by Temper.jobs — stripped down for an Arabic-speaking MVP.

**Tagline:** خدمة قريبة منك في طنجة

---

## Pages

| Page | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Browse jobs (homepage) |
| `post-job.html` | `/post-job` | Post a shift/job |
| `job-detail.html` | `/job-detail?id=<uuid>` | Single job + WhatsApp apply |
| `workers.html` | `/workers` | Browse worker profiles |
| `worker-profile.html` | `/worker-profile?id=<uuid>` | Single worker + WhatsApp contact |
| `onboarding.html` | `/onboarding` | First-visit role picker (skippable) |

---

## Run Locally

No build step. Open directly in a browser:

```bash
# Option 1 — Python simple server (recommended)
cd khedma
python3 -m http.server 8080
# open http://localhost:8080

# Option 2 — Node http-server
npx http-server -p 8080
# open http://localhost:8080

# Option 3 — VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

> **Note:** Opening `index.html` directly via `file://` will work for most features,
> but Supabase and font loading require a proper HTTP server.

---

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase-setup.sql` in your project's **SQL Editor**
3. Copy your **Project URL** and **anon public key** from Settings → API
4. Add them as environment variables (see below)

---

## Environment Variables

Set these in Vercel (or on `window` before `shared.js` loads for local dev):

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key |

### Vercel
```
Settings → Environment Variables → Add:
  SUPABASE_URL        = https://xxxxxxxxxxxx.supabase.co
  SUPABASE_ANON_KEY   = eyJhbGci...
```

Then add this to each HTML page's `<head>` (or a `config.js` loaded before `shared.js`):
```html
<script>
  window._SUPABASE_URL  = '%%SUPABASE_URL%%';   // injected by Vercel
  window._SUPABASE_ANON = '%%SUPABASE_ANON_KEY%%';
</script>
```

> Until Supabase is connected the app falls back to `localStorage` cache —
> jobs posted via `post-job.html` are stored locally and visible on the device.

---

## Deploy

Push to `master` → Vercel auto-deploys in ~60 seconds.

```bash
git add -A
git commit -m "your message"
git push origin master
```

---

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build step
- **Supabase** — Postgres database, Row Level Security, Realtime
- **WhatsApp deep links** — `wa.me/<phone>?text=<prefilled>`
- **Vercel** — static hosting, auto-deploy from `master`

---

## Languages

Full i18n system with 5 languages. Toggle in every page header persists to `localStorage`.

| Code | Language | Status |
|---|---|---|
| `ar` | Arabic (العربية) | ✅ Complete |
| `darija` | Moroccan Darija (الدارجة) | ✅ Complete |
| `fr` | French | ✅ Complete |
| `en` | English | ✅ Complete |
| `es` | Spanish | ✅ Complete |

RTL layout applies automatically for `ar` and `darija`.

---

## Adding Districts or Categories

Edit `js/shared.js` — the two config arrays at the top:

```js
CONFIG.DISTRICTS = [
  { id: 'new-district', ar: 'اسم عربي', fr: 'Nom', en: 'Name', es: 'Nombre', darija: 'اسم' },
  // ...
];

CONFIG.CATEGORIES = [
  { id: 'new-cat', ar: 'فئة', fr: 'Catégorie', en: 'Category', es: 'Categoría', darija: 'نوع', icon: '🔧' },
  // ...
];
```

All dropdowns, filter chips, and labels update automatically.

---

## Verify Live Version

Scroll to the bottom of any deployed page — a small grey label shows the build commit ID.
If it matches the latest commit on `master`, you're on the current version.
