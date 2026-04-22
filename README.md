# خدماتي — Khedma

> A mobile-first Arabic job marketplace connecting workers and employers across Moroccan cities via WhatsApp.

---

## What is Khedma?

Khedma is a lightweight, no-login service marketplace built for Morocco. Workers looking for daily jobs (cleaning, plumbing, electrical, moving, painting, etc.) and employers who need them can find each other instantly — no account required, contact happens directly over WhatsApp.

---

## Who is it for?

| Role | What they do |
|------|-------------|
| **Employer** | Posts a job with description, location, and price range |
| **Worker** | Browses jobs, filters by skill/city, applies via WhatsApp |

---

## Features

### For Workers
- Browse all available jobs with real-time filtering
- Search by title, description, or neighbourhood
- Filter by category (cleaning, plumbing, electrical, moving, painting, cooling, carpentry…)
- Filter by salary range and date posted
- Save jobs to favourites
- Set alerts on jobs they're interested in
- Mark jobs as urgent
- Apply to a job directly via WhatsApp with one tap
- Track earnings and payment history
- Personal profile with skills, city, and bio

### For Employers
- Post a job in seconds (title, category, description, location, price range)
- Browse a directory of available workers filtered by skill
- Contact any worker directly via WhatsApp

### General
- Onboarding flow — choose role (worker or employer), set up profile
- Pull-to-refresh on the jobs list
- Fully Arabic (RTL) UI
- Works offline (data stored in localStorage)
- No sign-up, no backend, no app store

---

## Cities Supported
Casablanca (الدار البيضاء) — with neighbourhoods including الحي الحسني, الماركيه, عين السبع, بوسكورة

---

## Tech
- Pure HTML/CSS/JS — single `index.html`, no build step, no framework
- `localStorage` for all data persistence
- WhatsApp deep links (`wa.me`) for all contact
- Hosted on Vercel (auto-deploys on push to `master`)

---

## Verify Live Version
Scroll to the bottom of the deployed page — a small label shows the build ID matching the latest `master` commit.
