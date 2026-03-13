<script lang="ts">
  import { showPostModal, addToast } from '$lib/stores';
  import { CATEGORIES, CITIES } from '$lib/constants';
  import { jobs } from '$lib/stores/jobs';
  import { get } from 'svelte/store';

  let title = '';
  let description = '';
  let city = 'casablanca';
  let category = 'cleaning';
  let price = '';
  let urgency = 'regular';

  function close() {
    showPostModal.set(false);
    resetForm();
  }

  function resetForm() {
    title = '';
    description = '';
    city = 'casablanca';
    category = 'cleaning';
    price = '';
    urgency = 'regular';
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    if (!title || !price) {
      addToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
      return;
    }

    const newJob = {
      id: Date.now(),
      title,
      description,
      city,
      category,
      price: Number(price),
      urgency: urgency as 'urgent' | 'today' | 'regular',
      date: 'today'
    };

    jobs.update(j => [newJob, ...j]);
    addToast('تم نشر الوظيفة بنجاح!', 'success');
    close();
  }
</script>

{#if $showPostModal}
  <div class="modal-overlay" on:click={close} on:keypress={() => {}} role="button" tabindex="0">
    <div class="modal-content" on:click|stopPropagation on:keypress={() => {}} role="dialog">
      <div class="modal-header">
        <h2>انشر وظيفة جديدة</h2>
        <button class="close-btn" on:click={close}>×</button>
      </div>
      
      <form class="post-form" on:submit={handleSubmit}>
        <div class="form-group">
          <label for="title">عنوان الوظيفة *</label>
          <input 
            id="title"
            type="text" 
            placeholder="مثال: تنظيف شقة كبيرة"
            bind:value={title}
            required
          />
        </div>
        
        <div class="form-group">
          <label for="description">الوصف</label>
          <textarea 
            id="description"
            placeholder="صف الوظيفة بالتفصيل..."
            bind:value={description}
          ></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="city">المدينة *</label>
            <select id="city" bind:value={city}>
              {#each CITIES as c}
                <option value={c.id}>{c.ar}</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label for="category">الفئة *</label>
            <select id="category" bind:value={category}>
              {#each CATEGORIES.filter(c => c.id !== 'all') as cat}
                <option value={cat.id}>{cat.ar}</option>
              {/each}
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="price">السعر (درهم) *</label>
            <input 
              id="price"
              type="number" 
              placeholder="300"
              bind:value={price}
              required
            />
          </div>
          
          <div class="form-group">
            <label for="urgency">السرعة</label>
            <select id="urgent" bind:value={urgency}>
              <option value="urgent">عاجل</option>
              <option value="today">اليوم</option>
              <option value="regular">منتظم</option>
            </select>
          </div>
        </div>
        
        <button type="submit" class="btn-submit">انشر الآن</button>
      </form>
    </div>
  </div>
{/if}

<style>
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
    border-radius: 24px;
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
    line-height: 1;
  }

  .post-form {
    padding: 24px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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
    border-radius: 14px;
    font-family: inherit;
    font-size: 15px;
    box-sizing: border-box;
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
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-submit:hover {
    background: var(--primary-strong);
  }
</style>
