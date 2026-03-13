<script lang="ts">
  import { CATEGORIES } from '$lib/constants';
  import { selectedCategory } from '$lib/stores';

  function selectCategory(id: string) {
    selectedCategory.set(id);
  }
</script>

<div class="categories">
  {#each CATEGORIES as cat}
    <button 
      class="category-pill {$selectedCategory === cat.id ? 'active' : ''}"
      onclick={() => selectCategory(cat.id)}
    >
      {cat.ar}
    </button>
  {/each}
</div>

<style>
  .categories {
    display: flex;
    gap: 8px;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .categories::-webkit-scrollbar {
    display: none;
  }

  .category-pill {
    flex-shrink: 0;
    padding: 10px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    color: #374151;
    white-space: nowrap;
  }

  .category-pill:hover {
    border-color: #0f4c81;
    color: #0f4c81;
  }

  .category-pill.active {
    background: #0f4c81;
    color: white;
    border-color: #0f4c81;
    box-shadow: 0 2px 8px rgba(15, 76, 129, 0.3);
  }
</style>
