// Mock Electron module for testing
export const app = {
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
  isReady: jest.fn(() => true),
};

export const BrowserWindow = jest.fn().mockImplementation((options) => {
  const mockWindow = {
    loadFile: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
      on: jest.fn(),
      setWindowOpenHandler: jest.fn(),
    },
    on: jest.fn((event, callback) => {
      if (event === 'closed') {
        // Store callback for manual triggering
        mockWindow._closedCallback = callback;
      }
    }),
    _closedCallback: null as (() => void) | null,
  };
  return mockWindow;
});

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn(),
};

export const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  send: jest.fn(),
};

