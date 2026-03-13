import type { Category, City } from './types';

export const CATEGORIES: Category[] = [
  { id: 'all', ar: 'الكل', en: 'All' },
  { id: 'cleaning', ar: 'تنظيف', en: 'Cleaning' },
  { id: 'moving', ar: 'نقل', en: 'Moving' },
  { id: 'repairs', ar: 'إصلاحات', en: 'Repairs' },
  { id: 'gardening', ar: 'حدائق', en: 'Gardening' },
  { id: 'tutoring', ar: 'دروس', en: 'Tutoring' },
  { id: 'delivery', ar: 'توصيل', en: 'Delivery' },
  { id: 'cooking', ar: 'طبخ', en: 'Cooking' },
  { id: 'painting', ar: 'دهان', en: 'Painting' },
  { id: 'plumbing', ar: 'سباكة', en: 'Plumbing' },
  { id: 'electrical', ar: 'كهرباء', en: 'Electrical' }
];

export const CITIES: City[] = [
  { id: 'casablanca', ar: 'الدار البيضاء', en: 'Casablanca' },
  { id: 'rabat', ar: 'الرباط', en: 'Rabat' },
  { id: 'marrakech', ar: 'مراكش', en: 'Marrakech' },
  { id: 'fes', ar: 'فاس', en: 'Fes' },
  { id: 'tangier', ar: 'طنجة', en: 'Tangier' },
  { id: 'agadir', ar: 'أغادير', en: 'Agadir' },
  { id: 'meknes', ar: 'مكناس', en: 'Meknes' },
  { id: 'oujda', ar: 'وجدة', en: 'Oujda' }
];

export const URGENCY_LABELS = {
  urgent: { ar: 'عاجل', en: 'Urgent' },
  today: { ar: 'اليوم', en: 'Today' },
  regular: { ar: 'منتظم', en: 'Regular' }
} as const;

export const WHATSAPP_CONTACT = '212661228344';
