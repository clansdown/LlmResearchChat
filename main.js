const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Store = require('electron-store');
const contextMenu = require('electron-context-menu');

// Initialize settings store
const store = new Store({
  defaults: {
    apiKey: '',
    defaultModel: 'openai/gpt-3.5-turbo',
    theme: 'light',
    fontSize: 14,
    spellCheck: true,
    autoSave: true,
    conversationHistory: [],
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
    systemPromptMode: 'once' // 'once' or 'always'
  }
});

let mainWindow;
let isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

ipcMain.handle('get-conversation-history', () => {
  return store.get('conversationHistory', []);
});

ipcMain.handle('add-to-history', (event, conversation) => {
  const history = store.get('conversationHistory', []);
  history.unshift({
    id: Date.now(),
    title: conversation.title || 'Untitled Conversation',
    date: new Date().toISOString(),
    preview: conversation.messages[0]?.content.substring(0, 100) || ''
  });
  // Keep only last 50 conversations
  store.set('conversationHistory', history.slice(0, 50));
  return true;
});

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