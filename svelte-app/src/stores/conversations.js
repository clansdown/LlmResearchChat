import { writable, derived } from 'svelte/store';

// Store for current conversation
function createConversationStore() {
  const { subscribe, set, update } = writable({
    id: null,
    messages: [],
    totalCost: 0,
    systemPrompt: null
  });
  
  return {
    subscribe,
    set,
    update,
    addMessage: (message) => {
      update(conv => ({
        ...conv,
        messages: [...conv.messages, message],
        totalCost: conv.totalCost + (message.cost || 0)
      }));
    },
    updateMessage: (index, updates) => {
      update(conv => ({
        ...conv,
        messages: conv.messages.map((msg, i) => 
          i === index ? { ...msg, ...updates } : msg
        )
      }));
    },
    deleteMessage: (index) => {
      update(conv => ({
        ...conv,
        messages: conv.messages.filter((_, i) => i !== index)
      }));
    },
    new: () => {
      set({
        id: Date.now().toString(),
        messages: [],
        totalCost: 0,
        systemPrompt: null
      });
    },
    load: (conversation) => {
      set(conversation);
    }
  };
}

// Store for conversation history
function createHistoryStore() {
  // Load history from localStorage
  const stored = localStorage.getItem('llm-chat-history');
  const initial = stored ? JSON.parse(stored) : [];
  
  const { subscribe, set, update } = writable(initial);
  
  return {
    subscribe,
    add: (conversation) => {
      update(history => {
        const newHistory = [conversation, ...history.filter(c => c.id !== conversation.id)];
        localStorage.setItem('llm-chat-history', JSON.stringify(newHistory));
        return newHistory;
      });
    },
    remove: (id) => {
      update(history => {
        const newHistory = history.filter(c => c.id !== id);
        localStorage.setItem('llm-chat-history', JSON.stringify(newHistory));
        return newHistory;
      });
    },
    clear: () => {
      set([]);
      localStorage.removeItem('llm-chat-history');
    }
  };
}

export const currentConversation = createConversationStore();
export const conversationHistory = createHistoryStore();

// Derived store for search results
export const searchQuery = writable('');
export const filteredHistory = derived(
  [conversationHistory, searchQuery],
  ([$history, $query]) => {
    if (!$query) return $history;
    
    const lowerQuery = $query.toLowerCase();
    return $history.filter(conv => {
      const preview = conv.messages
        .map(m => m.content)
        .join(' ')
        .toLowerCase();
      return preview.includes(lowerQuery);
    });
  }
);