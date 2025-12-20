import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleFloatingWindow: () => ipcRenderer.invoke('toggle-floating-window'),
  apiChat: (data: any) => ipcRenderer.invoke('api-chat', data),
  apiInterview: (data: any) => ipcRenderer.invoke('api-interview', data),
  apiSpeech: (data: any) => ipcRenderer.invoke('api-speech', data),
  apiTts: (data: any) => ipcRenderer.invoke('api-tts', data),
  apiUsage: () => ipcRenderer.invoke('api-usage'),
  onInterviewStreamChunk: (callback: (data: { content: string; fullText: string }) => void) => {
    ipcRenderer.on('interview-stream-chunk', (_event, data) => callback(data));
  },
  removeInterviewStreamListener: () => {
    ipcRenderer.removeAllListeners('interview-stream-chunk');
  },
});

declare global {
  interface Window {
    electronAPI: {
      toggleFloatingWindow: () => Promise<void>;
      apiChat: (data: any) => Promise<any>;
      apiInterview: (data: any) => Promise<any>;
      apiSpeech: (data: any) => Promise<any>;
      apiTts: (data: any) => Promise<any>;
      apiUsage: () => Promise<any>;
      onInterviewStreamChunk: (callback: (data: { content: string; fullText: string }) => void) => void;
      removeInterviewStreamListener: () => void;
    };
  }
}



