/* ============================================================
   KHEDMA — Jobs page logic
   Depends on: js/shared.js
   ============================================================ */

let allJobs      = [];
let activeCategory = 'all';
let searchQuery  = '';
let _realtimeSub = null;

/* ── Load from Supabase (with localStorage cache fallback) ── */
async function loadJobs() {
  showJobsSkeleton();
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      allJobs = data || [];
      LS.set('jobs_cache', allJobs);
    } else {
      allJobs = LS.get('jobs_cache', []);
    }
  } catch (err) {
    console.warn('loadJobs:', err.message);
    allJobs = LS.get('jobs_cache', []);
  }
  applyFilters();
  loadStats();
}

/* ── Realtime: new jobs appear without page refresh ── */
function subscribeRealtime() {
  if (!supabase) return;
  _realtimeSub = supabase
    .channel('jobs-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
      allJobs.unshift(payload.new);
      LS.set('jobs_cache', allJobs);
      applyFilters();
      showToast(t('newJobLive'));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, (payload) => {
      allJobs = allJobs.filter(j => j.id !== payload.old.id);
      LS.set('jobs_cache', allJobs);
      applyFilters();
    })
    .subscribe();
}

/* ── Stats from real DB counts ── */
async function loadStats() {
  const jobsEl    = document.getElementById('stat-jobs');
  const workersEl = document.getElementById('stat-workers');

  if (supabase) {
    try {
      const [jRes, wRes] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('workers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      if (jobsEl    && jRes.count !== null) jobsEl.textContent    = jRes.count;
      if (workersEl && wRes.count !== null) workersEl.textContent = wRes.count;
      return;
    } catch {}
  }
  /* fallback: count from local cache */
  if (jobsEl) jobsEl.textContent = allJobs.length || '—';
}

/* ── Filter & search ── */
function applyFilters() {
  let list = [...allJobs];
  if (activeCategory !== 'all') {
    list = list.filter(j => j.category === activeCategory);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter(j =>
      (j.title       || '').toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q) ||
      districtLabel(j.district).toLowerCase().includes(q) ||
      categoryLabel(j.category).toLowerCase().includes(q)
    );
  }
  renderJobs(list);
}

function setCategory(catId, el) {
  activeCategory = catId;
  document.querySelectorAll('.cat-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.cat === catId)
  );
  applyFilters();
}

function handleSearch(q) {
  searchQuery = q;
  applyFilters();
}

/* ── Render ── */
function showJobsSkeleton() {
  const c = document.getElementById('jobs-list');
  if (!c) return;
  c.innerHTML = [1,2,3].map(() => `
    <div class="skeleton-card">
      <div class="flex justify-between mb-12">
        <div class="skeleton sk-line sk-wide"></div>
        <div class="skeleton sk-line sk-short"></div>
      </div>
      <div class="skeleton sk-line sk-short"></div>
      <div class="skeleton sk-line sk-full mt-8"></div>
    </div>`).join('');
}

function renderJobs(list) {
  const c = document.getElementById('jobs-list');
  if (!c) return;
  if (!list || list.length === 0) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>${t('noJobs')}</h3>
        <p>${t('noJobsHint')}</p>
      </div>`;
    return;
  }
  c.innerHTML = list.map(renderJobCard).join('');
}

function renderJobCard(job) {
  const cat      = CONFIG.CATEGORIES.find(c => c.id === job.category);
  const catLabel = cat ? (cat[currentLang] || cat.ar) : job.category;
  const catIcon  = cat ? cat.icon : '💼';
  const district = districtLabel(job.district);
  const posted   = job.created_at ? timeAgo(job.created_at) : '';

  return `
    <a class="job-card" href="job-detail.html?id=${encodeURIComponent(job.id)}">
      <div class="job-card-top">
        <div class="job-title">${escapeHtml(job.title)}</div>
        <div>
          <div class="job-pay">${job.pay} <span class="job-pay-unit">${t('perHour')}</span></div>
          ${job.duration_hours ? `<div style="font-size:.68rem;color:var(--text-muted);text-align:center;">${job.duration_hours} ${t('hours')}</div>` : ''}
        </div>
      </div>
      <div class="job-meta">
        <span class="meta-pill cat">${catIcon} ${escapeHtml(catLabel)}</span>
        <span class="meta-pill">📍 ${escapeHtml(district)}</span>
        ${job.date ? `<span class="meta-pill">📅 ${formatDate(job.date)}</span>` : ''}
        ${job.start_time ? `<span class="meta-pill">🕐 ${job.start_time.slice(0,5)}</span>` : ''}
      </div>
      ${job.description ? `<p class="job-desc">${escapeHtml(job.description)}</p>` : ''}
      <div class="job-footer">
        <span class="job-posted">${t('postedAt')} ${posted}</span>
      </div>
    </a>`;
}
