import { writable } from 'svelte/store';

// Modal states
export const showPostModal = writable<boolean>(false);
export const showJobDetailModal = writable<boolean>(false);
export const selectedJobId = writable<number | null>(null);

// Toast notifications
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const toasts = writable<Toast[]>([]);

let toastId = 0;

export function addToast(message: string, type: Toast['type'] = 'info') {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type }]);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toasts.update(t => t.filter(toast => toast.id !== id));
  }, 3000);
}

// Page title
export const pageTitle = writable<string>('KHEDMA - أفضل العمال في مدينتك');
