const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Conversations
  saveConversation: (conversation) => ipcRenderer.invoke('save-conversation', conversation),
  getConversationHistory: () => ipcRenderer.invoke('get-conversation-history'),
  addToHistory: (conversation) => ipcRenderer.invoke('add-to-history', conversation),
  loadConversationFile: (id) => ipcRenderer.invoke('load-conversation-file', id),
  
  // Event listeners
  onNewConversation: (callback) => ipcRenderer.on('new-conversation', callback),
  onLoadConversation: (callback) => ipcRenderer.on('load-conversation', (event, data) => callback(data)),
  onSaveConversation: (callback) => ipcRenderer.on('save-conversation', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Spellcheck
  getSpellcheckSuggestions: (word) => ipcRenderer.invoke('get-spellcheck-suggestions', word),
  
  // Models
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  
  // Delete conversation
  deleteConversation: (id) => ipcRenderer.invoke('delete-conversation', id),
  saveSidebarWidth: (width) => ipcRenderer.invoke('save-sidebar-width', width),
  saveSidebarVisibility: (visibility) => ipcRenderer.invoke('save-sidebar-visibility', visibility)
});
