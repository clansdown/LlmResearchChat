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
    systemPromptMode: 'once'
};

let isTyping = false;
let abortController = null;

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
    
    // Apply font size
    document.body.style.fontSize = `${settings.fontSize}px`;
    
    // Update settings modal
    document.getElementById('api-key').value = settings.apiKey || '';
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('font-size').value = settings.fontSize;
    document.getElementById('spell-check').checked = settings.spellCheck;
    document.getElementById('auto-save').checked = settings.autoSave;
    document.getElementById('search-engine').value = settings.searchEngine || 'google';
    document.getElementById('system-prompt-mode').value = settings.systemPromptMode || 'once';
    
    // Update model selector
    if (settings.defaultModel) {
        document.getElementById('model-selector').value = settings.defaultModel;
    }
    
    // Load system prompts in settings
    displaySystemPrompts();
}

// Set up event listeners
function setupEventListeners() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const settingsBtn = document.getElementById('settings-btn');
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
    
    // Settings button
    settingsBtn.addEventListener('click', openSettings);
    
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
        model: document.getElementById('model-selector').value,
        createdAt: new Date().toISOString()
    };
    
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
}

// Load a conversation
async function loadConversation(conversationItem) {
    const fullConversation = await window.electronAPI.loadConversationFile(conversationItem.id);
    if (!fullConversation) return;

    currentConversation = fullConversation;
    document.getElementById('conversation-title').textContent = currentConversation.title;
    document.getElementById('model-selector').value = currentConversation.model;
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    currentConversation.messages.forEach(msg => {
        if (msg.role === 'assistant') {
            appendMessage(msg.role, msg.content, false, msg.modelName);
        } else {
            appendMessage(msg.role, msg.content, false);
        }
    });
    
    updateConversationList();
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
    currentConversation.messages.push({ role: 'user', content: message });
    
    // Clear input
    messageInput.value = '';
    updateSendButton();
    
    // Show typing indicator and stop button
    showTypingIndicator();
    isTyping = true;
    
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
        updateSendButton();
        
        // Auto-save if enabled
        if (settings.autoSave && currentConversation.messages.length > 0) {
            await window.electronAPI.addToHistory(currentConversation);
        }
    }
}

// Prepare messages with system prompt
function prepareMessagesWithSystemPrompt() {
    const messages = [...currentConversation.messages];
    const activePrompt = settings.systemPrompts.find(p => p.id === settings.activeSystemPromptId);
    
    if (activePrompt && activePrompt.content) {
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
                max_tokens: 2048
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
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
    }
    
    // Add the complete message to conversation
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    currentConversation.messages.push({ 
        role: 'assistant', 
        content: fullContent,
        modelName: modelName
    });
    
    // Update conversation title if it's the first exchange
    if (currentConversation.messages.filter(m => m.role === 'user').length === 1) {
        const firstUserMessage = currentConversation.messages.find(m => m.role === 'user');
        currentConversation.title = firstUserMessage.content.substring(0, 50) + 
            (firstUserMessage.content.length > 50 ? '...' : '');
        document.getElementById('conversation-title').textContent = currentConversation.title;
        updateConversationList();
    }
}

// Append a message to the chat
function appendMessage(role, content, animate = true, modelName = null) {
    const chatMessages = document.getElementById('chat-messages');
    
    // Remove welcome message if exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    if (animate) messageDiv.style.animation = 'fadeIn 0.3s ease-out';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (role === 'user') {
        avatar.textContent = 'U';
    } else if (role === 'assistant') {
        // Use first 3 characters of model name
        avatar.textContent = modelName ? modelName.substring(0, 3).toUpperCase() : 'AI';
        if (modelName) avatar.title = modelName;
    } else {
        avatar.textContent = 'S';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse markdown-like formatting and links
    content = escapeHtml(content);
    content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" class="external-link">$1</a>');
    content = content.replace(/\n/g, '<br>');
    
    contentDiv.innerHTML = content;
    
    // Add click handlers for links
    contentDiv.querySelectorAll('a.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(link.href);
        });
    });
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.preview)}</p>
        `;
        
        div.addEventListener('click', () => {
            loadConversation(item);
        });
        
        conversationList.appendChild(div);
    });
    
    updateConversationList();
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
        searchEngine: document.getElementById('search-engine').value,
        systemPromptMode: document.getElementById('system-prompt-mode').value,
        systemPrompts: settings.systemPrompts,
        defaultModel: document.getElementById('default-model-select').value,
        selectedModels: settings.selectedModels
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
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    avatar.textContent = modelName.substring(0, 3).toUpperCase();
    avatar.title = modelName;
    
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
function updateStreamingMessage(element, content) {
    // Parse markdown and links
    let formattedContent = escapeHtml(content);
    formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    formattedContent = formattedContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" class="external-link">$1</a>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    element.innerHTML = formattedContent + '<span class="cursor-blink">▋</span>';
    
    // Add click handlers for links
    element.querySelectorAll('a.external-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(link.href);
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
}

// Load available models
async function loadAvailableModels() {
    try {
        const allModels = await window.electronAPI.getAvailableModels();
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
    loadSystemPrompts();
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
    loadSystemPrompts();
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
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="6" width="12" height="12"/>
            </svg>
        `;
        sendBtn.onclick = stopGeneration;
    } else {
        sendBtn.disabled = !messageInput.value.trim();
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
        `;
        sendBtn.onclick = sendMessage;
    }
}

// Stop generation
function stopGeneration() {
    if (abortController) {
        abortController.abort();
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
    const modelName = document.getElementById('model-selector').selectedOptions[0].textContent.split(' (')[0];
    avatar.textContent = modelName.substring(0, 3).toUpperCase();
    avatar.title = modelName;
    
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

function performSearch() {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;

    const searchEngine = settings.searchEngine || 'google';
    const query = encodeURIComponent(selection);
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

function performWikipediaSearch() {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;

    const query = encodeURIComponent(selection);
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${query}`;
    window.electronAPI.openExternal(url);
}

// Make functions globally available
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.addSystemPrompt = addSystemPrompt;
window.updateSystemPromptName = updateSystemPromptName;
window.updateSystemPromptContent = updateSystemPromptContent;
window.setDefaultSystemPrompt = setDefaultSystemPrompt;
window.deleteSystemPrompt = deleteSystemPrompt;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
