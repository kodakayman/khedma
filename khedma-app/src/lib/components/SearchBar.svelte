<script lang="ts">
  import { searchQuery } from '$lib/stores';
</script>

<div class="search-box">
  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
  <input 
    type="text" 
    placeholder="ابحث عن وظيفة..."
    bind:value={$searchQuery}
    class="search-input"
  />
</div>

<style>
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
    border-radius: 18px;
    font-size: 16px;
    font-family: inherit;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(15, 76, 129, 0.1);
  }
</style>
