<script>
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Message from './components/Message.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import { settings, theme, fontSize } from './stores/settings.js';
  import { currentConversation, conversationHistory } from './stores/conversations.js';
  import { sidebarVisible, settingsModalOpen, isGenerating, showScrollToBottom } from './stores/ui.js';
  import { sendMessage } from './services/api.js';
  
  let messagesContainer;
  let isAutoScrolling = true;
  
  onMount(() => {
    // Apply theme and font size
    const unsubscribeTheme = theme.subscribe(value => {
      document.documentElement.classList.toggle('dark', value === 'dark');
    });
    
    const unsubscribeFontSize = fontSize.subscribe(value => {
      document.documentElement.setAttribute('data-font-size', value);
    });
    
    // Initialize PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
      });
    }
    
    return () => {
      unsubscribeTheme();
      unsubscribeFontSize();
    };
  });
  
  function handleScroll() {
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      showScrollToBottom.set(!isAtBottom);
      isAutoScrolling = isAtBottom;
    }
  }
  
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }
  
  $: if (isAutoScrolling && $currentConversation.messages.length) {
    setTimeout(scrollToBottom, 100);
  }
  
  async function handleSendMessage(event) {
    const content = event.detail;
    
    // Add user message
    currentConversation.addMessage({
      role: 'user',
      content,
      timestamp: Date.now()
    });
    
    // Auto-save if enabled
    if ($settings.autoSave && $currentConversation.id) {
      conversationHistory.add($currentConversation);
    }
    
    // Prepare messages for API
    const messages = $currentConversation.messages
      .filter(m => !m.hiddenFromLLM)
      .map(m => ({ role: m.role, content: m.content }));
    
    // Add system prompt if configured
    const systemPrompt = $currentConversation.systemPrompt || 
      $settings.systemPrompts.find(p => p.id === $settings.defaultSystemPrompt);
    
    if (systemPrompt) {
      if (systemPrompt.mode === 'always' || messages.length === 1) {
        messages.unshift({ role: 'system', content: systemPrompt.content });
      }
    }
    
    // Add assistant message placeholder
    const assistantIndex = $currentConversation.messages.length;
    currentConversation.addMessage({
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: $settings.model
    });
    
    isGenerating.set(true);
    
    try {
      const response = await sendMessage(messages, (chunk) => {
        currentConversation.updateMessage(assistantIndex, {
          content: $currentConversation.messages[assistantIndex].content + chunk
        });
      });
      
      // Update with final content and cost
      currentConversation.updateMessage(assistantIndex, {
        content: response.content,
        cost: response.cost
      });
      
      // Auto-save if enabled
      if ($settings.autoSave && $currentConversation.id) {
        conversationHistory.add($currentConversation);
      }
    } catch (error) {
      currentConversation.updateMessage(assistantIndex, {
        content: `Error: ${error.message}`,
        isError: true
      });
    } finally {
      isGenerating.set(false);
    }
  }
  
  function handleNewConversation() {
    currentConversation.new();
  }
  
  function handleLoadConversation(event) {
    currentConversation.load(event.detail);
  }
  
  function handleEditMessage(event) {
    const { index, content } = event.detail;
    currentConversation.updateMessage(index, { content });
    
    if ($settings.autoSave && $currentConversation.id) {
      conversationHistory.add($currentConversation);
    }
  }
  
  function handleToggleVisibility(event) {
    const index = event.detail;
    const message = $currentConversation.messages[index];
    currentConversation.updateMessage(index, { 
      hiddenFromLLM: !message.hiddenFromLLM 
    });
  }
  
  function handleDeleteMessage(event) {
    currentConversation.deleteMessage(event.detail);
    
    if ($settings.autoSave && $currentConversation.id) {
      conversationHistory.add($currentConversation);
    }
  }
  
  function toggleSidebar() {
    sidebarVisible.update(v => !v);
  }
  
  function exportConversation() {
    const data = JSON.stringify($currentConversation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${$currentConversation.id || 'new'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="app">
  <header class="app-header">
    <button class="menu-button" on:click={toggleSidebar} title="Toggle sidebar">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M3 12h18M3 6h18M3 18h18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    
    <h1>LLM Research Chat</h1>
    
    <div class="header-actions">
      <button on:click={exportConversation} title="Export conversation">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button on:click={() => settingsModalOpen.set(true)} title="Settings">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m4.22-10.22l4.24 4.24m-4.24 4.24l4.24 4.24M20 12h-6m-6 0H2m10.22-7.46L7.98 8.78m4.24 4.24l-4.24 4.24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </header>
  
  <div class="app-body">
    {#if $sidebarVisible}
      <aside class="sidebar-container">
        <Sidebar 
          on:new={handleNewConversation}
          on:load={handleLoadConversation}
        />
      </aside>
    {/if}
    
    <main class="main-content">
      <div 
        class="messages-container" 
        bind:this={messagesContainer}
        on:scroll={handleScroll}
      >
        {#each $currentConversation.messages as message, index (message.timestamp)}
          <Message 
            {message} 
            {index}
            isGenerating={$isGenerating && index === $currentConversation.messages.length - 1}
            on:edit={handleEditMessage}
            on:toggleVisibility={handleToggleVisibility}
            on:delete={handleDeleteMessage}
          />
        {/each}
        
        {#if $currentConversation.messages.length === 0}
          <div class="empty-state">
            <h2>Welcome to LLM Research Chat</h2>
            <p>Start a conversation by typing a message below.</p>
          </div>
        {/if}
      </div>
      
      {#if $showScrollToBottom}
        <button class="scroll-to-bottom" on:click={scrollToBottom} title="Scroll to bottom">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      {/if}
      
      <ChatInput 
        disabled={$isGenerating}
        on:send={handleSendMessage}
      />
    </main>
  </div>
  
  <SettingsModal 
    open={$settingsModalOpen}
    on:close={() => settingsModalOpen.set(false)}
  />
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  :global([data-font-size="small"]) {
    font-size: 14px;
  }
  
  :global([data-font-size="medium"]) {
    font-size: 16px;
  }
  
  :global([data-font-size="large"]) {
    font-size: 18px;
  }
  
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: white;
    color: #1a1a1a;
  }
  
  .app-header {
    height: 56px;
    padding: 0 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .menu-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .menu-button:hover {
    color: #374151;
  }
  
  .app-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    flex: 1;
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .header-actions button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .header-actions button:hover {
    color: #374151;
  }
  
  .app-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .sidebar-container {
    width: 300px;
    min-width: 200px;
    max-width: 50%;
    overflow: hidden;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    padding-bottom: 2rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #6b7280;
  }
  
  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: #374151;
  }
  
  .scroll-to-bottom {
    position: absolute;
    bottom: 100px;
    right: 2rem;
    width: 48px;
    height: 48px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }
  
  .scroll-to-bottom:hover {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
  
  /* Dark theme */
  :global(.dark) .app {
    background: #111827;
    color: #f3f4f6;
  }
  
  :global(.dark) .app-header {
    background: #1f2937;
    border-bottom-color: #374151;
  }
  
  :global(.dark) .app-header h1 {
    color: #f3f4f6;
  }
  
  :global(.dark) .menu-button,
  :global(.dark) .header-actions button {
    color: #9ca3af;
  }
  
  :global(.dark) .menu-button:hover,
  :global(.dark) .header-actions button:hover {
    color: #d1d5db;
  }
  
  :global(.dark) .empty-state {
    color: #9ca3af;
  }
  
  :global(.dark) .empty-state h2 {
    color: #e5e7eb;
  }
</style>
