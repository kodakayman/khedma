<script lang="ts">
  import type { Job } from '$lib/types';
  import { CATEGORIES, CITIES, WHATSAPP_CONTACT } from '$lib/constants';

  let { job, onClick = () => {} }: { job: Job; onClick?: (job: Job) => void } = $props();

  let category = $derived(CATEGORIES.find(c => c.id === job.category));
  let city = $derived(CITIES.find(c => c.id === job.city));

  let urgencyLabel = $derived({
    urgent: 'عاجل',
    today: 'اليوم',
    regular: job.date
  }[job.urgency]);

  function handleApply(e: Event) {
    e.stopPropagation();
    const text = `مرحبا، مهتم بوظيفة: ${job.title} - ${category?.ar}`;
    window.open(`https://wa.me/${WHATSAPP_CONTACT}?text=${encodeURIComponent(text)}`, '_blank');
  }

  function handleClick() {
    onClick(job);
  }
</script>

<div class="job-card" onclick={handleClick} onkeypress={(e) => e.key === 'Enter' && handleClick()} role="button" tabindex="0">
  <!-- Header: Category + Date -->
  <div class="card-header">
    <span class="category-badge">{category?.ar || job.category}</span>
    <span class="date">{urgencyLabel}</span>
  </div>

  <!-- Job Title -->
  <h3 class="job-title">{job.title}</h3>
  
  <!-- Description -->
  {#if job.description}
    <p class="description">{job.description}</p>
  {/if}

  <!-- Company/Client -->
  <div class="company-row">
    <span class="company-icon">🏢</span>
    <span class="company-name">عميل موثوق</span>
    <span class="rating">★ 4.8</span>
  </div>

  <!-- Location -->
  <div class="location-row">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
    <span>{city?.ar || job.city}</span>
  </div>

  <!-- Footer: Price + Apply -->
  <div class="card-footer">
    <div class="price">
      <span class="price-amount">{job.price}</span>
      <span class="price-currency">DH</span>
      <span class="price-period">/ يوم</span>
    </div>
    <button class="apply-btn" onclick={handleApply}>
      تقدم الآن
    </button>
  </div>

  <!-- Meta: Positions -->
  <div class="meta">
    <span class="positions">3 متقدمين • ينتهي قريبا</span>
  </div>
</div>

<style>
  .job-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .job-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.12);
    border-color: #0f4c81;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .category-badge {
    background: #f0f9ff;
    color: #0284c7;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
  }

  .date {
    font-size: 13px;
    color: #6b7280;
  }

  .job-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px;
    color: #111827;
    line-height: 1.3;
  }

  .description {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 12px;
    line-height: 1.4;
  }

  .company-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }

  .company-icon {
    font-size: 14px;
  }

  .company-name {
    font-size: 13px;
    color: #374151;
    font-weight: 500;
  }

  .rating {
    margin-left: auto;
    font-size: 13px;
    color: #f59e0b;
    font-weight: 600;
  }

  .location-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .location-row svg {
    color: #9ca3af;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;
  }

  .price {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .price-amount {
    font-size: 28px;
    font-weight: 800;
    color: #059669;
  }

  .price-currency {
    font-size: 16px;
    font-weight: 600;
    color: #059669;
  }

  .price-period {
    font-size: 13px;
    color: #6b7280;
    margin-left: 2px;
  }

  .apply-btn {
    background: #0f4c81;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .apply-btn:hover {
    background: #0a355a;
  }

  .meta {
    margin-top: 12px;
    font-size: 12px;
    color: #9ca3af;
  }

  .positions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
