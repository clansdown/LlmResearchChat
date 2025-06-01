import { writable, derived } from 'svelte/store';

// Default settings
const defaultSettings = {
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  theme: 'dark',
  fontSize: 'medium',
  sidebarWidth: 300,
  sidebarVisible: true,
  autoSave: true,
  webSearchPlugin: true,
  defaultSystemPrompt: null,
  systemPrompts: []
};

// Create writable store for settings
function createSettingsStore() {
  // Load settings from localStorage
  const stored = localStorage.getItem('llm-chat-settings');
  const initial = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  
  const { subscribe, set, update } = writable(initial);
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      localStorage.setItem('llm-chat-settings', JSON.stringify(value));
    },
    update: (fn) => {
      update((settings) => {
        const newSettings = fn(settings);
        localStorage.setItem('llm-chat-settings', JSON.stringify(newSettings));
        return newSettings;
      });
    },
    reset: () => {
      set(defaultSettings);
      localStorage.setItem('llm-chat-settings', JSON.stringify(defaultSettings));
    }
  };
}

export const settings = createSettingsStore();

// Derived stores for specific settings
export const theme = derived(settings, $settings => $settings.theme);
export const fontSize = derived(settings, $settings => $settings.fontSize);
export const apiKey = derived(settings, $settings => $settings.apiKey);
export const model = derived(settings, $settings => $settings.model);
export const webSearchPlugin = derived(settings, $settings => $settings.webSearchPlugin);