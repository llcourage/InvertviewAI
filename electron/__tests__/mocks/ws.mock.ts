// Mock WebSocket (ws) module for testing
export class WebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = WebSocket.CONNECTING;
  bufferedAmount: number = 0;
  url: string;
  headers: any;

  private _onOpen: ((() => void) | null) = null;
  private _onMessage: (((data: any) => void) | null) = null;
  private _onError: (((error: any) => void) | null) = null;
  private _onClose: (((code: number, reason: Buffer) => void) | null) = null;

  constructor(url: string, options?: any) {
    this.url = url;
    this.headers = options?.headers || {};
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this._onOpen) {
        this._onOpen();
      }
    }, 10);
  }

  on(event: string, callback: any) {
    switch (event) {
      case 'open':
        this._onOpen = callback;
        break;
      case 'message':
        this._onMessage = callback;
        break;
      case 'error':
        this._onError = callback;
        break;
      case 'close':
        this._onClose = callback;
        break;
    }
  }

  send(data: string | Buffer) {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Simulate sending data
    this.bufferedAmount += typeof data === 'string' ? data.length : data.length;
  }

  close(code?: number, reason?: Buffer) {
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      if (this._onClose) {
        this._onClose(code || 1000, reason || Buffer.from(''));
      }
    }, 10);
  }

  // Helper methods for testing
  _simulateMessage(data: any) {
    if (this._onMessage) {
      this._onMessage(data);
    }
  }

  _simulateError(error: any) {
    if (this._onError) {
      this._onError(error);
    }
  }
}

