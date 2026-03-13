<script lang="ts">
  import { CATEGORIES } from '$lib/constants';
  import { selectedCategory } from '$lib/stores';
</script>

<div class="categories">
  {#each CATEGORIES as cat}
    <button 
      class="category-pill {$selectedCategory === cat.id ? 'active' : ''}"
      on:click={() => selectedCategory.set(cat.id)}
    >
      {cat.ar}
    </button>
  {/each}
</div>

<style>
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
    font-size: 14px;
    transition: all 0.2s;
    color: var(--text);
  }

  .category-pill:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  .category-pill.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }
</style>
