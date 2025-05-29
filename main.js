const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Store = require('electron-store');
const contextMenu = require('electron-context-menu');
const fetch = require('electron').net.fetch || require('node-fetch');

// Create conversation storage directory path
const getConversationsDir = () => path.join(app.getPath('userData'), 'conversations');

// Helper function to ensure directory exists
const ensureConversationsDir = async () => {
  await fs.mkdir(getConversationsDir(), { recursive: true });
};

// Initialize settings store
const store = new Store({
  defaults: {
    apiKey: '',
    defaultModel: 'openai/gpt-3.5-turbo',
    theme: 'light',
    fontSize: 14,
    spellCheck: true,
    autoSave: true,
    webSearchEnabled: true,
    webMaxResults: 3,
    contextSize: '8192',
    searchEngine: 'google',
    systemPrompts: [
      {
        id: 'default',
        name: 'Default',
        content: 'You are a helpful AI assistant.',
        isDefault: true
      }
    ],
    activeSystemPromptId: 'default',
    systemPromptMode: 'once', // 'once' or 'always'
    selectedModels: [
      'openai/gpt-3.5-turbo',
      'openai/gpt-4',
      'anthropic/claude-2',
      'anthropic/claude-instant-1',
      'google/palm-2-chat-bison',
      'meta-llama/llama-2-70b-chat'
    ],
    includePreviousMessagesInContext: true,
    previousMessagesContextWindow: 8000,
    windowBounds: {
      x: undefined,
      y: undefined,
      width: 1200,
      height: 800
    },
    sidebarWidth: 260,
    sidebarVisibility: true
  }
});

let mainWindow;
let isDev = process.argv.includes('--dev');

function createWindow() {
  const storedBounds = store.get('windowBounds');
  
  mainWindow = new BrowserWindow({
    x: storedBounds.x,
    y: storedBounds.y,
    width: storedBounds.width,
    height: storedBounds.height,
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
      webSecurity: true // Keep security enabled but allow CORS
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Add resize handler
  mainWindow.on('resize', debounce(saveWindowBounds, 500));
  mainWindow.on('move', debounce(saveWindowBounds, 500));
  mainWindow.on('close', saveWindowBounds);

  // Create application menu
  createMenu();

  // Set up context menu
  contextMenu({
    window: mainWindow,
    showSearchWithGoogle: false,
    showInspectElement: isDev,
    prepend: (defaultActions, parameters, browserWindow) => [
      {
        label: 'Search with {searchEngine}',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          const searchEngine = store.get('searchEngine', 'google');
          const query = encodeURIComponent(parameters.selectionText);
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
          
          shell.openExternal(url);
        }
      }
    ]
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-conversation');
          }
        },
        {
          label: 'Open Conversation',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const content = await fs.readFile(result.filePaths[0], 'utf-8');
              mainWindow.webContents.send('load-conversation', JSON.parse(content));
            }
          }
        },
        {
          label: 'Save Conversation',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-conversation');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About LLM UI',
              message: 'LLM UI',
              detail: 'An Electron application for interacting with LLMs via OpenRouter API.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('save-settings', (event, settings) => {
  Object.keys(settings).forEach(key => {
    store.set(key, settings[key]);
  });
  return true;
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('get-spellcheck-suggestions', async (event, word) => {
  // Get spelling suggestions from the session
  const suggestions = await mainWindow.webContents.session.spellCheckerEnabled ? 
    mainWindow.webContents.session.getSpellCheckerLanguages() : [];
  return suggestions;
});

ipcMain.handle('save-conversation', async (event, conversation) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: `conversation-${Date.now()}.json`
  });

  if (!result.canceled) {
    await fs.writeFile(result.filePath, JSON.stringify(conversation, null, 2));
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('get-conversation-history', async () => {
  await ensureConversationsDir();
  const dir = getConversationsDir();
  const files = await fs.readdir(dir);
  const history = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf8');
        const { id, title, preview, createdAt, model } = JSON.parse(content);
        history.push({ id, title, preview, createdAt, model });
      } catch (e) {
        console.error('Error loading conversation file:', file, e);
      }
    }
  }

  return history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
});

ipcMain.handle('add-to-history', async (event, conversation) => {
  await ensureConversationsDir();
  const convPath = path.join(getConversationsDir(), `${conversation.id}.json`);
  const data = {
    ...conversation,
    model: conversation.model || 'openai/gpt-3.5-turbo', // Ensure model exists
    preview: conversation.messages[0]?.content.substring(0, 100) || '',
    messages: conversation.messages.map(msg => {
      if (msg.role === 'assistant' && !msg.modelId) {
        return {...msg, modelId: conversation.model, cost: msg.cost || null, usage: msg.usage || null, requestId: msg.requestId || null, generation: msg.generation || null, hiddenFromLLM: msg.hiddenFromLLM || false};
      }
      return {...msg, cost: msg.cost || null, usage: msg.usage || null, requestId: msg.requestId || null, generation: msg.generation || null, hiddenFromLLM: msg.hiddenFromLLM || false};
    })
  };
  await fs.writeFile(convPath, JSON.stringify(data, null, 2));
  return true;
});

ipcMain.handle('load-conversation-file', async (event, id) => {
  const convPath = path.join(getConversationsDir(), `${id}.json`);
  try {
    const content = await fs.readFile(convPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error loading conversation:', id, e);
    return null;
  }
});

ipcMain.handle('get-available-models', async () => {
  const cachedModels = store.get('modelsCache');
  
  // Return cached models if under 24 hours old
  if (cachedModels && Date.now() - cachedModels.timestamp < 86400000) {
    return cachedModels.data;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const models = data.data.map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      pricing: model.pricing,
      provider: model.id.split('/')[0]
    }));

    store.set('modelsCache', {
      timestamp: Date.now(),
      data: models
    });
    
    return models;
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return cachedModels?.data || [];
  }
});

ipcMain.handle('delete-conversation', async (event, id) => {
  const convPath = path.join(getConversationsDir(), `${id}.json`);
  
  try {
    // Confirm deletion
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 1,
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation?',
      detail: 'This action cannot be undone.'
    });
    
    if (result.response === 1) { // Delete confirmed
      await fs.unlink(convPath);
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return { success: false, error: error.message };
  }
});

// Add new helper functions
function saveWindowBounds() {
  if (!mainWindow.isMaximized() && !mainWindow.isMinimized() && mainWindow.isVisible()) {
    const bounds = mainWindow.getNormalBounds();
    store.set('windowBounds', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
  }
}

ipcMain.handle('save-sidebar-width', (event, width) => {
  store.set('sidebarWidth', width);
  return true;
});

ipcMain.handle('save-sidebar-visibility', (event, visibility) => {
  store.set('sidebarVisibility', visibility);
  return true;
});

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// App event handlers
app.whenReady().then(() => {
  console.log('App is ready, creating window...');
  createWindow();
}).catch(err => {
  console.error('Error during app startup:', err);
  dialog.showErrorBox('Startup Error', err.message);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Prevent default behavior
  event.preventDefault();
  // In production, you should verify the certificate
  callback(true);
});
