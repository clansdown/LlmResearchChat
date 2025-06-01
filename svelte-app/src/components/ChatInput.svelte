<script>
  import { createEventDispatcher } from 'svelte';
  
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  let input = '';
  let textarea;
  
  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function sendMessage() {
    if (input.trim() && !disabled) {
      dispatch('send', input.trim());
      input = '';
      textarea.style.height = 'auto';
    }
  }
  
  function adjustHeight() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
</script>

<div class="chat-input" class:disabled>
  <textarea
    bind:this={textarea}
    bind:value={input}
    on:keydown={handleKeydown}
    on:input={adjustHeight}
    placeholder={disabled ? 'Generating response...' : 'Type your message...'}
    {disabled}
    rows="1"
  />
  <button 
    on:click={sendMessage} 
    {disabled}
    class:has-content={input.trim()}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</div>

<style>
  .chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    background: white;
    border-top: 1px solid #e5e7eb;
    align-items: flex-end;
  }
  
  .chat-input.disabled {
    opacity: 0.7;
  }
  
  textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    resize: none;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    overflow-y: auto;
    transition: border-color 0.2s;
  }
  
  textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  textarea:disabled {
    background-color: #f9fafb;
    cursor: not-allowed;
  }
  
  button {
    padding: 0.75rem;
    background-color: #e5e7eb;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: #9ca3af;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  button:not(:disabled):hover {
    background-color: #d1d5db;
  }
  
  button.has-content:not(:disabled) {
    background-color: #3b82f6;
    color: white;
  }
  
  button.has-content:not(:disabled):hover {
    background-color: #2563eb;
  }
  
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  /* Dark theme */
  :global(.dark) .chat-input {
    background: #1f2937;
    border-top-color: #374151;
  }
  
  :global(.dark) textarea {
    background-color: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :global(.dark) textarea:focus {
    border-color: #60a5fa;
  }
  
  :global(.dark) textarea:disabled {
    background-color: #1f2937;
  }
  
  :global(.dark) button {
    background-color: #374151;
    color: #6b7280;
  }
  
  :global(.dark) button:not(:disabled):hover {
    background-color: #4b5563;
  }
</style>