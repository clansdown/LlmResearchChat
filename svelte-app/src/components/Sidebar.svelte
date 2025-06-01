<script>
  import { createEventDispatcher } from 'svelte';
  import { conversationHistory, searchQuery, filteredHistory } from '../stores/conversations.js';
  
  const dispatch = createEventDispatcher();
  
  let search = '';
  
  function loadConversation(conversation) {
    dispatch('load', conversation);
  }
  
  function deleteConversation(id, event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation?')) {
      conversationHistory.remove(id);
    }
  }
  
  function getPreview(messages) {
    if (!messages || messages.length === 0) return 'Empty conversation';
    const firstMessage = messages.find(m => m.role === 'user');
    if (!firstMessage) return 'No messages';
    return firstMessage.content.slice(0, 100) + (firstMessage.content.length > 100 ? '...' : '');
  }
  
  function formatDate(timestamp) {
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) { // Less than a week
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  }
  
  $: searchQuery.set(search);
</script>

<div class="sidebar">
  <div class="sidebar-header">
    <h2>Conversations</h2>
    <button class="new-button" on:click={() => dispatch('new')}>
      New Chat
    </button>
  </div>
  
  <div class="search-box">
    <input 
      type="text" 
      bind:value={search}
      placeholder="Search conversations..."
    />
  </div>
  
  <div class="conversation-list">
    {#each $filteredHistory as conversation (conversation.id)}
      <div 
        class="conversation-item"
        on:click={() => loadConversation(conversation)}
        on:keydown={(e) => e.key === 'Enter' && loadConversation(conversation)}
        tabindex="0"
        role="button"
      >
        <div class="conversation-preview">
          <div class="preview-text">{getPreview(conversation.messages)}</div>
          <div class="conversation-meta">
            <span class="date">{formatDate(conversation.id)}</span>
            {#if conversation.totalCost}
              <span class="cost">${conversation.totalCost.toFixed(4)}</span>
            {/if}
          </div>
        </div>
        <button 
          class="delete-button"
          on:click={(e) => deleteConversation(conversation.id, e)}
          title="Delete conversation"
        >
          ×
        </button>
      </div>
    {/each}
    
    {#if $filteredHistory.length === 0}
      <div class="empty-state">
        {search ? 'No conversations found' : 'No conversations yet'}
      </div>
    {/if}
  </div>
</div>

<style>
  .sidebar {
    width: 100%;
    height: 100%;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }
  
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .sidebar-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .new-button {
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color 0.2s;
  }
  
  .new-button:hover {
    background-color: #2563eb;
  }
  
  .search-box {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .search-box input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  
  .search-box input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  .conversation-list {
    flex: 1;
    overflow-y: auto;
  }
  
  .conversation-item {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .conversation-item:hover {
    background-color: #f3f4f6;
  }
  
  .conversation-item:focus {
    outline: none;
    background-color: #e5e7eb;
  }
  
  .conversation-preview {
    flex: 1;
    min-width: 0;
  }
  
  .preview-text {
    font-size: 0.9rem;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.25rem;
  }
  
  .conversation-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #6b7280;
  }
  
  .delete-button {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .conversation-item:hover .delete-button {
    opacity: 1;
  }
  
  .delete-button:hover {
    color: #ef4444;
  }
  
  .empty-state {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }
  
  /* Dark theme */
  :global(.dark) .sidebar {
    background: #1f2937;
    border-right-color: #374151;
  }
  
  :global(.dark) .sidebar-header {
    border-bottom-color: #374151;
  }
  
  :global(.dark) .sidebar-header h2 {
    color: #f3f4f6;
  }
  
  :global(.dark) .search-box {
    border-bottom-color: #374151;
  }
  
  :global(.dark) .search-box input {
    background-color: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :global(.dark) .search-box input:focus {
    border-color: #60a5fa;
  }
  
  :global(.dark) .conversation-item {
    border-bottom-color: #374151;
  }
  
  :global(.dark) .conversation-item:hover {
    background-color: #374151;
  }
  
  :global(.dark) .conversation-item:focus {
    background-color: #4b5563;
  }
  
  :global(.dark) .preview-text {
    color: #e5e7eb;
  }
  
  :global(.dark) .conversation-meta {
    color: #9ca3af;
  }
  
  :global(.dark) .empty-state {
    color: #9ca3af;
  }
</style>