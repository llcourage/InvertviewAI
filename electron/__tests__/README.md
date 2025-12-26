# Electron Unit Tests

This directory contains unit tests for the Electron application.

## Test Structure

```
__tests__/
├── mocks/              # Mock implementations for testing
│   ├── electron.mock.ts # Mock Electron modules (app, BrowserWindow, ipcMain, etc.)
│   └── ws.mock.ts       # Mock WebSocket implementation
├── setup.ts            # Jest setup file
├── ipc_handlers_test.ts # Tests for IPC handler registration
├── preload_test.ts     # Tests for preload script API structure
└── websocket_test.ts   # Tests for WebSocket connection logic
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage

Current test coverage includes:

1. **IPC Handlers** - Verifies IPC handler registration
2. **Preload Script** - Tests the API structure exposed to renderer processes
3. **WebSocket** - Tests WebSocket connection logic and state management

## Adding New Tests

When adding new tests:

1. Create test files with `_test.ts` extension in the `__tests__` directory (Bazel naming convention)
2. Use the provided mocks from `__tests__/mocks/` directory
3. Follow the existing test patterns for consistency

## Mock Files

### electron.mock.ts
Mocks Electron's main process modules:
- `app` - Application lifecycle
- `BrowserWindow` - Window creation and management
- `ipcMain` - IPC handlers
- `contextBridge` - Context bridge for preload scripts
- `ipcRenderer` - IPC renderer methods

### ws.mock.ts
Mocks WebSocket implementation:
- Connection states (CONNECTING, OPEN, CLOSING, CLOSED)
- Event handling (open, message, error, close)
- Message sending and receiving

## Notes

- Tests use Jest with TypeScript support via `ts-jest`
- Electron modules are mocked to avoid requiring Electron runtime during tests
- WebSocket is mocked to test connection logic without actual network calls

