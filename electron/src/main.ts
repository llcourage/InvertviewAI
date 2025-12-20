import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;

// Get API URL from environment or use default
// For local development, use http://127.0.0.1:3000 (IPv4) to avoid IPv6 issues
// For production, set VERCEL_API_URL environment variable
const API_URL = process.env.VERCEL_API_URL || process.env.API_URL || 'http://127.0.0.1:3000';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/main.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatingWindow() {
  floatingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  floatingWindow.loadFile(path.join(__dirname, '../renderer/floating.html'));

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('toggle-floating-window', () => {
  if (floatingWindow) {
    floatingWindow.close();
    floatingWindow = null;
  } else {
    createFloatingWindow();
  }
});

ipcMain.handle('api-chat', async (_event, data) => {
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API error:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new Error(`Cannot connect to API server at ${API_URL}. Please make sure the API server is running. Start it with: cd website && npm run dev`);
    }
    throw error;
  }
});

ipcMain.handle('api-speech', async (_event, data) => {
  try {
    const response = await fetch(`${API_URL}/api/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API error:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new Error(`Cannot connect to API server at ${API_URL}. Please make sure the API server is running.`);
    }
    throw error;
  }
});

ipcMain.handle('api-interview', async (_event, data) => {
  try {
    const response = await fetch(`${API_URL}/api/interview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              break;
            }

            try {
              const json = JSON.parse(data);
              const content = json.content || '';
              if (content) {
                fullText += content;
                // Send incremental updates to renderer
                _event.sender.send('interview-stream-chunk', { content, fullText });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Return final complete text
      return {
        choices: [{
          message: {
            content: fullText,
            role: 'assistant',
          },
        }],
      };
    } else {
      // Fallback to non-streaming response
      return await response.json();
    }
  } catch (error: any) {
    console.error('API error:', error);
    // Provide more helpful error message
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      throw new Error(`Cannot connect to API server at ${API_URL}. Please make sure the API server is running or set VERCEL_API_URL environment variable.`);
    }
    throw error;
  }
});

ipcMain.handle('api-tts', async (_event, data) => {
  try {
    const response = await fetch(`${API_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API error:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new Error(`Cannot connect to API server at ${API_URL}. Please make sure the API server is running.`);
    }
    throw error;
  }
});

ipcMain.handle('api-usage', async () => {
  try {
    const response = await fetch(`${API_URL}/api/usage`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API error:', error);
    // Don't throw error for usage check - it's not critical
    return { limit: 1000, used: 0, remaining: 1000 };
  }
});

