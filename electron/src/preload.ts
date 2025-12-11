import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  toggleFloatingWindow: () => ipcRenderer.invoke('toggle-floating-window'),
  apiChat: (data: any) => ipcRenderer.invoke('api-chat', data),
  apiSpeech: (data: any) => ipcRenderer.invoke('api-speech', data),
  apiUsage: () => ipcRenderer.invoke('api-usage'),
});

declare global {
  interface Window {
    electronAPI: {
      toggleFloatingWindow: () => Promise<void>;
      apiChat: (data: any) => Promise<any>;
      apiSpeech: (data: any) => Promise<any>;
      apiUsage: () => Promise<any>;
    };
  }
}


