/**
 * Unit tests for WebSocket connection logic
 */

import { WebSocket } from './mocks/ws.mock';

describe('WebSocket Connection', () => {
  let mockWS: WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket Mock', () => {
    it('should create a WebSocket instance', () => {
      mockWS = new WebSocket('wss://api.openai.com/v1/realtime', {
        headers: {
          'Authorization': 'Bearer test-key',
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      expect(mockWS).toBeDefined();
      expect(mockWS.url).toBe('wss://api.openai.com/v1/realtime');
      expect(mockWS.headers).toEqual({
        'Authorization': 'Bearer test-key',
        'OpenAI-Beta': 'realtime=v1',
      });
    });

    it('should transition to OPEN state', (done) => {
      mockWS = new WebSocket('wss://test.com');
      
      mockWS.on('open', () => {
        expect(mockWS.readyState).toBe(WebSocket.OPEN);
        done();
      });
    });

    it('should send messages when open', () => {
      mockWS = new WebSocket('wss://test.com');
      mockWS.readyState = WebSocket.OPEN;

      const message = JSON.stringify({ type: 'test', data: 'hello' });
      mockWS.send(message);

      expect(mockWS.bufferedAmount).toBeGreaterThan(0);
    });

    it('should throw error when sending while not open', () => {
      mockWS = new WebSocket('wss://test.com');
      mockWS.readyState = WebSocket.CLOSED;

      expect(() => {
        mockWS.send('test');
      }).toThrow('WebSocket is not open');
    });

    it('should handle close event', (done) => {
      mockWS = new WebSocket('wss://test.com');
      mockWS.readyState = WebSocket.OPEN;

      mockWS.on('close', (code: number, reason: Buffer) => {
        expect(mockWS.readyState).toBe(WebSocket.CLOSED);
        expect(code).toBe(1000);
        done();
      });

      mockWS.close(1000);
    });

    it('should handle message events', () => {
      mockWS = new WebSocket('wss://test.com');
      mockWS.readyState = WebSocket.OPEN;

      const callback = jest.fn();
      mockWS.on('message', callback);

      const testData = Buffer.from(JSON.stringify({ type: 'test' }));
      mockWS._simulateMessage(testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should handle error events', () => {
      mockWS = new WebSocket('wss://test.com');
      mockWS.readyState = WebSocket.OPEN;

      const callback = jest.fn();
      mockWS.on('error', callback);

      const testError = new Error('Connection failed');
      mockWS._simulateError(testError);

      expect(callback).toHaveBeenCalledWith(testError);
    });
  });

  describe('WebSocket States', () => {
    it('should have correct state constants', () => {
      expect(WebSocket.CONNECTING).toBe(0);
      expect(WebSocket.OPEN).toBe(1);
      expect(WebSocket.CLOSING).toBe(2);
      expect(WebSocket.CLOSED).toBe(3);
    });
  });
});

