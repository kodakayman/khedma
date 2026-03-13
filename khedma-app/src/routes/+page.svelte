<script>
  import { onMount } from 'svelte';
  
  // Mock data - will move to stores later
  let jobs = [];
  let showPostModal = false;
  let selectedCategory = 'all';
  let searchQuery = '';
  
  const categories = [
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'cleaning', ar: 'تنظيف', en: 'Cleaning' },
    { id: 'moving', ar: 'نقل', en: 'Moving' },
    { id: 'repairs', ar: 'إصلاحات', en: 'Repairs' },
    { id: 'gardening', ar: 'حدائق', en: 'Gardening' },
    { id: 'tutoring', ar: 'دروس', en: 'Tutoring' },
    { id: 'delivery', ar: 'توصيل', en: 'Delivery' }
  ];
  
  const mockJobs = [
    { id: 1, title: 'تنظيف شقة', city: 'الدار البيضاء', price: 300, category: 'cleaning', urgency: 'urgent', date: 'today' },
    { id: 2, title: 'نقل أثاث', city: 'الرباط', price: 500, category: 'moving', urgency: 'regular', date: 'tomorrow' },
    { id: 3, title: 'إصلاح كهرباء', city: 'مراكش', price: 200, category: 'repairs', urgency: 'today', date: 'today' },
    { id: 4, title: 'صيانة حديقة', city: 'فاس', price: 250, category: 'gardening', urgency: 'regular', date: 'week' },
    { id: 5, title: 'درس خصوصي رياضيات', city: 'الدار البيضاء', price: 150, category: 'tutoring', urgency: 'regular', date: 'tomorrow' },
    { id: 6, title: 'توصيل طرد', city: 'الرباط', price: 100, category: 'delivery', urgency: 'urgent', date: 'today' },
  ];
  
  onMount(() => {
    jobs = mockJobs;
  });
  
  let filteredJobs = $derived(jobs.filter(job => {
    const categoryMatch = selectedCategory === 'all' || job.category === selectedCategory;
    const searchMatch = !searchQuery || job.title.includes(searchQuery) || job.city.includes(searchQuery);
    return categoryMatch && searchMatch;
  }));
  
  function getUrgencyStyle(urgency) {
    switch(urgency) {
      case 'urgent': return { bg: 'var(--urgent-bg)', text: 'var(--urgent)', label: 'عاجل' };
      case 'today': return { bg: 'var(--today-bg)', text: 'var(--today)', label: 'اليوم' };
      default: return { bg: 'var(--regular-bg)', text: 'var(--regular)', label: 'منتظم' };
    }
  }
</script>

<div class="app-shell">
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <div class="header-eyebrow">KHEDMA</div>
      <h1 class="header-title">أفضل العمال في مدينتك</h1>
    </div>
    <button class="btn-primary" on:click={() => showPostModal = true}>
      + انشر وظيفة
    </button>
  </header>
  
  <!-- Search & Filter -->
  <section class="search-section">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <input 
        type="text" 
        placeholder="ابحث عن وظيفة..." 
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    
    <div class="categories">
      {#each categories as cat}
        <button 
          class="category-pill {selectedCategory === cat.id ? 'active' : ''}"
          on:click={() => selectedCategory = cat.id}
        >
          {cat.ar}
        </button>
      {/each}
    </div>
  </section>
  
  <!-- Stats -->
  <section class="stats-row">
    <div class="stat-card">
      <span class="stat-number">{jobs.length}</span>
      <span class="stat-label">وظيفة</span>
    </div>
    <div class="stat-card">
      <span class="stat-number">12</span>
      <span class="stat-label">عامل</span>
    </div>
    <div class="stat-card">
      <span class="stat-number">6</span>
      <span class="stat-label">مدن</span>
    </div>
  </section>
  
  <!-- Jobs Grid -->
  <section class="jobs-grid">
    {#each filteredJobs as job (job.id)}
      {@const urgency = getUrgencyStyle(job.urgency)}
      <div class="job-card">
        <div class="job-header">
          <span class="job-category">{categories.find(c => c.id === job.category)?.ar || job.category}</span>
          <span class="job-urgency" style="background: {urgency.bg}; color: {urgency.text}">
            {urgency.label}
          </span>
        </div>
        
        <h3 class="job-title">{job.title}</h3>
        
        <div class="job-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {job.city}
        </div>
        
        <div class="job-footer">
          <span class="job-price">${job.price}</span>
          <a href="https://wa.me/212661228344?text=مرحبا، مهتم بوظيفة: {job.title}" class="btn-whatsapp">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            تواصل
          </a>
        </div>
      </div>
    {/each}
  </section>
  
  {#if filteredJobs.length === 0}
    <div class="empty-state">
      <p>لا توجد وظائف تطابق بحثك</p>
    </div>
  {/if}
</div>

<!-- Post Job Modal -->
{#if showPostModal}
  <div class="modal-overlay" on:click={() => showPostModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>انشر وظيفة جديدة</h2>
        <button class="close-btn" on:click={() => showPostModal = false}>×</button>
      </div>
      
      <form class="post-form">
        <div class="form-group">
          <label>عنوان الوظيفة</label>
          <input type="text" placeholder="مثال: تنظيف شقة كبيرة" />
        </div>
        
        <div class="form-group">
          <label>المدينة</label>
          <select>
            <option>الدار البيضاء</option>
            <option>الرباط</option>
            <option>مراكش</option>
            <option>فاس</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>الفئة</label>
          <select>
            {#each categories.slice(1) as cat}
              <option value={cat.id}>{cat.ar}</option>
            {/each}
          </select>
        </div>
        
        <div class="form-group">
          <label>السعر (درهم)</label>
          <input type="number" placeholder="300" />
        </div>
        
        <div class="form-group">
          <label>الوصف</label>
          <textarea placeholder="صف الوظيفة بالتفصيل..."></textarea>
        </div>
        
        <button type="submit" class="btn-submit">انشر الآن</button>
      </form>
    </div>
  </div>
{/if}

<style>
  :root {
    --background: #f2f6fb;
    --surface: #ffffff;
    --primary: #0f4c81;
    --primary-strong: #0a355a;
    --accent-mint: #5cc7a5;
    --text: #14263f;
    --text-muted: #5f728d;
    --border: #d6e2ef;
    --urgent: #b42318;
    --urgent-bg: #fdecea;
    --today: #b45309;
    --today-bg: #fff3e3;
    --regular: #0f766e;
    --regular-bg: #e8f8f3;
    --shadow-soft: 0 10px 28px rgba(15, 76, 129, 0.09);
    --radius-xl: 24px;
    --radius-lg: 18px;
    --radius-md: 14px;
  }
  
  :global(body) {
    font-family: 'Cairo', sans-serif;
    background: var(--background);
    margin: 0;
    padding: 0;
    color: var(--text);
  }
  
  .app-shell {
    max-width: 1120px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.97), rgba(247, 252, 255, 0.92));
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-soft);
    margin-bottom: 20px;
  }
  
  .header-eyebrow {
    font-family: 'Lexend', sans-serif;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 4px;
  }
  
  .header-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary:hover {
    background: var(--primary-strong);
  }
  
  .search-section {
    margin-bottom: 20px;
  }
  
  .search-box {
    position: relative;
    margin-bottom: 16px;
  }
  
  .search-icon {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    color: var(--text-muted);
  }
  
  .search-input {
    width: 100%;
    padding: 16px 48px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    font-size: 16px;
    font-family: inherit;
  }
  
  .categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .category-pill {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
  }
  
  .category-pill.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }
  
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .stat-card {
    background: white;
    padding: 16px;
    border-radius: var(--radius-md);
    text-align: center;
    border: 1px solid var(--border);
  }
  
  .stat-number {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--primary);
  }
  
  .stat-label {
    font-size: 13px;
    color: var(--text-muted);
  }
  
  .jobs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .job-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 20px;
    border: 1px solid var(--border);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .job-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .job-category {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .job-urgency {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 12px;
    font-weight: 600;
  }
  
  .job-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px;
  }
  
  .job-location {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: 16px;
  }
  
  .job-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .job-price {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary);
  }
  
  .btn-whatsapp {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #25D366;
    color: white;
    text-decoration: none;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 14px;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  
  .modal-content {
    background: white;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 18px;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: var(--text-muted);
  }
  
  .post-form {
    padding: 24px;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 15px;
  }
  
  .form-group textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .btn-submit {
    width: 100%;
    background: var(--primary);
    color: white;
    border: none;
    padding: 16px;
    border-radius: var(--radius-md);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
