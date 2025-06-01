import { writable } from 'svelte/store';

export const sidebarVisible = writable(true);
export const settingsModalOpen = writable(false);
export const isGenerating = writable(false);
export const selectedText = writable('');
export const quickActionPosition = writable(null);
export const showScrollToBottom = writable(false);