import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleFloatingWindow: () => ipcRenderer.invoke('toggle-floating-window'),
  openRealtimeDemo: () => ipcRenderer.invoke('open-realtime-demo'),
  // Realtime API
  realtimeConnect: (config?: any) => ipcRenderer.invoke('realtime-connect', config),
  realtimeSendAudio: (audioData: string | ArrayBuffer) => ipcRenderer.invoke('realtime-send-audio', audioData),
  realtimeSendText: (text: string) => ipcRenderer.invoke('realtime-send-text', text),
  realtimeUpdateSession: (instructions: string) => ipcRenderer.invoke('realtime-update-session', instructions),
  realtimeCreateResponse: () => ipcRenderer.invoke('realtime-create-response'),
  realtimeDisconnect: () => ipcRenderer.invoke('realtime-disconnect'),
  onRealtimeMessage: (callback: (message: any) => void) => {
    ipcRenderer.on('realtime-message', (_event, message) => callback(message));
  },
  removeRealtimeListener: () => {
    ipcRenderer.removeAllListeners('realtime-message');
  },
  // Conversation storage API
  saveConversations: (conversations: any[]) => ipcRenderer.invoke('save-conversations', conversations),
  loadConversations: () => ipcRenderer.invoke('load-conversations'),
  getConversationsDir: () => ipcRenderer.invoke('get-conversations-dir'),
  selectConversationsDir: () => ipcRenderer.invoke('select-conversations-dir'),
  resetConversationsDir: () => ipcRenderer.invoke('reset-conversations-dir'),
  // AI Rating API
  generateAIRating: (conversation: any) => ipcRenderer.invoke('generate-ai-rating', conversation),
});

declare global {
  interface Window {
    electronAPI: {
      toggleFloatingWindow: () => Promise<void>;
      openRealtimeDemo: () => Promise<void>;
      // Realtime API
      realtimeConnect: (config?: any) => Promise<any>;
      realtimeSendAudio: (audioData: string | ArrayBuffer) => Promise<void>;
      realtimeSendText: (text: string) => Promise<void>;
      realtimeUpdateSession: (instructions: string) => Promise<any>;
      realtimeCreateResponse: () => Promise<any>;
      realtimeDisconnect: () => Promise<void>;
      onRealtimeMessage: (callback: (message: any) => void) => void;
      removeRealtimeListener: () => void;
      // Conversation storage API
      saveConversations: (conversations: any[]) => Promise<{ success: boolean; count: number }>;
      loadConversations: () => Promise<{ conversations: any[]; count: number }>;
      getConversationsDir: () => Promise<string>;
      selectConversationsDir: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
      resetConversationsDir: () => Promise<{ success: boolean; path: string }>;
      // AI Rating API
      generateAIRating: (conversation: any) => Promise<{ success: boolean; rating: any }>;
    };
  }
}



