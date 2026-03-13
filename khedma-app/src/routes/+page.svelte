<script>
  import { showPostModal, filteredJobs } from '$lib/stores';
  import { SearchBar, CategoryPills, JobCard, PostJobModal } from '$lib/components';
</script>

<div class="app-shell">
  <!-- Header -->
  <header class="header">
    <div class="header-top">
      <div class="logo">
        <span class="logo-icon">🔧</span>
        <span class="logo-text">KHEDMA</span>
      </div>
      <button class="post-btn" onclick={() => showPostModal.set(true)}>
        + انشر وظيفة
      </button>
    </div>
    
    <div class="hero">
      <h1>وظائف灵活性</h1>
      <p>اختر من بين أفضل العمال في منطقتك</p>
    </div>
  </header>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat">
      <span class="stat-num">{$filteredJobs.length}</span>
      <span class="stat-label">وظيفة متاحة</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-num">5</span>
      <span class="stat-label">مدن</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat">
      <span class="stat-num">7+</span>
      <span class="stat-label">تخصصات</span>
    </div>
  </div>
  
  <!-- Search -->
  <SearchBar />
  
  <!-- Categories -->
  <CategoryPills />
  
  <!-- Section Title -->
  <div class="section-header">
    <h2>أحدث الوظائف</h2>
    <span class="badge">{$filteredJobs.length} وظيفة</span>
  </div>
  
  <!-- Jobs Grid -->
  <div class="jobs-grid">
    {#each $filteredJobs as job (job.id)}
      <JobCard {job} />
    {/each}
  </div>
  
  {#if $filteredJobs.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🔍</span>
      <p>لا توجد وظائف تطابق بحثك</p>
      <button class="reset-btn" onclick={() => { import('$lib/stores').then(m => m.searchQuery.set('')); import('$lib/stores').then(m => m.selectedCategory.set('all')) }}>
        عرض كل الوظائف
      </button>
    </div>
  {/if}
</div>

<PostJobModal />

<style>
  :root {
    --primary: #0f4c81;
    --primary-dark: #0a355a;
    --success: #059669;
    --text: #111827;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --bg: #f9fafb;
  }
  
  :global(body) {
    font-family: 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    margin: 0;
    padding: 0;
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }
  
  .app-shell {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 16px 32px;
  }
  
  /* Header */
  .header {
    background: linear-gradient(135deg, #0f4c81 0%, #1e40af 100%);
    border-radius: 0 0 24px 24px;
    padding: 24px 20px 32px;
    margin: 0 -16px 24px;
    box-shadow: 0 4px 20px rgba(15, 76, 129, 0.25);
  }
  
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .logo-icon {
    font-size: 24px;
  }
  
  .logo-text {
    font-size: 20px;
    font-weight: 800;
    color: white;
    letter-spacing: 0.5px;
  }
  
  .post-btn {
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .post-btn:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .hero h1 {
    color: white;
    font-size: 28px;
    font-weight: 800;
    margin: 0 0 8px;
  }
  
  .hero p {
    color: rgba(255,255,255,0.8);
    font-size: 15px;
    margin: 0;
  }
  
  /* Stats Bar */
  .stats-bar {
    background: white;
    border-radius: 16px;
    padding: 16px 24px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  
  .stat {
    text-align: center;
  }
  
  .stat-num {
    display: block;
    font-size: 24px;
    font-weight: 800;
    color: var(--primary);
  }
  
  .stat-label {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .stat-divider {
    width: 1px;
    height: 32px;
    background: #e5e7eb;
  }
  
  /* Section */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 24px 0 16px;
  }
  
  .section-header h2 {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  
  .badge {
    background: #f0f9ff;
    color: #0284c7;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 12px;
  }
  
  /* Jobs Grid */
  .jobs-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 48px 24px;
  }
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .empty-state p {
    color: var(--text-muted);
    margin: 0 0 16px;
  }
  
  .reset-btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  @media (min-width: 640px) {
    .app-shell {
      max-width: 600px;
    }
    
    .jobs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .app-shell {
      max-width: 900px;
    }
    
    .jobs-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
