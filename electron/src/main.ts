import { app, BrowserWindow, ipcMain } from 'electron';
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
        
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a helpful assistant. Speak quickly and concisely.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            // Enable noise reduction to reduce echo
            // input_audio_noise_reduction: true, // Removed - API expects object, not boolean
            // Note: input_audio_transcription is optional. 
            // Realtime API can understand audio directly without transcription.
            // Only enable if you need text transcripts for display/history.
            turn_detection: {
              type: 'server_vad',
              threshold: 0.3, // Lowered for better sensitivity
              prefix_padding_ms: 300,
              silence_duration_ms: 400 // Reduced for faster response
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

ipcMain.handle('realtime-disconnect', async () => {
  if (realtimeWS) {
    realtimeWS.close();
    realtimeWS = null;
    console.log('[OK] Realtime API disconnected');
  }
});


