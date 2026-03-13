<script lang="ts">
  import { jobsStats } from '$lib/stores';
</script>

<div class="stats-row">
  <div class="stat-card">
    <span class="stat-number">{$jobsStats.totalJobs}</span>
    <span class="stat-label">وظيفة</span>
  </div>
  <div class="stat-card">
    <span class="stat-number">{$jobsStats.cities}</span>
    <span class="stat-label">مدينة</span>
  </div>
  <div class="stat-card">
    <span class="stat-number">{$jobsStats.categories - 1}</span>
    <span class="stat-label">تخصص</span>
  </div>
</div>

<style>
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: white;
    padding: 16px;
    border-radius: 14px;
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
</style>
