import { writable, derived } from 'svelte/store';
import type { Job } from '$lib/types';

// Jobs store
export const jobs = writable<Job[]>([]);

// Selected category filter
export const selectedCategory = writable<string>('all');

// Search query
export const searchQuery = writable<string>('');

// Filtered jobs
export const filteredJobs = derived(
  [jobs, selectedCategory, searchQuery],
  ([$jobs, $selectedCategory, $searchQuery]) => {
    return $jobs.filter(job => {
      const categoryMatch = $selectedCategory === 'all' || job.category === $selectedCategory;
      const searchMatch = !$searchQuery || 
        job.title.includes($searchQuery) || 
        job.city.includes($searchQuery) ||
        job.description.includes($searchQuery);
      return categoryMatch && searchMatch;
    });
  }
);

// Stats derived from jobs
export const jobsStats = derived(jobs, ($jobs) => {
  const cities = new Set($jobs.map(j => j.city));
  const categories = new Set($jobs.map(j => j.category));
  
  return {
    totalJobs: $jobs.length,
    cities: cities.size,
    categories: categories.size
  };
});

// Loading state
export const isLoading = writable<boolean>(false);

// Mock jobs data
export const mockJobs: Job[] = [
  { id: 1, title: 'تنظيف شقة كبيرة', description: 'شقة 3 غرف تحتاج تنظيف كامل', city: 'casablanca', price: 300, category: 'cleaning', urgency: 'urgent', date: 'today' },
  { id: 2, title: 'نقل أثاث', description: 'نقل أثاث من شقة إلى أخرى', city: 'rabat', price: 500, category: 'moving', urgency: 'regular', date: 'tomorrow' },
  { id: 3, title: 'إصلاح كهرباء', description: 'إصلاح قاطع كهرباء في المطبخ', city: 'marrakech', price: 200, category: 'repairs', urgency: 'today', date: 'today' },
  { id: 4, title: 'صيانة حديقة', description: 'تقليم الأشجار وتنظيف الحديقة', city: 'fes', price: 250, category: 'gardening', urgency: 'regular', date: 'week' },
  { id: 5, title: 'درس خصوصي رياضيات', description: 'لسنة أولى بكالوريا', city: 'casablanca', price: 150, category: 'tutoring', urgency: 'regular', date: 'tomorrow' },
  { id: 6, title: 'توصيل طرد', description: 'توصيل طرد مهم للرباط', city: 'rabat', price: 100, category: 'delivery', urgency: 'urgent', date: 'today' },
  { id: 7, title: 'طبخ عشاء', description: 'طبخ عشاء لعائلة 5 أشخاص', city: 'marrakech', price: 350, category: 'cooking', urgency: 'regular', date: 'tomorrow' },
  { id: 8, title: 'دهان غرفة', description: 'دهان غرفة نوم بلون أزرق', city: 'tangier', price: 400, category: 'painting', urgency: 'regular', date: 'week' },
];

// Initialize with mock data
jobs.set(mockJobs);
