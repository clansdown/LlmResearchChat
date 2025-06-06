// Global variables
let currentConversation = {
    id: Date.now(),
    title: 'New Conversation',
    messages: [],
    model: 'openai/gpt-3.5-turbo',
    createdAt: new Date().toISOString()
};

let settings = {
    apiKey: '',
    theme: 'light',
    fontSize: 14,
    spellCheck: true,
    autoSave: true,
    searchEngine: 'google',
    systemPrompts: [],
    activeSystemPromptId: 'default',
    systemPromptMode: 'once',
    sidebarVisibility: true
};

let isTyping = false;
let abortController = null;
let cachedModels = null;
let includePreviousMessagesInContext = true;
let previousMessagesContextWindow = 8000;
let sidebarVisible;
let quickActionsTimeout;

// Initialize the application
async function init() {
    // Load settings
    settings = await window.electronAPI.getSettings();
    applySettings();
    
    // Load conversation history
    await loadConversationHistory();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up IPC listeners
    setupIPCListeners();
    
    // Initialize spell checker
    if (settings.spellCheck) {
        initializeSpellChecker();
    }
    
    // Load system prompts into selector
    loadSystemPrompts();
    
    // Load available models
    await loadAvailableModels();
}

// Apply settings to the UI
function applySettings() {
    // Apply theme
    document.documentElement.setAttribute('data-theme', settings.theme);
    
    // Apply font size to CSS variable
    document.documentElement.style.setProperty('--base-font-size', settings.fontSize);
    
    // Apply saved sidebar width
    if (settings.sidebarWidth) {
        document.documentElement.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`);
    }
    
    // Update settings modal
    document.getElementById('api-key').value = settings.apiKey || '';
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('font-size').value = settings.fontSize;
    document.getElementById('spell-check').checked = settings.spellCheck;
    document.getElementById('auto-save').checked = settings.autoSave;
    document.getElementById('web-search-enabled').checked = settings.webSearchEnabled !== false;
    document.getElementById('web-max-results').value = settings.webMaxResults || 3;
    document.getElementById('web-results-override').value = settings.webMaxResults || 3;
    document.getElementById('search-engine').value = settings.searchEngine || 'google';
    document.getElementById('system-prompt-mode').value = settings.systemPromptMode || 'once';
    
    // Apply context settings
    includePreviousMessagesInContext = settings.includePreviousMessagesInContext !== false;
    previousMessagesContextWindow = settings.previousMessagesContextWindow || 8000;
    document.getElementById('include-previous-messages').checked = includePreviousMessagesInContext;
    document.getElementById('context-window').value = previousMessagesContextWindow;
    document.getElementById('context-window-group').classList.toggle('visible', includePreviousMessagesInContext);
    
    // Update context toggle button
    const contextToggle = document.getElementById('context-toggle');
    contextToggle.classList.toggle('active', includePreviousMessagesInContext);
    
    // Update model selector
    if (settings.defaultModel) {
        document.getElementById('model-selector').value = settings.defaultModel;
    }
    
    // Initialize web toggle
    const webToggle = document.getElementById('web-toggle');
    webToggle.classList.toggle('active', settings.webSearchEnabled);
    updateWebControlsState(settings.webSearchEnabled);
    
    // Load system prompts in settings
    displaySystemPrompts();
    
    // Apply sidebar visibility
    sidebarVisible = settings.sidebarVisibility || true;
    toggleSidebarUI(sidebarVisible);
}

// Set up event listeners
function setupEventListeners() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const modelSelector = document.getElementById('model-selector');
    const systemPromptSelector = document.getElementById('system-prompt-selector');
    
    // Message input
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = !messageInput.value.trim();
    });
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (messageInput.value.trim()) {
                sendMessage();
            }
        }
    });
    
    // Send button
    sendBtn.addEventListener('click', sendMessage);
    
    // New conversation button
    newConversationBtn.addEventListener('click', createNewConversation);
    
    // Settings modal buttons
    const saveSettingsBtn = document.querySelector('.modal-footer .btn-primary');
    const cancelSettingsBtn = document.querySelector('.modal-footer .btn-secondary');
    const closeModalBtn = document.querySelector('.modal-header .close-btn');
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', closeSettings);
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeSettings);
    }
    
    // Add system prompt button
    const addPromptBtn = document.getElementById('add-prompt-btn');
    if (addPromptBtn) {
        addPromptBtn.addEventListener('click', addSystemPrompt);
    }
    
    // Model selector
    modelSelector.addEventListener('change', (e) => {
        currentConversation.model = e.target.value;
        // Immediately update the conversation in history if it exists
        if (currentConversation.messages.length > 0) {
            window.electronAPI.addToHistory(currentConversation);
        }
    });
    
    // System prompt selector
    systemPromptSelector.addEventListener('change', (e) => {
        settings.activeSystemPromptId = e.target.value;
        window.electronAPI.saveSettings({ activeSystemPromptId: e.target.value });
    });
    
    // Add selection change listener
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Add search button click handler
    const searchBtn = document.getElementById('search-btn');
    searchBtn.addEventListener('click', performSearch);
    
    // Add Wikipedia button click handler
    const wikipediaBtn = document.getElementById('wikipedia-btn');
    wikipediaBtn.addEventListener('click', performWikipediaSearch);
    
    // Add selection listener for chat messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.addEventListener('mouseup', handleTextSelection);
    chatMessages.addEventListener('mousedown', hideQuickActions);
    
    // Add quick action button handlers
    document.getElementById('quick-wikipedia').addEventListener('click', () => {
        const text = getSelectedText();
        if (text) performWikipediaSearch(text);
    });
    
    document.getElementById('quick-websearch').addEventListener('click', () => {
        const text = getSelectedText();
        if (text) performSearch(text);
    });
    
    // Add web toggle click handler
    const webToggle = document.getElementById('web-toggle');
    webToggle.addEventListener('click', () => {
        const webEnabled = !webToggle.classList.contains('active');
        updateWebControlsState(webEnabled);
    });
    
    // Add conversation search handler
    const conversationSearch = document.getElementById('conversation-search');
    conversationSearch.addEventListener('input', (e) => {
        filterConversations(e.target.value.toLowerCase());
    });
    
    // Context toggle click handler
    const contextToggle = document.getElementById('context-toggle');
    contextToggle.addEventListener('click', () => {
        includePreviousMessagesInContext = !includePreviousMessagesInContext;
        contextToggle.classList.toggle('active', includePreviousMessagesInContext);
    });
    
    // Context settings handlers
    const includePreviousCheckbox = document.getElementById('include-previous-messages');
    includePreviousCheckbox.addEventListener('change', (e) => {
        document.getElementById('context-window-group').classList.toggle('visible', e.target.checked);
    });
    
    // Add sidebar toggle handler
    document.getElementById('sidebar-toggle').addEventListener('click', () => toggleSidebar());
}

// Set up IPC listeners
function setupIPCListeners() {
    window.electronAPI.onNewConversation(() => {
        createNewConversation();
    });
    
    window.electronAPI.onLoadConversation((conversation) => {
        loadConversation(conversation);
    });
    
    window.electronAPI.onSaveConversation(() => {
        saveCurrentConversation();
    });
    
    window.electronAPI.onToggleSidebar(() => {
        toggleSidebar();
    });
    
    // Add this listener back for the Settings menu item
    window.electronAPI.onOpenSettings(() => {
        openSettings();
    });
}

// Create a new conversation
function createNewConversation() {
    currentConversation = {
        id: Date.now(),
        title: 'New Conversation',
        messages: [],
        model: settings.defaultModel,
        createdAt: new Date().toISOString()
    };
    
    // Reset both model selector and temporary override to default
    document.getElementById('model-selector').value = settings.defaultModel;
    
    document.getElementById('conversation-title').textContent = 'New Conversation';
    document.getElementById('chat-messages').innerHTML = `
        <div class="welcome-message">
            <h2>Welcome to LLM UI</h2>
            <p>Start a conversation by typing a message below.</p>
        </div>
    `;
    
    // Clear selection
    window.getSelection().removeAllRanges();
    
    updateConversationList();
    
    // Update total cost
    calculateTotalCost();
}

// Load a conversation
async function loadConversation(conversationItem) {
    const fullConversation = await window.electronAPI.loadConversationFile(conversationItem.id);
    if (!fullConversation) return;

    currentConversation = fullConversation;
    document.getElementById('conversation-title').textContent = currentConversation.title;
    
    // Set both the model selector and temporary override
    document.getElementById('model-selector').value = currentConversation.model;
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    currentConversation.messages.forEach(msg => {
        if (msg.role === 'assistant') {
            appendMessage(msg.role, msg.content, false, msg.modelName, msg.modelId, msg.cost, msg.requestId, msg.hiddenFromLLM);
        } else {
            appendMessage(msg.role, msg.content, false, null, null, null, null, msg.hiddenFromLLM);
        }
    });
    
    updateConversationList();
    
    // Update total cost
    calculateTotalCost();
}

// Send a message
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message || isTyping) return;
    
    if (!settings.apiKey) {
        alert('Please set your OpenRouter API key in settings first.');
        openSettings();
        return;
    }
    
    // Add user message
    appendMessage('user', message);
    currentConversation.messages.push({ 
        role: 'user', 
        content: message,
        hiddenFromLLM: false
    });
    
    // Clear input
    messageInput.value = '';
    updateSendButton();
    
    // Ensure model is current
    currentConversation.model = document.getElementById('model-selector').value;
    
    // Add to history immediately after first message
    if (currentConversation.messages.length === 1) {
        await window.electronAPI.addToHistory(currentConversation);
        await loadConversationHistory();
    }
    
    // Show typing indicator and stop button
    showTypingIndicator();
    isTyping = true;
    updateSendButton(); // Update button to stop state
    
    try {
        // Prepare messages with system prompt
        const messages = prepareMessagesWithSystemPrompt();
        
        // Create abort controller for streaming
        abortController = new AbortController();
        
        // Call OpenRouter API with streaming
        await callOpenRouterStreaming(messages);
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            appendMessage('system', `Error: ${error.message}`);
        }
    } finally {
        // Remove typing indicator
        hideTypingIndicator();
        isTyping = false;
        abortController = null;
        updateSendButton(); // Revert to normal send button
        
        // Auto-save if enabled
        if (settings.autoSave && currentConversation.messages.length > 0) {
            await window.electronAPI.addToHistory(currentConversation);
        }
    }
}


// Prepare messages with system prompt
function prepareMessagesWithSystemPrompt() {
    let messages = [...currentConversation.messages]
        .filter(msg => !msg.hiddenFromLLM)
        .map(msg => ({ role: msg.role, content: msg.content }));

    if (includePreviousMessagesInContext) {
        // Collect messages until we reach the word limit
        let wordCount = 0;
        const contextMessages = [];
        
        // Iterate backwards through messages (newest first)
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const words = msg.content.split(/\s+/).length;
            
            if (wordCount + words > previousMessagesContextWindow) break;
            
            contextMessages.unshift(msg); // Add to beginning to maintain order
            wordCount += words;
        }
        
        messages = contextMessages;
    }

    const activePrompt = settings.systemPrompts.find(p => p.id === settings.activeSystemPromptId);
    
    if (activePrompt && activePrompt.content) {
        if (!includePreviousMessagesInContext) {
            // When context is disabled, prepend system prompt to each user message
            messages = messages.map(msg => {
                if (msg.role === 'user') {
                    return {
                        ...msg,
                        content: `${activePrompt.content}\n\n${msg.content}`
                    };
                }
                return msg;
            });
        } else {
            // Existing system prompt mode handling
            if (settings.systemPromptMode === 'once') {
                // Add system prompt at the beginning if not already there
                if (messages.length === 1 || (messages[0].role !== 'system')) {
                    messages.unshift({ role: 'system', content: activePrompt.content });
                }
            } else if (settings.systemPromptMode === 'always') {
                // Add system prompt to the last user message
                const lastUserMessageIndex = messages.length - 1;
                if (messages[lastUserMessageIndex].role === 'user') {
                    messages[lastUserMessageIndex] = {
                        ...messages[lastUserMessageIndex],
                        content: activePrompt.content + '\n\n' + messages[lastUserMessageIndex].content
                    };
                }
            }
        }
    }
    
    return messages;
}

// Call OpenRouter API with streaming
async function callOpenRouterStreaming(messages) {
    console.log('Calling OpenRouter API with model:', currentConversation.model);
    console.log('API Key present:', !!settings.apiKey);
    console.log('Messages:', messages);
    
    if (!settings.apiKey) {
        throw new Error('OpenRouter API key is not set. Please add your API key in settings.');
    }
    
    let fullContent = '';
    let latestGeneration = null;
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://openrouter.ai',
                'X-Title': 'LLM UI'
            },
            body: JSON.stringify({
                model: currentConversation.model,
                messages: messages,
                stream: true,
                max_tokens: 8192,
                plugins: document.getElementById('web-toggle').classList.contains('active') ? [{
                    id: "web",
                    max_results: parseInt(document.getElementById('web-results-override').value) || settings.webMaxResults || 3,
                }] : [],
            }),
            signal: abortController.signal
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = `API request failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
                console.error('Could not parse error response');
            }
            throw new Error(errorMessage);
        }
    
    // Hide typing indicator and create message element
    hideTypingIndicator();
    const messageElement = createStreamingMessage();
    
    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            fullContent += content;
                            updateStreamingMessage(messageElement, fullContent);
                            
                            // Capture generation data if present
                            if (parsed.id) {
                                latestGeneration = parsed; // Store the complete generation object
                                // Update cost immediately when we get generation data
                                if (parsed.total_cost !== undefined) {
                                    updateStreamingMessage(messageElement, fullContent, parsed.total_cost);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
            
            // Remove blinking cursor after stream completes
            const cursor = messageElement.querySelector('.cursor-blink');
            if (cursor) {
                cursor.remove();
                
                // Remove any trailing empty text nodes
                const lastChild = messageElement.lastChild;
                if (lastChild?.nodeType === Node.TEXT_NODE && lastChild.textContent === '') {
                    lastChild.remove();
                }
            }
        }
    } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
    }
    
    // After stream completes, fetch full generation data
    let generationData = null;
    if (latestGeneration?.id) {
        generationData = await fetchGenerationData(latestGeneration.id);
        console.log("Generation data:", generationData, generationData.total_cost, generationData.data?.total_cost);
    }
    
    // Add the complete message to conversation
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    const cost = generationData?.total_cost || latestGeneration?.total_cost || null;
    console.log("Cost is ", cost);
    
    // Update the DOM with the final cost
    if (cost !== null && cost > 0) {
        const chatMessages = document.getElementById('chat-messages');
        const lastMessage = chatMessages.lastElementChild;
        
        if (lastMessage && lastMessage.classList.contains('assistant')) {
            let costDiv = lastMessage.querySelector('.message-cost');
            if (!costDiv) {
                costDiv = document.createElement('div');
                costDiv.className = 'message-cost';
                lastMessage.querySelector('.message-content').appendChild(costDiv);
            }
            costDiv.textContent = `Cost: $${cost.toFixed(2)}`;
        }
    }
    
    currentConversation.messages.push({ 
        role: 'assistant', 
        content: fullContent,
        modelName: modelName,
        modelId: currentConversation.model,
        generation: generationData || latestGeneration, // Prefer generation API response
        requestId: latestGeneration.id,
        cost: cost,
        hiddenFromLLM: false
    });
    
   
    // Update conversation title if it's the first exchange
    if (currentConversation.messages.filter(m => m.role === 'user').length === 1) {
        const firstUserMessage = currentConversation.messages.find(m => m.role === 'user');
        currentConversation.title = firstUserMessage.content.substring(0, 50) + 
            (firstUserMessage.content.length > 50 ? '...' : '');
        document.getElementById('conversation-title').textContent = currentConversation.title;
        updateConversationList();
    }
    
    // Update total cost after streaming completes
    calculateTotalCost();
}

// Append a message to the chat
function appendMessage(role, content, animate = true, modelName = null, modelId = null, cost = null, requestId = null, hiddenFromLLM = false) {
    const chatMessages = document.getElementById('chat-messages');
    
    // Remove welcome message if exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    if (animate) messageDiv.style.animation = 'fadeIn 0.3s ease-out';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    
    // Add edit button for user messages
    if (role === 'user') {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.title = 'Edit message';
        editBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5L2 22l1.5-5.5L17 3z"/>
            </svg>
        `;
        editBtn.onclick = () => editMessage(messageDiv, content);
        actions.appendChild(editBtn);
    }
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (role === 'user') {
        avatar.textContent = 'U';
    } else if (role === 'assistant') {
        // Use first 3 characters of model name
        avatar.textContent = modelName ? modelName.substring(0, 3).toUpperCase() : 'AI';
        if (modelName && modelId) {
            avatar.title = `${modelName} (${modelId})`;
            if (requestId) {
                avatar.title += `\nRequest ID: ${requestId}`;
            }
        } else if (modelName) {
            avatar.title = modelName;
            if (requestId) {
                avatar.title += `\nRequest ID: ${requestId}`;
            }
        }
    } else {
        avatar.textContent = 'S';
    }
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'visibility-toggle';
    toggleBtn.title = 'Toggle visibility for LLM';
    toggleBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
            ${hiddenFromLLM ? '<path d="M2 2l20 20" stroke-width="2.5"/>' : ''}
        </svg>
    `;
    toggleBtn.onclick = () => toggleMessageVisibility(messageDiv, role, content);
    
    // Add elements in new order: actions -> avatar -> toggle
    header.appendChild(actions);
    header.appendChild(avatar);
    if (role !== 'system') {
        header.appendChild(toggleBtn);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse annotations and extract links
    const linkData = extractLinks(content);
    let formattedContent = linkData.content;
    const links = linkData.links;

    // Format main content
    formattedContent = escapeHtml(formattedContent);
    formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Add links section if any were found
    if (links.length > 0) {
        formattedContent += `<div class="message-links">
            <div class="links-title">References:</div>
            ${links.map((link, index) => 
                `<a href="#" class="message-link" data-url="${link.url}">[${index + 1}] ${link.text || link.url}</a>`
            ).join('')}
        </div>`;
    }

    // Store original content in data attribute
    contentDiv.dataset.originalContent = content;
    
    if (hiddenFromLLM) {
        messageDiv.classList.add('hidden-llm');
        contentDiv.innerHTML = createPreviewContent(content, cost);
    } else {
        contentDiv.innerHTML = formattedContent;
    }

    // Add cost display if available
    if (cost !== null && cost !== undefined && cost > 0) {
        const costDiv = document.createElement('div');
        costDiv.className = 'message-cost';
        costDiv.textContent = `Cost: $${cost.toFixed(2)}`;
        contentDiv.appendChild(costDiv);
    }

    // Add click handlers for links
    contentDiv.querySelectorAll('a.message-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(link.dataset.url);
        });
    });
    
    messageDiv.appendChild(header);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Add event listener for the new quick-chat button
    document.getElementById('quick-chat').addEventListener('click', handleQuickChat);
    
    // Scroll to bottom if near bottom
    const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 200;
    if (isNearBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Update total cost
    calculateTotalCost();
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    const indicator = document.createElement('div');
    indicator.className = 'message assistant typing-message';
    indicator.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingMessage = document.querySelector('.typing-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

// Load conversation history
async function loadConversationHistory() {
    const history = await window.electronAPI.getConversationHistory();
    const conversationList = document.getElementById('conversation-list');
    
    conversationList.innerHTML = '';
    
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.dataset.id = item.id;
        div.dataset.conversation = JSON.stringify(item); // Store full data
        
        div.innerHTML = `
            <div class="conversation-item-header">
                <h3>${escapeHtml(item.title)}</h3>
                <button class="delete-conversation-btn" title="Delete conversation">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                    </svg>
                </button>
            </div>
            <div class="conversation-date">
                ${new Date(item.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>
            <p>${escapeHtml(item.preview)}</p>
        `;
        
        // Load conversation when clicked
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-conversation-btn')) {
                loadConversation(item);
            }
        });
        
        // Add delete handler
        const deleteBtn = div.querySelector('.delete-conversation-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(item.id);
        });
        
        conversationList.appendChild(div);
    });
    
    updateConversationList();
    
    // Apply current search filter
    const searchText = document.getElementById('conversation-search').value.toLowerCase();
    if (searchText) {
        filterConversations(searchText);
    }
}

// Update conversation list to highlight current
function updateConversationList() {
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
        if (item.dataset.id == currentConversation.id) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Save current conversation
async function saveCurrentConversation() {
    const result = await window.electronAPI.saveConversation(currentConversation);
    if (result.success) {
        console.log('Conversation saved:', result.path);
    }
}

// Settings functions
function openSettings() {
    console.log('Opening settings...');
    document.getElementById('settings-modal').classList.add('show');
}

function closeSettings() {
    console.log('Closing settings...');
    document.getElementById('settings-modal').classList.remove('show');
}

async function saveSettings() {
    console.log('Saving settings...');
    const newSettings = {
        apiKey: document.getElementById('api-key').value,
        theme: document.getElementById('theme-select').value,
        fontSize: parseInt(document.getElementById('font-size').value),
        spellCheck: document.getElementById('spell-check').checked,
        autoSave: document.getElementById('auto-save').checked,
        webSearchEnabled: document.getElementById('web-search-enabled').checked,
        webMaxResults: parseInt(document.getElementById('web-max-results').value) || 3,
        searchEngine: document.getElementById('search-engine').value,
        systemPromptMode: document.getElementById('system-prompt-mode').value,
        systemPrompts: settings.systemPrompts,
        defaultModel: document.getElementById('default-model-select').value,
        selectedModels: settings.selectedModels,
        includePreviousMessagesInContext: document.getElementById('include-previous-messages').checked,
        previousMessagesContextWindow: parseInt(document.getElementById('context-window').value) || 8000
    };
    
    await window.electronAPI.saveSettings(newSettings);
    settings = { ...settings, ...newSettings };
    applySettings();
    
    // Reload models with new configuration
    await loadAvailableModels();
    
    closeSettings();
}

// Initialize spell checker
function initializeSpellChecker() {
    const messageInput = document.getElementById('message-input');
    messageInput.setAttribute('spellcheck', 'true');
    
    // Add custom spell check highlighting
    let spellCheckTimeout;
    messageInput.addEventListener('input', () => {
        clearTimeout(spellCheckTimeout);
        spellCheckTimeout = setTimeout(() => {
            highlightMisspelledWords();
        }, 500);
    });
}

// Highlight misspelled words (visual indication)
function highlightMisspelledWords() {
    // This relies on the browser's built-in spellcheck
    // The red squiggly lines are handled by the browser
    const messageInput = document.getElementById('message-input');
    if (messageInput.value.trim()) {
        // Browser handles the actual spell checking
    }
}

// Fetch generation data from OpenRouter Generation API
async function fetchGenerationData(requestId) {
    try {
        // We can't request this immediately as the generation object won't instantly exist, we have to wait a short time
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        await sleep(2000);
        const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(requestId)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://openrouter.ai',
            },
        });
        
        if (!response.ok) throw new Error('Failed to fetch generation data');
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error fetching generation data:', error);
        return null;
    }
}

// Calculate and update total conversation cost
function calculateTotalCost() {
    const total = currentConversation.messages.reduce((sum, msg) => sum + (msg.cost || 0), 0);
    const totalElement = document.getElementById('conversation-total-cost');
    const container = document.querySelector('.total-cost-container');
    
    if (total > 0) {
        totalElement.textContent = `Total: $${total.toFixed(2)}`;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

// Utility function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Create streaming message element
function createStreamingMessage() {
    const chatMessages = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.style.animation = 'fadeIn 0.3s ease-out';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const modelId = currentConversation.model;
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    avatar.textContent = modelName.substring(0, 3).toUpperCase();
    avatar.title = `${modelName} (${modelId})`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<span class="cursor-blink">▋</span>';
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return contentDiv;
}

// Update streaming message
function updateStreamingMessage(element, content, cost = null) {
    // Parse annotations and extract links
    const linkData = extractLinks(content);
    let formattedContent = linkData.content;
    const links = linkData.links;

    // Format main content
    formattedContent = escapeHtml(formattedContent);
    formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Add links section if any were found
    if (links.length > 0) {
        formattedContent += `<div class="message-links">
            <div class="links-title">References:</div>
            ${links.map((link, index) => 
                `<a href="#" class="message-link" data-url="${link.url}">[${index + 1}] ${link.text || link.url}</a>`
            ).join('')}
        </div>`;
    }
    
    element.innerHTML = formattedContent + '<span class="cursor-blink">▋</span>';
    
    // Add/update cost display
    let costDiv = element.querySelector('.message-cost');
    if (cost !== null && cost > 0) {
        if (!costDiv) {
            costDiv = document.createElement('div');
            costDiv.className = 'message-cost';
            element.appendChild(costDiv);
        }
        costDiv.textContent = `Cost: $${cost.toFixed(2)}`;
    } else if (costDiv) {
        costDiv.remove();
    }
    
    // Add click handlers for links
    element.querySelectorAll('a.message-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(link.dataset.url);
        });
    });
    
    // Scroll to bottom
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load system prompts into selector
function loadSystemPrompts() {
    const selector = document.getElementById('system-prompt-selector');
    selector.innerHTML = '';
    
    settings.systemPrompts.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.id;
        option.textContent = prompt.name;
        if (prompt.id === settings.activeSystemPromptId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    // Show/hide based on number of prompts
    const shouldShow = settings.systemPrompts.length > 1;
    selector.style.display = shouldShow ? 'block' : 'none';
}

// Load available models
async function loadAvailableModels() {
    try {
        const allModels = await window.electronAPI.getAvailableModels();
        cachedModels = allModels; // Cache models for cost calculations
        const enabledModels = settings.selectedModels || [];
        
        // Filter and sort models
        const modelsToShow = allModels
            .filter(m => enabledModels.includes(m.id))
            .sort((a, b) => a.name.localeCompare(b.name));

        const modelSelector = document.getElementById('model-selector');
        modelSelector.innerHTML = '';
        
        modelsToShow.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = `${model.name} (${formatPricing(model.pricing)})`;
            option.title = `${model.description}\nProvider: ${model.provider}`;
            modelSelector.appendChild(option);
        });

        // Set default model
        if (modelsToShow.some(m => m.id === settings.defaultModel)) {
            modelSelector.value = settings.defaultModel;
        }
        
        // Load models in settings modal
        await displayModelConfiguration(allModels);
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

// Format pricing information
function formatPricing(pricing, verbose = false) {
    if (!pricing) return 'Pricing unavailable';
    
    const prompt = pricing.prompt ? 
        `$${(pricing.prompt * 1000000).toFixed(2)}` : 
        'N/A';
        
    const completion = pricing.completion ? 
        `$${(pricing.completion * 1000000).toFixed(2)}` : 
        'N/A';
        
    return verbose ? 
        `Input: ${prompt} per million tokens\nOutput: ${completion} per million tokens` :
        `In:${prompt} Out:${completion}`;
}

// Display system prompts in settings
function displaySystemPrompts() {
    const container = document.getElementById('system-prompts-container');
    container.innerHTML = '';
    
    settings.systemPrompts.forEach(prompt => {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'system-prompt-item';
        promptDiv.dataset.promptId = prompt.id;
        
        const promptHeader = document.createElement('div');
        promptHeader.className = 'prompt-header';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = prompt.name;
        nameInput.className = 'prompt-name-input';
        nameInput.addEventListener('change', (e) => updateSystemPromptName(prompt.id, e.target.value));
        
        const defaultLabel = document.createElement('label');
        const defaultRadio = document.createElement('input');
        defaultRadio.type = 'radio';
        defaultRadio.name = 'default-prompt';
        defaultRadio.checked = prompt.isDefault;
        defaultRadio.addEventListener('change', () => setDefaultSystemPrompt(prompt.id));
        defaultLabel.appendChild(defaultRadio);
        defaultLabel.appendChild(document.createTextNode(' Default'));
        
        promptHeader.appendChild(nameInput);
        promptHeader.appendChild(defaultLabel);
        
        if (prompt.id !== 'default') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => deleteSystemPrompt(prompt.id));
            promptHeader.appendChild(deleteBtn);
        }
        
        const contentTextarea = document.createElement('textarea');
        contentTextarea.className = 'prompt-content';
        contentTextarea.rows = 3;
        contentTextarea.value = prompt.content;
        contentTextarea.addEventListener('change', (e) => updateSystemPromptContent(prompt.id, e.target.value));
        
        promptDiv.appendChild(promptHeader);
        promptDiv.appendChild(contentTextarea);
        container.appendChild(promptDiv);
    });
}

// Add new system prompt
function addSystemPrompt() {
    const newPrompt = {
        id: 'prompt_' + Date.now(),
        name: 'New Prompt',
        content: '',
        isDefault: false
    };
    
    settings.systemPrompts.push(newPrompt);
    displaySystemPrompts();
    loadSystemPrompts(); // This will update visibility
}

// Update system prompt name
function updateSystemPromptName(id, name) {
    const prompt = settings.systemPrompts.find(p => p.id === id);
    if (prompt) {
        prompt.name = name;
        loadSystemPrompts();
    }
}

// Update system prompt content
function updateSystemPromptContent(id, content) {
    const prompt = settings.systemPrompts.find(p => p.id === id);
    if (prompt) {
        prompt.content = content;
    }
}

// Set default system prompt
function setDefaultSystemPrompt(id) {
    settings.systemPrompts.forEach(prompt => {
        prompt.isDefault = prompt.id === id;
    });
    settings.activeSystemPromptId = id;
}

// Delete system prompt
function deleteSystemPrompt(id) {
    settings.systemPrompts = settings.systemPrompts.filter(p => p.id !== id);
    if (settings.activeSystemPromptId === id) {
        const defaultPrompt = settings.systemPrompts.find(p => p.isDefault);
        settings.activeSystemPromptId = defaultPrompt ? defaultPrompt.id : settings.systemPrompts[0]?.id;
    }
    displaySystemPrompts();
    loadSystemPrompts(); // This will update visibility
}

// Display model configuration in settings
async function displayModelConfiguration(models) {
    const container = document.getElementById('model-selection-list');
    const defaultSelector = document.getElementById('default-model-select');
    const searchInput = document.getElementById('model-search');
    
    // Clear existing elements
    container.innerHTML = '';
    defaultSelector.innerHTML = '';

    // Add search input handler
    searchInput.addEventListener('input', (e) => {
        filterModels(e.target.value.toLowerCase(), models);
    });

    models.forEach(model => {
        // Model selection checkboxes
        const div = document.createElement('div');
        div.className = 'model-selection-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `model-${model.id}`;
        checkbox.checked = (settings.selectedModels || []).includes(model.id);
        checkbox.addEventListener('change', () => toggleModelSelection(model.id));
        
        const label = document.createElement('label');
        label.htmlFor = `model-${model.id}`;
        label.textContent = `${model.name} (${model.provider}) ${formatPricing(model.pricing)}`;
        label.title = `${model.description}\n${formatPricing(model.pricing, true)}`;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });

    // Filter models to only those that are selected for default model dropdown
    const enabledModels = models.filter(m => (settings.selectedModels || []).includes(m.id));

    enabledModels.forEach(model => {
        // Default model options
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} (${formatPricing(model.pricing)})`;
        option.title = `${model.description}\nProvider: ${model.provider}`;
        defaultSelector.appendChild(option);
    });

    defaultSelector.value = settings.defaultModel;
    defaultSelector.addEventListener('change', (e) => {
        settings.defaultModel = e.target.value;
    });
}

// Filter models based on search query
function filterModels(query, models) {
    const container = document.getElementById('model-selection-list');
    container.innerHTML = '';
    
    models.forEach(model => {
        // Get the displayed text including pricing
        const displayedText = `${model.name} ${model.provider} ${formatPricing(model.pricing)}`.toLowerCase();
        
        const matches = displayedText.includes(query) ||
                        (model.description && model.description.toLowerCase().includes(query));
        
        if (matches) {
            const div = document.createElement('div');
            div.className = 'model-selection-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `model-${model.id}`;
            checkbox.checked = settings.selectedModels.includes(model.id);
            checkbox.addEventListener('change', () => toggleModelSelection(model.id));
            
            const label = document.createElement('label');
            label.htmlFor = `model-${model.id}`;
            label.textContent = `${model.name} (${model.provider}) ${formatPricing(model.pricing)}`;
            label.title = `${model.description}\n${formatPricing(model.pricing, true)}`;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        }
    });
}

// Toggle model selection
function toggleModelSelection(modelId) {
    if (!settings.selectedModels) {
        settings.selectedModels = [];
    }
    
    const index = settings.selectedModels.indexOf(modelId);
    if (index === -1) {
        settings.selectedModels.push(modelId);
    } else {
        settings.selectedModels.splice(index, 1);
    }
}

// Update send button state
function updateSendButton() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (isTyping) {
        // Show stop button style
        sendBtn.classList.add('stop');
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12"/>
            </svg>
        `;
        sendBtn.onclick = stopGeneration;
        sendBtn.disabled = false; // Always enabled during streaming
    } else {
        // Show normal send button style
        sendBtn.classList.remove('stop');
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
        `;
        sendBtn.onclick = sendMessage;
        // Only disable if input is empty when not streaming
        sendBtn.disabled = !messageInput.value.trim();
    }
}

// Stop generation
function stopGeneration() {
    if (abortController) {
        abortController.abort();
        isTyping = false;
        updateSendButton();
    }
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    
    // Remove welcome message if exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    // Create typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-indicator';
    typingDiv.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const modelId = currentConversation.model;
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    avatar.textContent = modelName.substring(0, 3).toUpperCase();
    avatar.title = `${modelName} (${modelId})`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(contentDiv);
    chatMessages.appendChild(typingDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Update button state
    updateSendButton();
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Add new handler functions
function handleSelectionChange() {
    const selection = window.getSelection();
    const hasSelection = selection.toString().trim().length > 0;
    
    // Only enable if selection is in chat messages
    const chatMessages = document.getElementById('chat-messages');
    const selectionInChat = chatMessages.contains(selection.anchorNode);
    
    const shouldEnable = hasSelection && selectionInChat;
    document.getElementById('search-btn').disabled = !shouldEnable;
    document.getElementById('wikipedia-btn').disabled = !shouldEnable;
}

function performSearch(text) {
    if (!text) text = window.getSelection().toString().trim();
    if (!text) return;

    const searchEngine = settings.searchEngine || 'google';
    const query = encodeURIComponent(text);
    let url;

    switch (searchEngine) {
        case 'kagi':
            url = `https://kagi.com/search?q=${query}`;
            break;
        case 'duckduckgo':
            url = `https://duckduckgo.com/?q=${query}`;
            break;
        case 'bing':
            url = `https://www.bing.com/search?q=${query}`;
            break;
        case 'google':
        default:
            url = `https://www.google.com/search?q=${query}`;
            break;
    }

    window.electronAPI.openExternal(url);
}

function performWikipediaSearch(text) {
    if (!text) text = window.getSelection().toString().trim();
    if (!text) return;

    const query = encodeURIComponent(text);
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${query}`;
    window.electronAPI.openExternal(url);
}

// Add delete conversation function
async function deleteConversation(id) {
    const result = await window.electronAPI.deleteConversation(id);
    
    if (result.success) {
        // If deleted conversation was current, clear view
        if (currentConversation.id === id) {
            createNewConversation();
        }
        // Reload history list
        await loadConversationHistory();
        
        // Update total cost
        calculateTotalCost();
    }
}

// Update web controls state
function updateWebControlsState(enabled) {
    document.getElementById('web-results-override').disabled = !enabled;
    document.getElementById('web-toggle').classList.toggle('active', enabled);
}

// Filter conversations based on search text
function filterConversations(searchText) {
    const items = document.querySelectorAll('.conversation-item');
    
    items.forEach(item => {
        const title = item.querySelector('h3').textContent.toLowerCase();
        const preview = item.querySelector('p').textContent.toLowerCase();
        const date = item.querySelector('.conversation-date').textContent.toLowerCase();
        
        const match = title.includes(searchText) || 
                     preview.includes(searchText) || 
                     date.includes(searchText);
        
        item.classList.toggle('hidden', !match);
    });
}

// Make functions globally available
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.addSystemPrompt = addSystemPrompt;
window.updateSystemPromptName = updateSystemPromptName;
window.updateSystemPromptContent = updateSystemPromptContent;
window.setDefaultSystemPrompt = setDefaultSystemPrompt;
window.deleteSystemPrompt = deleteSystemPrompt;

// Add new helper functions
function handleTextSelection() {
    clearTimeout(quickActionsTimeout);
    quickActionsTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && isSelectionInChatMessages()) {
            showQuickActions(selection.getRangeAt(0).getBoundingClientRect());
        } else {
            hideQuickActions();
        }
    }, 100);
}

function handleQuickChat() {
    const text = getSelectedText();
    if (!text) return;
    
    const messageInput = document.getElementById('message-input');
    messageInput.value = `what is ${text}`;
    messageInput.focus();
    
    // Clear selection
    window.getSelection().removeAllRanges();
    hideQuickActions();
}

function isSelectionInChatMessages() {
    const selection = window.getSelection();
    const chatMessages = document.getElementById('chat-messages');
    return selection.rangeCount > 0 && 
           chatMessages.contains(selection.anchorNode);
}

function showQuickActions(rect) {
    const quickActions = document.getElementById('quick-actions');
    if (!quickActions) return;
    
    quickActions.classList.add('visible');
    
    // Position toolbar below selection
    quickActions.style.top = `${rect.bottom + window.scrollY + 5}px`;
    quickActions.style.left = `${rect.left + window.scrollX}px`;
}

function hideQuickActions() {
    const quickActions = document.getElementById('quick-actions');
    if (quickActions) {
        quickActions.classList.remove('visible');
    }
}

function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Add link extraction function
function extractLinks(content) {
    const linkRegex = /\[([^\]]+)\]\(((?:https?:\/\/)[^\)]+)\)/g;
    const links = [];
    let cleanContent = content;
    
    // Extract markdown-style links
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        links.push({
            text: match[1],
            url: match[2]
        });
        cleanContent = cleanContent.replace(match[0], match[1]); // Replace with just the text
    }

    // Extract bare URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(cleanContent)) !== null) {
        links.push({
            url: urlMatch[1],
            text: null
        });
    }
    
    // Remove URLs from main content since they'll be in the references
    cleanContent = cleanContent.replace(urlRegex, '');

    return {
        content: cleanContent,
        links: links.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i) // Dedupe
    };
}

// Create preview content for hidden messages
function createPreviewContent(content, cost) {
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    let costHtml = '';
    if (cost !== null && cost !== undefined) {
        // Handle both number and string representations
        const costValue = typeof cost === 'number' ? cost : parseFloat(cost);
        if (!isNaN(costValue) && costValue > 0) {
            costHtml = `<div class="preview-cost">Cost: $${costValue.toFixed(2)}</div>`;
        }
    }
    return `<div class="preview-content">${escapeHtml(preview)}${costHtml}</div>`;
}

// Toggle message visibility
function toggleMessageVisibility(messageElement, role, content, cost = null) {
    const contentDiv = messageElement.querySelector('.message-content');
    const isHidden = messageElement.classList.toggle('hidden-llm');
    
    // Update the message data in currentConversation
    const messageIndex = Array.from(messageElement.parentNode.children).indexOf(messageElement);
    // Account for welcome message and adjust index
    let adjustedIndex = messageIndex;
    if (document.querySelector('.welcome-message')) {
        adjustedIndex = messageIndex - 1;
    }
    
    if (currentConversation.messages[adjustedIndex]) {
        currentConversation.messages[adjustedIndex].hiddenFromLLM = isHidden;
    }

    if (isHidden) {
        const messageCost = cost || currentConversation.messages[adjustedIndex]?.cost || null;
        contentDiv.innerHTML = createPreviewContent(content, messageCost);
    } else {
        // Re-parse and format the original content
        const linkData = extractLinks(contentDiv.dataset.originalContent);
        let formattedContent = linkData.content;
        const links = linkData.links;

        // Format main content
        formattedContent = escapeHtml(formattedContent);
        formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        // Add links section if any were found
        if (links.length > 0) {
            formattedContent += `<div class="message-links">
                <div class="links-title">References:</div>
                ${links.map((link, index) => 
                    `<a href="#" class="message-link" data-url="${link.url}">[${index + 1}] ${link.text || link.url}</a>`
                ).join('')}
            </div>`;
        }
        
        contentDiv.innerHTML = formattedContent;
        
        // Re-add click handlers for links
        contentDiv.querySelectorAll('a.message-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.electronAPI.openExternal(link.dataset.url);
            });
        });
    }
    
    // Update toggle button icon
    const toggleIcon = messageElement.querySelector('.visibility-toggle svg');
    toggleIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
        ${isHidden ? '<path d="M2 2l20 20" stroke-width="2.5"/>' : ''}
    `;
    
    // Hide edit button for user messages when hidden
    if (role === 'user') {
        const editBtn = messageElement.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.style.display = isHidden ? 'none' : 'block';
        }
    }
    
    // Auto-save if enabled
    if (settings.autoSave && currentConversation.messages.length > 0) {
        window.electronAPI.addToHistory(currentConversation);
    }
}

// Edit message
function editMessage(messageElement, content) {
    const messageInput = document.getElementById('message-input');
    messageInput.value = content;
    messageInput.focus();
    
    // Hide this message from LLM
    const index = Array.from(messageElement.parentNode.children).indexOf(messageElement);
    // Account for welcome message
    let adjustedIndex = index;
    if (document.querySelector('.welcome-message')) {
        adjustedIndex = index - 1;
    }
    
    if (currentConversation.messages[adjustedIndex]) {
        currentConversation.messages[adjustedIndex].hiddenFromLLM = true;
        toggleMessageVisibility(messageElement, 'user', content);
    }
    
    // Hide the next message (assistant response) if it exists
    const nextElement = messageElement.nextElementSibling;
    if (nextElement && nextElement.classList.contains('assistant')) {
        const contentDiv = nextElement.querySelector('.message-content');
        const originalContent = contentDiv.dataset.originalContent;
        const cost = nextElement.querySelector('.message-cost')?.textContent.match(/\d+\.\d+/)?.[0] || null;
        
        // Hide the assistant message
        toggleMessageVisibility(nextElement, 'assistant', originalContent, cost);
    }
    
    // Auto-save if enabled
    if (settings.autoSave && currentConversation.messages.length > 0) {
        window.electronAPI.addToHistory(currentConversation);
    }
}

function setupResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.container');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const containerRect = container.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        const minWidth = 200;
        const maxWidth = window.innerWidth * 0.5;
        
        if (newWidth > minWidth && newWidth < maxWidth) {
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Save the new width
            const newWidth = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('--sidebar-width'));
            window.electronAPI.saveSidebarWidth(newWidth);
        }
    });
}

// Toggle sidebar visibility
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    toggleSidebarUI(sidebarVisible);
    window.electronAPI.saveSidebarVisibility(sidebarVisible);
}

function toggleSidebarUI(visible) {
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const container = document.querySelector('.container');
    
    if (visible) {
        sidebar.classList.remove('hidden');
        resizer.classList.remove('hidden');
        container.classList.remove('hidden-main');
        toggleBtn.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
        resizer.classList.add('hidden');
        container.classList.add('hidden-main');
        toggleBtn.classList.add('hidden');
    }
}

// Setup scroll to bottom button
function setupScrollToBottomButton() {
    const chatMessages = document.getElementById('chat-messages');
    const scrollButton = document.getElementById('scroll-to-bottom-btn');
    
    if (!chatMessages || !scrollButton) return;
    
    // Check if scrolled to bottom
    const checkScroll = () => {
        const isAtBottom = chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 1;
        scrollButton.classList.toggle('visible', !isAtBottom);
    };
    
    // Initial check
    checkScroll();
    
    // Add scroll event listener
    chatMessages.addEventListener('scroll', checkScroll);
    
    // Add click handler
    scrollButton.addEventListener('click', () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init();
    calculateTotalCost();
    setupResizer();
    // Apply initial visibility state
    toggleSidebarUI(sidebarVisible);
    setupScrollToBottomButton();
    
    // Add click listener to hide quick actions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#quick-actions') && 
            !e.target.closest('.message-content')) {
            hideQuickActions();
        }
    });
});
