<script lang="ts">
  import { searchQuery } from '$lib/stores';
  
  let query = $state('');
  
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    query = target.value;
    searchQuery.set(query);
  }
</script>

<div class="search-box">
  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
  <input 
    type="text" 
    placeholder="ابحث عن وظيفة..."
    value={query}
    oninput={handleInput}
    class="search-input"
  />
  {#if query}
    <button class="clear-btn" onclick={() => { query = ''; searchQuery.set(''); }}>
      ×
    </button>
  {/if}
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
    color: #9ca3af;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 14px 44px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    font-size: 15px;
    font-family: inherit;
    box-sizing: border-box;
    background: white;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(15, 76, 129, 0.1);
  }

  .clear-btn {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: #e5e7eb;
    border: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 16px;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
