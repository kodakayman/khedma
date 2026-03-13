// Job types
export interface Job {
  id: number;
  title: string;
  description: string;
  city: string;
  category: string;
  price: number;
  urgency: 'urgent' | 'today' | 'regular';
  date: string;
  postedAt?: string;
  clientName?: string;
  clientPhone?: string;
}

export interface Worker {
  id: number;
  name: string;
  city: string;
  categories: string[];
  rating: number;
  jobsCompleted: number;
  phone: string;
  avatar?: string;
  bio?: string;
}

export interface Category {
  id: string;
  ar: string;
  en: string;
  icon?: string;
}

export interface City {
  id: string;
  ar: string;
  en: string;
}
