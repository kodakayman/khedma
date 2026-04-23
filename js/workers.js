/* ============================================================
   KHEDMA — Workers page logic
   Depends on: js/shared.js
   ============================================================ */

let allWorkers  = [];
let activeSkill = 'all';
let workerQuery = '';

/* ── Load from Supabase (with cache fallback) ── */
async function loadWorkers() {
  showWorkersSkeleton();
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      allWorkers = data || [];
      LS.set('workers_cache', allWorkers);
    } else {
      allWorkers = LS.get('workers_cache', []);
    }
  } catch (err) {
    console.warn('loadWorkers:', err.message);
    allWorkers = LS.get('workers_cache', []);
  }
  buildSkillChips();
  applyWorkerFilters();
}

/* ── Build skill filter chips dynamically from loaded data ── */
function buildSkillChips() {
  const bar = document.getElementById('worker-filter-bar');
  if (!bar) return;
  const skills = [...new Set(allWorkers.map(w => w.skill).filter(Boolean))];
  const all = `<span class="chip worker-chip active" data-skill="all" onclick="filterBySkill('all',this)">${t('allCategories')}</span>`;
  const rest = skills.map(skill => {
    const label = categoryLabel(skill);
    const icon  = categoryIcon(skill);
    return `<span class="chip worker-chip" data-skill="${escapeHtml(skill)}" onclick="filterBySkill('${escapeHtml(skill)}',this)">${icon} ${escapeHtml(label)}</span>`;
  }).join('');
  bar.innerHTML = all + rest;
}

function filterBySkill(skill, el) {
  activeSkill = skill;
  document.querySelectorAll('.worker-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.skill === skill)
  );
  applyWorkerFilters();
}

function handleWorkerSearch(q) {
  workerQuery = q;
  applyWorkerFilters();
}

function applyWorkerFilters() {
  let list = [...allWorkers];
  if (activeSkill !== 'all') {
    list = list.filter(w => w.skill === activeSkill);
  }
  if (workerQuery.trim()) {
    const q = workerQuery.toLowerCase();
    list = list.filter(w =>
      (w.name  || '').toLowerCase().includes(q) ||
      categoryLabel(w.skill).toLowerCase().includes(q) ||
      districtLabel(w.district).toLowerCase().includes(q)
    );
  }
  renderWorkers(list);
}

/* ── Render ── */
function showWorkersSkeleton() {
  const c = document.getElementById('workers-list');
  if (!c) return;
  c.innerHTML = [1,2,3].map(() => `
    <div class="skeleton-card" style="flex-direction:row;gap:14px;align-items:center;">
      <div class="skeleton" style="width:50px;height:50px;border-radius:50%;flex-shrink:0;"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
        <div class="skeleton sk-line sk-wide"></div>
        <div class="skeleton sk-line sk-short"></div>
      </div>
    </div>`).join('');
}

function renderWorkers(list) {
  const c = document.getElementById('workers-list');
  if (!c) return;
  if (!list || list.length === 0) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👷</div>
        <h3>${t('noWorkers')}</h3>
      </div>`;
    return;
  }
  c.innerHTML = list.map(renderWorkerCard).join('');
}

function renderWorkerCard(w) {
  const initial  = ((w.name || '?')[0]).toUpperCase();
  const district = districtLabel(w.district);
  const skill    = `${categoryIcon(w.skill)} ${categoryLabel(w.skill)}`;
  return `
    <a class="worker-card" href="worker-profile.html?id=${encodeURIComponent(w.id)}">
      <div class="worker-avatar">${initial}</div>
      <div class="worker-info">
        <div class="worker-name">${escapeHtml(w.name || '')}</div>
        <div class="worker-skill">${escapeHtml(skill)}</div>
        ${district ? `<div class="worker-district">📍 ${escapeHtml(district)}</div>` : ''}
      </div>
      <i class="fas fa-chevron-left worker-arrow"></i>
    </a>`;
}
