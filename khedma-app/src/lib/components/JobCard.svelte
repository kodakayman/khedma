<script lang="ts">
  import type { Job } from '$lib/types';
  import { CATEGORIES, CITIES, WHATSAPP_CONTACT } from '$lib/constants';

  export let job: Job;
  export let onClick: (job: Job) => void = () => {};

  $: category = CATEGORIES.find(c => c.id === job.category);
  $: city = CITIES.find(c => c.id === job.city);

  const urgencyStyles = {
    urgent: { bg: '#fdecea', color: '#b42318', label: 'عاجل' },
    today: { bg: '#fff3e3', color: '#b45309', label: 'الآن' },
    regular: { bg: '#e8f8f3', color: '#0f766e', label: 'منتظم' }
  };

  $: urgency = urgencyStyles[job.urgency];

  function handleWhatsApp(e: Event) {
    e.stopPropagation();
    const text = `مرحبا، مهتم بوظيفة: ${job.title} في ${city?.ar || job.city}`;
    window.open(`https://wa.me/${WHATSAPP_CONTACT}?text=${encodeURIComponent(text)}`, '_blank');
  }
</script>

<div 
  class="job-card" 
  on:click={() => onClick(job)}
  on:keypress={(e) => e.key === 'Enter' && onClick(job)}
  role="button"
  tabindex="0"
>
  <div class="job-header">
    <span class="job-category">{category?.ar || job.category}</span>
    <span class="job-urgency" style="background: {urgency.bg}; color: {urgency.color}">
      {urgency.label}
    </span>
  </div>
  
  <h3 class="job-title">{job.title}</h3>
  
  {#if job.description}
    <p class="job-description">{job.description}</p>
  {/if}
  
  <div class="job-location">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
    {city?.ar || job.city}
  </div>
  
  <div class="job-footer">
    <span class="job-price">{job.price} DH</span>
    <button class="btn-whatsapp" on:click={handleWhatsApp}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      تواصل
    </button>
  </div>
</div>

<style>
  .job-card {
    background: white;
    border-radius: 18px;
    padding: 20px;
    border: 1px solid var(--border);
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
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
    margin: 0 0 8px;
  }

  .job-description {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0 0 12px;
    line-height: 1.4;
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
    border: none;
    padding: 10px 16px;
    border-radius: 14px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-whatsapp:hover {
    background: #20BD5A;
  }
</style>
