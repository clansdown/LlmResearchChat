<script>
  import MarkdownRenderer from './MarkdownRenderer.svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let message;
  export let index;
  export let isGenerating = false;
  
  const dispatch = createEventDispatcher();
  
  let isEditing = false;
  let editContent = '';
  
  function startEdit() {
    if (message.role === 'user') {
      isEditing = true;
      editContent = message.content;
    }
  }
  
  function saveEdit() {
    dispatch('edit', { index, content: editContent });
    isEditing = false;
  }
  
  function cancelEdit() {
    isEditing = false;
    editContent = '';
  }
  
  function toggleVisibility() {
    dispatch('toggleVisibility', index);
  }
  
  function deleteMessage() {
    if (confirm('Are you sure you want to delete this message?')) {
      dispatch('delete', index);
    }
  }
</script>

<div class="message {message.role}" class:hidden-from-llm={message.hiddenFromLLM}>
  <div class="message-header">
    <span class="role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
    {#if message.model}
      <span class="model">{message.model}</span>
    {/if}
    {#if message.cost}
      <span class="cost">${message.cost.toFixed(4)}</span>
    {/if}
    <div class="actions">
      {#if message.role === 'user'}
        <button class="action-button" on:click={startEdit} title="Edit">
          ✏️
        </button>
      {/if}
      <button 
        class="action-button" 
        on:click={toggleVisibility} 
        title={message.hiddenFromLLM ? 'Hidden from LLM' : 'Visible to LLM'}
      >
        {message.hiddenFromLLM ? '👁️‍🗨️' : '👁️'}
      </button>
      <button class="action-button" on:click={deleteMessage} title="Delete">
        🗑️
      </button>
    </div>
  </div>
  
  <div class="message-content">
    {#if isEditing}
      <textarea 
        bind:value={editContent}
        on:keydown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) saveEdit();
          if (e.key === 'Escape') cancelEdit();
        }}
      />
      <div class="edit-actions">
        <button on:click={saveEdit}>Save</button>
        <button on:click={cancelEdit}>Cancel</button>
      </div>
    {:else if isGenerating}
      <div class="generating">
        {message.content}
        <span class="cursor">▊</span>
      </div>
    {:else}
      <MarkdownRenderer content={message.content} />
    {/if}
  </div>
</div>

<style>
  .message {
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 8px;
    animation: fadeIn 0.3s ease-in;
  }
  
  .message.user {
    background-color: #e3f2fd;
    margin-left: 2rem;
  }
  
  .message.assistant {
    background-color: #f5f5f5;
    margin-right: 2rem;
  }
  
  .message.hidden-from-llm {
    opacity: 0.7;
    border: 2px dashed #999;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .role {
    font-weight: bold;
    color: #555;
  }
  
  .model {
    color: #888;
    font-size: 0.85rem;
  }
  
  .cost {
    color: #666;
    font-size: 0.85rem;
    margin-left: auto;
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }
  
  .action-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  
  .action-button:hover {
    opacity: 1;
  }
  
  .message-content {
    color: #333;
  }
  
  textarea {
    width: 100%;
    min-height: 100px;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    font-family: inherit;
    font-size: inherit;
  }
  
  .edit-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .edit-actions button {
    padding: 0.25rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
  
  .edit-actions button:hover {
    background: #f5f5f5;
  }
  
  .generating {
    position: relative;
  }
  
  .cursor {
    animation: blink 1s infinite;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  /* Dark theme */
  :global(.dark) .message.user {
    background-color: #1e3a8a;
    color: #e0e7ff;
  }
  
  :global(.dark) .message.assistant {
    background-color: #374151;
    color: #f3f4f6;
  }
  
  :global(.dark) .role,
  :global(.dark) .model,
  :global(.dark) .cost {
    color: #d1d5db;
  }
  
  :global(.dark) .message-content {
    color: inherit;
  }
  
  :global(.dark) textarea {
    background-color: #1f2937;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :global(.dark) .edit-actions button {
    background: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :global(.dark) .edit-actions button:hover {
    background: #4b5563;
  }
</style>