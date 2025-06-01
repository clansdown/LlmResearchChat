<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { settings } from '../stores/settings.js';
  import { getAvailableModels } from '../services/api.js';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let localSettings = {};
  let models = [];
  let loadingModels = false;
  let newPromptName = '';
  let newPromptContent = '';
  let newPromptMode = 'once';
  
  onMount(async () => {
    localSettings = { ...$settings };
    await loadModels();
  });
  
  async function loadModels() {
    loadingModels = true;
    models = await getAvailableModels();
    loadingModels = false;
  }
  
  function save() {
    settings.set(localSettings);
    dispatch('close');
  }
  
  function cancel() {
    localSettings = { ...$settings };
    dispatch('close');
  }
  
  function addSystemPrompt() {
    if (newPromptName && newPromptContent) {
      localSettings.systemPrompts = [
        ...localSettings.systemPrompts,
        {
          id: Date.now().toString(),
          name: newPromptName,
          content: newPromptContent,
          mode: newPromptMode
        }
      ];
      newPromptName = '';
      newPromptContent = '';
      newPromptMode = 'once';
    }
  }
  
  function deleteSystemPrompt(id) {
    localSettings.systemPrompts = localSettings.systemPrompts.filter(p => p.id !== id);
    if (localSettings.defaultSystemPrompt === id) {
      localSettings.defaultSystemPrompt = null;
    }
  }
  
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      cancel();
    }
  }
</script>

{#if open}
  <div class="modal-overlay" on:click={cancel} on:keydown={handleKeydown}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="close-button" on:click={cancel}>×</button>
      </div>
      
      <div class="modal-content">
        <div class="settings-section">
          <h3>API Configuration</h3>
          <label>
            <span>OpenRouter API Key</span>
            <input 
              type="password" 
              bind:value={localSettings.apiKey}
              placeholder="sk-or-v1-..."
            />
          </label>
          
          <label>
            <span>Model</span>
            <select bind:value={localSettings.model} disabled={loadingModels}>
              {#if loadingModels}
                <option>Loading models...</option>
              {:else}
                {#each models as model}
                  <option value={model.id}>{model.name}</option>
                {/each}
              {/if}
            </select>
          </label>
        </div>
        
        <div class="settings-section">
          <h3>Appearance</h3>
          <label>
            <span>Theme</span>
            <select bind:value={localSettings.theme}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          
          <label>
            <span>Font Size</span>
            <select bind:value={localSettings.fontSize}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
        
        <div class="settings-section">
          <h3>Features</h3>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={localSettings.autoSave} />
            <span>Auto-save conversations</span>
          </label>
          
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={localSettings.webSearchPlugin} />
            <span>Enable web search for AI</span>
          </label>
        </div>
        
        <div class="settings-section">
          <h3>System Prompts</h3>
          <div class="system-prompts">
            {#each localSettings.systemPrompts as prompt}
              <div class="prompt-item">
                <div class="prompt-header">
                  <input 
                    type="radio" 
                    name="defaultPrompt" 
                    bind:group={localSettings.defaultSystemPrompt} 
                    value={prompt.id}
                  />
                  <span class="prompt-name">{prompt.name}</span>
                  <span class="prompt-mode">{prompt.mode}</span>
                  <button class="delete-prompt" on:click={() => deleteSystemPrompt(prompt.id)}>
                    ×
                  </button>
                </div>
                <div class="prompt-content">{prompt.content}</div>
              </div>
            {/each}
          </div>
          
          <div class="add-prompt">
            <input 
              type="text" 
              bind:value={newPromptName}
              placeholder="Prompt name"
            />
            <textarea 
              bind:value={newPromptContent}
              placeholder="Prompt content"
              rows="3"
            />
            <div class="prompt-controls">
              <select bind:value={newPromptMode}>
                <option value="once">Once (at start)</option>
                <option value="always">Always (every message)</option>
              </select>
              <button on:click={addSystemPrompt}>Add Prompt</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={cancel}>Cancel</button>
        <button class="save-button" on:click={save}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #6b7280;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-button:hover {
    color: #374151;
  }
  
  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }
  
  .settings-section {
    margin-bottom: 2rem;
  }
  
  .settings-section:last-child {
    margin-bottom: 0;
  }
  
  .settings-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
  }
  
  label {
    display: block;
    margin-bottom: 1rem;
  }
  
  label span {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
    color: #4b5563;
  }
  
  input[type="text"],
  input[type="password"],
  select,
  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 1rem;
  }
  
  input[type="text"]:focus,
  input[type="password"]:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .checkbox-label input {
    width: auto;
  }
  
  .system-prompts {
    margin-bottom: 1rem;
  }
  
  .prompt-item {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }
  
  .prompt-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .prompt-name {
    font-weight: 500;
    flex: 1;
  }
  
  .prompt-mode {
    font-size: 0.8rem;
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .delete-prompt {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .delete-prompt:hover {
    color: #ef4444;
  }
  
  .prompt-content {
    font-size: 0.9rem;
    color: #6b7280;
    white-space: pre-wrap;
  }
  
  .add-prompt {
    border: 1px dashed #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
  }
  
  .add-prompt input,
  .add-prompt textarea {
    margin-bottom: 0.5rem;
  }
  
  .prompt-controls {
    display: flex;
    gap: 0.5rem;
  }
  
  .prompt-controls select {
    flex: 1;
  }
  
  .prompt-controls button {
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  
  .prompt-controls button:hover {
    background-color: #2563eb;
  }
  
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  
  .cancel-button,
  .save-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .cancel-button {
    background: #e5e7eb;
    color: #374151;
  }
  
  .cancel-button:hover {
    background: #d1d5db;
  }
  
  .save-button {
    background: #3b82f6;
    color: white;
  }
  
  .save-button:hover {
    background: #2563eb;
  }
  
  /* Dark theme */
  :global(.dark) .modal {
    background: #1f2937;
    color: #f3f4f6;
  }
  
  :global(.dark) .modal-header {
    border-bottom-color: #374151;
  }
  
  :global(.dark) .close-button {
    color: #9ca3af;
  }
  
  :global(.dark) .close-button:hover {
    color: #d1d5db;
  }
  
  :global(.dark) .settings-section h3 {
    color: #e5e7eb;
  }
  
  :global(.dark) label span {
    color: #d1d5db;
  }
  
  :global(.dark) input[type="text"],
  :global(.dark) input[type="password"],
  :global(.dark) select,
  :global(.dark) textarea {
    background-color: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :global(.dark) input[type="text"]:focus,
  :global(.dark) input[type="password"]:focus,
  :global(.dark) select:focus,
  :global(.dark) textarea:focus {
    border-color: #60a5fa;
  }
  
  :global(.dark) .prompt-item {
    border-color: #374151;
  }
  
  :global(.dark) .prompt-mode {
    background: #374151;
    color: #d1d5db;
  }
  
  :global(.dark) .prompt-content {
    color: #d1d5db;
  }
  
  :global(.dark) .add-prompt {
    border-color: #4b5563;
  }
  
  :global(.dark) .modal-footer {
    border-top-color: #374151;
  }
  
  :global(.dark) .cancel-button {
    background: #374151;
    color: #e5e7eb;
  }
  
  :global(.dark) .cancel-button:hover {
    background: #4b5563;
  }
</style>