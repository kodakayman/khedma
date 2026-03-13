# KHEDMA App Structure

## Routes (src/routes/)
```
src/routes/
├── +layout.svelte      # Shared header/footer
├── +page.svelte         # Home - jobs listing
├── jobs/
│   ├── +page.svelte     # All jobs (filterable)
│   └── [id]/            # Job detail page
├── post/
│   └── +page.svelte     # Post new job form
├── workers/
│   └── +page.svelte     # Workers listing
└── profile/
    └── +page.svelte     # User profile
```

## Components (src/lib/components/)
```
src/lib/components/
├── Header.svelte        # Navigation header
├── Footer.svelte        # App footer
├── JobCard.svelte       # Job listing card
├── CategoryPills.svelte # Category filter pills
├── SearchBar.svelte     # Search input
├── JobModal.svelte      # Post job modal
├── WorkerCard.svelte    # Worker profile card
└── StatsCard.svelte    # Stats display
```

## Stores (src/lib/stores/)
```
src/lib/stores/
├── jobs.ts      # Jobs state
├── workers.ts   # Workers state
├── user.ts      # User auth state
└── ui.ts        # UI state (modals, toasts)
```

## Utils (src/lib/utils/)
```
src/lib/utils/
├── api.ts       # API calls
├── constants.ts # Categories, cities
├── types.ts     # TypeScript interfaces
└── helpers.ts   # Helper functions
```

## Static Assets (static/)
```
static/
├── fonts/       # Cairo, Lexend fonts
└── icons/       # SVG icons
```

---

**Priority for implementation:**
1. ✅ Jobs listing (current)
2. 🔄 Job detail page
3. 🔄 Post job form
4. ⏳ Workers listing
5. ⏳ User profile
6. ⏳ Real API integration

---

Want me to restructure now? I can create all the files and we can deploy incrementally.
