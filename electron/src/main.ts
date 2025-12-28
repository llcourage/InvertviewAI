import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let demoWindow: BrowserWindow | null = null;
let realtimeWS: WebSocket | null = null;

// Diagnostic counters
let audioChunksReceived = 0;
let audioChunksSent = 0;
let audioChunksDropped = 0;
let audioChunksDroppedBackpressure = 0;
let lastDiagnosticLog = 0;
const DIAGNOSTIC_LOG_INTERVAL = 5000; // Log every 5 seconds


function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // Hide menu bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/main.html'));
  
  // Ensure menu bar is hidden
  mainWindow.setMenuBarVisibility(false);

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

// Save conversations before app quits
app.on('before-quit', () => {
  console.log('[STORAGE] App is quitting, ensuring conversations are saved...');
  // Note: Conversations are saved automatically via IPC, but we can add a final save here if needed
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

ipcMain.handle('open-realtime-demo', () => {
  if (demoWindow) {
    demoWindow.focus();
    return;
  }

  demoWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true, // Enable dev tools for debugging
      webSecurity: false, // Disable web security for debugging (remove in production)
    },
  });

  // Open dev tools for debugging
  demoWindow.webContents.openDevTools();
  
  // Prevent navigation that might cause page reload
  demoWindow.webContents.on('will-navigate', (event) => {
    console.log('[WARN] Prevented navigation');
    event.preventDefault();
  });
  
  // Prevent new window creation
  demoWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Add error handling
  demoWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Demo window failed to load:', errorCode, errorDescription, validatedURL);
  });

  demoWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Demo Window ${level}]:`, message);
  });

  const demoPath = path.join(__dirname, '../renderer/realtime-demo.html');
  console.log('Loading demo from:', demoPath);
  console.log('File exists:', require('fs').existsSync(demoPath));
  
  demoWindow.loadFile(demoPath).catch((error) => {
    console.error('Failed to load demo file:', error);
  });

  demoWindow.on('closed', () => {
    demoWindow = null;
    // Close Realtime connection if demo window closes
    if (realtimeWS) {
      realtimeWS.close();
      realtimeWS = null;
    }
  });
});

// Track response state to avoid duplicate response.create requests
let hasActiveResponse = false;

// Load API key from local config file
function loadApiKey(): string | null {
  try {
    const configPath = path.join(__dirname, '../config.local.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      if (config.openaiApiKey) {
        return config.openaiApiKey;
      }
    }
  } catch (error) {
    console.error('[ERROR] Failed to load config.local.json:', error);
  }
  
  // Fallback to environment variable
  return process.env.OPENAI_API_KEY || null;
}

// Realtime API WebSocket connection
ipcMain.handle('realtime-connect', async (_event, config) => {
  // Load API key from local config file or environment variable
  const apiKey = loadApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please create electron/config.local.json with your API key or set OPENAI_API_KEY environment variable.');
  }

  return new Promise((resolve, reject) => {
    // Set timeout for connection (10 seconds)
    const timeout = setTimeout(() => {
      if (realtimeWS && realtimeWS.readyState !== WebSocket.OPEN) {
        console.error('[ERROR] WebSocket connection timeout');
        if (realtimeWS) {
          realtimeWS.close();
          realtimeWS = null;
        }
        reject(new Error('WebSocket connection timeout'));
      }
    }, 10000);

    try {
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview';
      console.log('[DEBUG] Connecting to:', wsUrl);
      
      realtimeWS = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      } as any);

      realtimeWS.on('open', () => {
        clearTimeout(timeout);
        console.log('[OK] Realtime API WebSocket connected');
        console.log('[DIAG] WebSocket readyState:', realtimeWS?.readyState);
        console.log('[DIAG] WebSocket bufferedAmount:', realtimeWS?.bufferedAmount || 0);
        
        // Reset diagnostic counters on new connection
        audioChunksReceived = 0;
        audioChunksSent = 0;
        audioChunksDropped = 0;
        audioChunksDroppedBackpressure = 0;
        lastDiagnosticLog = Date.now();
        
        // Interview AI prompt for behavior interview
        const interviewInstructions = `You are Interview AI, a professional behavior interview assistant conducting a behavior interview.

Your role:
- Your name is Interview AI
- You are conducting a behavior interview (behavioral interview)
- You should be professional, friendly, and engaging

Interview flow:
1. When the user connects, you should first introduce yourself: "Hello, I'm Interview AI. Welcome to your behavior interview. I'm here to help you showcase your experiences and skills. Let's begin!"
2. After the user responds to your greeting, start asking behavior interview questions
3. After receiving the user's response to a question, you can either:
   - Ask a follow-up question to dig deeper into their answer
   - Move on to the next behavior interview question
4. Continue the interview naturally, asking relevant follow-ups when appropriate

Guidelines:
- Ask clear, specific behavior interview questions (e.g., "Tell me about a time when...", "Describe a situation where...")
- Listen actively to the user's responses
- Ask follow-up questions to get more details (e.g., "What was your specific role in that situation?", "How did you handle that challenge?")
- Keep questions relevant to behavior interview topics (leadership, teamwork, problem-solving, conflict resolution, etc.)
- Be conversational and natural, not robotic
- Speak clearly and at a moderate pace`;

        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: interviewInstructions,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            // Enable transcription for user speech so we can display it in history
            input_audio_transcription: {
              model: 'whisper-1'
            },
            // Enable noise reduction to reduce echo
            // input_audio_noise_reduction: true, // Removed - API expects object, not boolean
            turn_detection: {
              type: 'server_vad',
              threshold: 0.8, // Further increased to 0.8 to be even more strict (was 0.7)
              prefix_padding_ms: 800, // Increased to capture more prefix audio (was 500)
              silence_duration_ms: 2500 // Increased to 2.5 seconds - gives user more time for pauses (was 2000)
            }
          },
        };
        
        if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
            try {
              realtimeWS.send(JSON.stringify(sessionConfig));
              console.log('[OK] Session configuration sent');
              console.log('[DIAG] Session config size:', JSON.stringify(sessionConfig).length, 'bytes');
            } catch (sendError: any) {
              console.error('[ERROR] Failed to send session config:', sendError?.message || String(sendError));
              console.error('[ERROR] WebSocket state:', realtimeWS?.readyState);
            }
        }
        
        resolve({ connected: true });
      });

      realtimeWS.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Send to all windows that might be listening
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('realtime-message', message);
          }
          if (demoWindow && !demoWindow.isDestroyed()) {
            demoWindow.webContents.send('realtime-message', message);
          }
          
          // Log only important events to prevent console flood
          if (message.type !== 'response.audio.delta' && message.type !== 'response.audio_transcript.delta') {
             console.log('[MSG] Realtime message:', message.type);
          } else {
            // Log audio delta for debugging (sample every 10th message to avoid spam)
            if (message.type === 'response.audio.delta') {
              const deltaLength = message.delta ? message.delta.length : 0;
              if (Math.random() < 0.1) { // Log 10% of audio deltas
                console.log(`[MSG] Realtime message: response.audio.delta (${deltaLength} bytes)`);
              }
            }
          }
          
          // Always log response.audio.done to confirm audio completion
          if (message.type === 'response.audio.done') {
            console.log('[MSG] Realtime message: response.audio.done - audio response completed');
          }
          
          // Reset hasActiveResponse when response is done
          if (message.type === 'response.done') {
            hasActiveResponse = false;
            console.log('[MSG] Realtime message: response.done - response completed, hasActiveResponse reset');
          }

          // Log session.updated to check if input_audio_transcription was applied
          if (message.type === 'session.updated' && message.session) {
            console.log('[DIAG] Session updated - input_audio_transcription:', JSON.stringify(message.session.input_audio_transcription, null, 2));
          }

          if (message.type === 'error') {
            console.error('[ERROR] Server error:', JSON.stringify(message, null, 2));
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      });

      realtimeWS.on('error', (error: any) => {
        clearTimeout(timeout);
        console.error('[ERROR] WebSocket error:', error);
        console.error('[ERROR] WebSocket error code:', error?.code);
        console.error('[ERROR] WebSocket error message:', error?.message);
        console.error('[ERROR] WebSocket error stack:', error?.stack);
        console.error('[DIAG] WebSocket readyState at error:', realtimeWS?.readyState);
        console.error('[DIAG] WebSocket bufferedAmount at error:', realtimeWS?.bufferedAmount || 0);
        console.error('[DIAG] Audio stats at error: received=', audioChunksReceived, 'sent=', audioChunksSent, 'dropped=', audioChunksDropped);
        const memoryUsage = process.memoryUsage();
        console.error('[DIAG] Memory at error: heapUsed=', Math.round(memoryUsage.heapUsed / 1024 / 1024), 'MB');
        // Don't close immediately here, let 'close' event handle cleanup
      });

      realtimeWS.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        const reasonStr = reason ? reason.toString() : 'Unknown';
        console.log(`[CLOSED] WebSocket closed. Code: ${code}, Reason: ${reasonStr}`);
        console.log('[DIAG] Final audio stats: received=', audioChunksReceived, 'sent=', audioChunksSent, 'dropped=', audioChunksDropped, '(backpressure=', audioChunksDroppedBackpressure, ')');
        const memoryUsage = process.memoryUsage();
        console.log('[DIAG] Final memory: heapUsed=', Math.round(memoryUsage.heapUsed / 1024 / 1024), 'MB, heapTotal=', Math.round(memoryUsage.heapTotal / 1024 / 1024), 'MB, rss=', Math.round(memoryUsage.rss / 1024 / 1024), 'MB');
        
        hasActiveResponse = false;
        
        // Send to all windows
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('realtime-message', {
            type: 'connection.closed',
            code: code,
            reason: reasonStr
          });
        }
        if (demoWindow && !demoWindow.isDestroyed()) {
          demoWindow.webContents.send('realtime-message', {
            type: 'connection.closed',
            code: code,
            reason: reasonStr
          });
        }
        realtimeWS = null;
      });
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('[ERROR] Failed to create WebSocket:', error);
      reject(new Error(`Failed to create WebSocket: ${error.message || 'Unknown error'}`));
    }
  });
});

// Fixed audio sending logic with backpressure protection and diagnostic logging
ipcMain.handle('realtime-send-audio', async (_event, audioData: string | ArrayBuffer) => {
  audioChunksReceived++;
  
  // Log first few received chunks
  if (audioChunksReceived <= 5) {
    console.log(`[DIAG] Audio chunk #${audioChunksReceived} received from renderer`);
    console.log(`[DIAG] Audio data type: ${typeof audioData}, isArrayBuffer: ${audioData instanceof ArrayBuffer}`);
    if (typeof audioData === 'string') {
      console.log(`[DIAG] Base64 string length: ${audioData.length} chars`);
    } else if (audioData instanceof ArrayBuffer) {
      console.log(`[DIAG] ArrayBuffer length: ${audioData.byteLength} bytes`);
    }
  }
  
  // 1. Basic connection check
  if (!realtimeWS || realtimeWS.readyState !== WebSocket.OPEN) {
    audioChunksDropped++;
    if (audioChunksReceived <= 5 || audioChunksReceived % 100 === 0) {
      console.log(`[DIAG] Audio chunk dropped: WebSocket not connected (received: ${audioChunksReceived}, dropped: ${audioChunksDropped})`);
      console.log(`[DIAG] WebSocket state: ${realtimeWS ? realtimeWS.readyState : 'null'}`);
    }
    return;
  }

  // 2. Critical fix: Backpressure check
  // If buffer backlog exceeds 64KB (about 2-3 seconds of audio), drop current frame
  // This prevents memory overflow causing main process crash
  const bufferedAmount = realtimeWS.bufferedAmount;
  if (audioChunksReceived <= 5) {
    console.log(`[DIAG] WebSocket bufferedAmount before check: ${bufferedAmount} bytes (${Math.round(bufferedAmount / 1024)}KB)`);
  }
  if (bufferedAmount > 64 * 1024) {
    audioChunksDroppedBackpressure++;
    audioChunksDropped++;
    if (audioChunksDroppedBackpressure <= 5 || audioChunksDroppedBackpressure % 10 === 0) {
      console.warn(`[DIAG] Backpressure: bufferedAmount=${bufferedAmount} bytes (${Math.round(bufferedAmount / 1024)}KB), dropped chunks: ${audioChunksDroppedBackpressure}`);
    }
    return;
  }

  try {
    let base64Audio: string = '';
    let audioSize = 0;

    // 3. Data conversion (optimized)
    if (typeof audioData === 'string') {
      base64Audio = audioData;
      audioSize = base64Audio.length;
    } else if (audioData instanceof ArrayBuffer || ArrayBuffer.isView(audioData)) {
      // Only convert when necessary
      const buffer = Buffer.from(audioData as ArrayBuffer);
      audioSize = buffer.length;
      if (buffer.length > 0) {
         base64Audio = buffer.toString('base64');
      }
    }

    // 4. Validation
    if (!base64Audio) {
      audioChunksDropped++;
      if (audioChunksReceived % 100 === 0) {
        console.warn(`[DIAG] Audio chunk dropped: empty base64Audio (received: ${audioChunksReceived})`);
      }
      return;
    }

    // 5. Construct message
    const message = {
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    };
    
    // 6. Send with diagnostic logging
    try {
      if (audioChunksSent < 5) {
        console.log(`[DIAG] About to send audio chunk #${audioChunksSent + 1}, message size: ${JSON.stringify(message).length} bytes`);
      }
      
      realtimeWS.send(JSON.stringify(message));
      audioChunksSent++;
      
      if (audioChunksSent <= 5) {
        console.log(`[DIAG] Audio chunk #${audioChunksSent} sent successfully`);
        console.log(`[DIAG] WebSocket bufferedAmount after send: ${realtimeWS.bufferedAmount} bytes`);
      }
    } catch (sendError: any) {
      console.error(`[ERROR] Failed to send audio chunk #${audioChunksSent + 1}:`, sendError);
      console.error('[ERROR] Send error details:', {
        message: sendError?.message || String(sendError),
        stack: sendError?.stack,
        readyState: realtimeWS.readyState,
        bufferedAmount: realtimeWS.bufferedAmount
      });
      throw sendError; // Re-throw to be caught by outer catch
    }

    // Periodic diagnostic logging (every 5 seconds or every 100 chunks)
    const now = Date.now();
    if (now - lastDiagnosticLog > DIAGNOSTIC_LOG_INTERVAL || audioChunksSent % 100 === 0) {
      const memoryUsage = process.memoryUsage();
      console.log(`[DIAG] Audio stats: received=${audioChunksReceived}, sent=${audioChunksSent}, dropped=${audioChunksDropped} (backpressure=${audioChunksDroppedBackpressure})`);
      console.log(`[DIAG] WebSocket: bufferedAmount=${realtimeWS.bufferedAmount} bytes (${Math.round(realtimeWS.bufferedAmount / 1024)}KB), readyState=${realtimeWS.readyState}`);
      console.log(`[DIAG] Memory: heapUsed=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, heapTotal=${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB, rss=${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
      console.log(`[DIAG] Last chunk: size=${audioSize} bytes, base64Length=${base64Audio.length} chars`);
      lastDiagnosticLog = now;
    }

  } catch (error: any) {
    audioChunksDropped++;
    console.error('[ERROR] Failed to handle audio chunk:', error?.message || String(error));
    console.error('[ERROR] Error stack:', error?.stack);
    console.error('[ERROR] Audio data type:', typeof audioData, audioData instanceof ArrayBuffer ? 'ArrayBuffer' : '');
    if (typeof audioData === 'string') {
      console.error('[ERROR] Base64 string length:', audioData.length);
    } else if (audioData instanceof ArrayBuffer) {
      console.error('[ERROR] ArrayBuffer length:', audioData.byteLength);
    }
  }
});

ipcMain.handle('realtime-send-text', async (_event, text: string) => {
  if (!realtimeWS) {
    console.error('[ERROR] WebSocket is null');
    throw new Error('WebSocket not connected (null)');
  }
  
  if (realtimeWS.readyState !== WebSocket.OPEN) {
    const stateNames: { [key: number]: string } = {
      [WebSocket.CONNECTING]: 'CONNECTING',
      [WebSocket.OPEN]: 'OPEN',
      [WebSocket.CLOSING]: 'CLOSING',
      [WebSocket.CLOSED]: 'CLOSED'
    };
    console.error(`[ERROR] WebSocket not open. State: ${stateNames[realtimeWS.readyState] || realtimeWS.readyState}`);
    throw new Error(`WebSocket not connected (state: ${stateNames[realtimeWS.readyState] || realtimeWS.readyState})`);
  }

  try {
    // Step 1: Create conversation item
    const createMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text,
          },
        ],
      },
    };
    
    console.log(`[SEND] Sending text message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    realtimeWS.send(JSON.stringify(createMessage));
    console.log('[OK] Conversation item created');
    
    // Step 2: Request response explicitly (only if no active response)
    // According to Realtime API docs, we need to send response.create to get AI response
    if (hasActiveResponse) {
      console.log('[WARN] Already has active response, skipping response.create');
    } else {
      setTimeout(() => {
        if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN && !hasActiveResponse) {
          const responseRequest = {
            type: 'response.create',
          };
          console.log('[SEND] Requesting AI response...');
          realtimeWS.send(JSON.stringify(responseRequest));
          console.log('[OK] Response request sent');
          hasActiveResponse = true; // Set immediately to prevent duplicate requests
        }
      }, 100); // Small delay to ensure item is created first
    }
    
  } catch (error: any) {
    console.error('[ERROR] Failed to send text message:', error);
    throw error;
  }
});

// Create AI response (trigger AI to speak without user input)
ipcMain.handle('realtime-create-response', async () => {
  if (!realtimeWS) {
    console.error('[ERROR] WebSocket is null for response.create');
    throw new Error('WebSocket is not connected (null)');
  }
  
  if (realtimeWS.readyState !== WebSocket.OPEN) {
    const stateNames: { [key: number]: string } = {
      [WebSocket.CONNECTING]: 'CONNECTING',
      [WebSocket.OPEN]: 'OPEN',
      [WebSocket.CLOSING]: 'CLOSING',
      [WebSocket.CLOSED]: 'CLOSED'
    };
    console.error(`[ERROR] WebSocket not open for response.create. State: ${stateNames[realtimeWS.readyState] || realtimeWS.readyState}`);
    throw new Error(`WebSocket is not connected (state: ${stateNames[realtimeWS.readyState] || realtimeWS.readyState})`);
  }

  if (hasActiveResponse) {
    console.log('[WARN] Already has active response, skipping response.create');
    return { success: false, reason: 'Already has active response' };
  }

  try {
    const responseRequest = {
      type: 'response.create',
    };
    
    console.log('[SEND] Requesting AI response (auto-start)...');
    realtimeWS.send(JSON.stringify(responseRequest));
    console.log('[OK] Response request sent');
    hasActiveResponse = true; // Set immediately to prevent duplicate requests
    
    return { success: true };
  } catch (error: any) {
    console.error('[ERROR] Failed to create response:', error);
    throw new Error(`Failed to create response: ${error.message || String(error)}`);
  }
});

ipcMain.handle('realtime-disconnect', async () => {
  if (realtimeWS) {
    realtimeWS.close();
    realtimeWS = null;
    console.log('[OK] Realtime API disconnected');
  }
});

// Conversation storage management
// Store user-selected conversations directory path
let customConversationsDir: string | null = null;
const CONFIG_FILE = path.join(app.getPath('userData'), 'app-config.json');

// Load custom conversations directory from config
function loadCustomConversationsDir(): string | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      if (config.conversationsDir && typeof config.conversationsDir === 'string') {
        // Validate that the directory exists or can be created
        if (fs.existsSync(config.conversationsDir) || 
            (fs.existsSync(path.dirname(config.conversationsDir)))) {
          return config.conversationsDir;
        } else {
          console.warn('[STORAGE] Custom conversations directory does not exist:', config.conversationsDir);
        }
      }
    }
  } catch (error) {
    console.error('[STORAGE] Failed to load custom conversations directory:', error);
  }
  return null;
}

// Save custom conversations directory to config
function saveCustomConversationsDir(dirPath: string) {
  try {
    let config: any = {};
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      config = JSON.parse(configData);
    }
    config.conversationsDir = dirPath;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    customConversationsDir = dirPath;
    console.log('[STORAGE] Saved custom conversations directory:', dirPath);
  } catch (error) {
    console.error('[STORAGE] Failed to save custom conversations directory:', error);
    throw error;
  }
}

function getConversationsDir(): string {
  // Use custom directory if set, otherwise use default
  if (customConversationsDir) {
    const dir = customConversationsDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[STORAGE] Created custom conversations directory:', dir);
    }
    return dir;
  }
  
  // Default: use userData/conversations
  const userDataPath = app.getPath('userData');
  const conversationsDir = path.join(userDataPath, 'conversations');
  
  // Ensure directory exists
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
    console.log('[STORAGE] Created default conversations directory:', conversationsDir);
  }
  
  return conversationsDir;
}

// Load custom directory on startup
customConversationsDir = loadCustomConversationsDir();
if (customConversationsDir) {
  console.log('[STORAGE] Using custom conversations directory:', customConversationsDir);
}

function getConversationsFilePath(): string {
  return path.join(getConversationsDir(), 'conversations.json');
}

// Save conversations to file
ipcMain.handle('save-conversations', async (_event, conversations: any[]) => {
  try {
    const filePath = getConversationsFilePath();
    const data = JSON.stringify(conversations, null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    console.log(`[STORAGE] Saved ${conversations.length} conversations to ${filePath}`);
    return { success: true, count: conversations.length };
  } catch (error: any) {
    console.error('[STORAGE] Failed to save conversations:', error);
    throw new Error(`Failed to save conversations: ${error.message || String(error)}`);
  }
});

// Load conversations from file
ipcMain.handle('load-conversations', async () => {
  try {
    const filePath = getConversationsFilePath();
    
    if (!fs.existsSync(filePath)) {
      console.log('[STORAGE] No conversations file found, returning empty array');
      return { conversations: [], count: 0 };
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    const conversations = JSON.parse(data);
    
    // Validate and convert date strings back to Date objects
    if (Array.isArray(conversations)) {
      conversations.forEach((conv: any) => {
        if (conv.startTime && typeof conv.startTime === 'string') {
          conv.startTime = new Date(conv.startTime);
        }
        // Ensure messages array exists
        if (!Array.isArray(conv.messages)) {
          conv.messages = [];
        }
      });
      
      console.log(`[STORAGE] Loaded ${conversations.length} conversations from ${filePath}`);
      return { conversations, count: conversations.length };
    } else {
      console.warn('[STORAGE] Invalid conversations file format, returning empty array');
      return { conversations: [], count: 0 };
    }
  } catch (error: any) {
    console.error('[STORAGE] Failed to load conversations:', error);
    // Return empty array on error instead of throwing
    return { conversations: [], count: 0 };
  }
});

// Get conversations directory path (for user reference)
ipcMain.handle('get-conversations-dir', async () => {
  return getConversationsDir();
});

// Let user select conversations directory
ipcMain.handle('select-conversations-dir', async () => {
  try {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Conversations Storage Folder',
      buttonLabel: 'Select Folder'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedDir = result.filePaths[0];
      saveCustomConversationsDir(selectedDir);
      
      // Move existing conversations.json to new location if it exists in old location
      const oldFilePath = path.join(app.getPath('userData'), 'conversations', 'conversations.json');
      const newFilePath = path.join(selectedDir, 'conversations.json');
      
      if (fs.existsSync(oldFilePath) && !fs.existsSync(newFilePath)) {
        try {
          fs.copyFileSync(oldFilePath, newFilePath);
          console.log('[STORAGE] Copied existing conversations to new location');
        } catch (copyError) {
          console.warn('[STORAGE] Failed to copy existing conversations:', copyError);
        }
      }
      
      return { success: true, path: selectedDir };
    }
    
    return { success: false, canceled: true };
  } catch (error: any) {
    console.error('[STORAGE] Failed to select conversations directory:', error);
    throw new Error(`Failed to select directory: ${error.message || String(error)}`);
  }
});

// Reset to default conversations directory
ipcMain.handle('reset-conversations-dir', async () => {
  try {
    customConversationsDir = null;
    // Remove from config
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      delete config.conversationsDir;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    }
    const defaultDir = path.join(app.getPath('userData'), 'conversations');
    console.log('[STORAGE] Reset to default conversations directory:', defaultDir);
    return { success: true, path: defaultDir };
  } catch (error: any) {
    console.error('[STORAGE] Failed to reset conversations directory:', error);
    throw new Error(`Failed to reset directory: ${error.message || String(error)}`);
  }
});

// Generate AI rating for conversation
ipcMain.handle('generate-ai-rating', async (_event, conversation: any) => {
  try {
    const apiKey = loadApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }
    
    // Build conversation transcript
    const transcript = conversation.messages.map((msg: any) => {
      const speaker = msg.speaker === 'You' ? 'Candidate' : 'Interviewer';
      return `${speaker}: ${msg.text}`;
    }).join('\n\n');
    
    // Rating prompt template
    const ratingPrompt = `You are an expert interviewer evaluating a candidate's performance. Based on the following interview transcript, provide a comprehensive evaluation.

Interview Transcript:
${transcript}

Please evaluate the candidate across three key dimensions:
1. Leadership - Ability to lead, influence, and take initiative
2. Communication - Clarity, articulation, and effectiveness of communication
3. Collaboration - Teamwork, cooperation, and ability to work with others

For each dimension, provide:
- A score from 1-5 (1 = Poor, 5 = Excellent)
- Specific examples from the transcript
- Strengths and areas for improvement

Then provide an overall hiring recommendation from these options:
- "No Hire" - Significant concerns that outweigh strengths
- "Lean No Hire" - More concerns than strengths, but some positive aspects
- "Lean Hire" - More strengths than concerns, but some areas need development
- "Hire" - Strong candidate with clear strengths and manageable concerns
- "Strong Hire" - Exceptional candidate with outstanding qualifications

Format your response as JSON with the following structure:
{
  "leadership": {
    "score": 1-5,
    "examples": ["example 1", "example 2"],
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["improvement 1", "improvement 2"]
  },
  "communication": {
    "score": 1-5,
    "examples": ["example 1", "example 2"],
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["improvement 1", "improvement 2"]
  },
  "collaboration": {
    "score": 1-5,
    "examples": ["example 1", "example 2"],
    "strengths": ["strength 1", "strength 2"],
    "improvements": ["improvement 1", "improvement 2"]
  },
  "overallRecommendation": "No Hire" | "Lean No Hire" | "Lean Hire" | "Hire" | "Strong Hire",
  "summary": "Overall summary of the candidate's performance",
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Respond ONLY with valid JSON, no additional text.`;

    // Call OpenAI API using Node.js https module
    const https = require('https');
    const postData = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert interviewer. Provide detailed, objective evaluations in JSON format.'
        },
        {
          role: 'user',
          content: ratingPrompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    const response = await new Promise<any>((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(data),
            text: async () => data
          });
        });
      });
      
      req.on('error', (error: any) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    const ratingContent = data.choices[0].message.content;
    
    // Parse JSON response
    let rating;
    try {
      rating = JSON.parse(ratingContent);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = ratingContent.match(/```json\s*([\s\S]*?)\s*```/) || ratingContent.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        rating = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Failed to parse rating response as JSON');
      }
    }
    
    // Add timestamp
    rating.timestamp = new Date().toISOString();
    
    console.log('[RATING] Generated AI rating:', rating);
    return { success: true, rating };
  } catch (error: any) {
    console.error('[RATING] Failed to generate AI rating:', error);
    throw new Error(`Failed to generate rating: ${error.message || String(error)}`);
  }
});


