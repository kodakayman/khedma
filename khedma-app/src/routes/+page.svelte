<script>
  import { showPostModal, filteredJobs } from '$lib/stores';
  import { SearchBar, CategoryPills, StatsCard, JobCard, PostJobModal } from '$lib/components';
</script>

<div class="app-shell">
  <!-- Header -->
  <header class="header">
    <div class="header-left">
      <div class="header-eyebrow">KHEDMA</div>
      <h1 class="header-title">أفضل العمال في مدينتك</h1>
    </div>
    <button class="btn-primary" on:click={() => showPostModal.set(true)}>
      + انشر وظيفة
    </button>
  </header>
  
  <!-- Search & Filter -->
  <section class="search-section">
    <SearchBar />
    <CategoryPills />
  </section>
  
  <!-- Stats -->
  <StatsCard />
  
  <!-- Jobs Grid -->
  <section class="jobs-grid">
    {#each $filteredJobs as job (job.id)}
      <JobCard {job} />
    {/each}
  </section>
  
  {#if $filteredJobs.length === 0}
    <div class="empty-state">
      <p>لا توجد وظائف تطابق بحثك</p>
    </div>
  {/if}
</div>

<PostJobModal />

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
    font-family: inherit;
  }
  
  .btn-primary:hover {
    background: var(--primary-strong);
  }
  
  .search-section {
    margin-bottom: 20px;
  }
  
  .jobs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }
</style>
