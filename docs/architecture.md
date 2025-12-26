# Architecture

## Runtime Architecture

### Electron Client
- Local desktop application with main UI and floating window
- Optional: runs local Whisper for speech-to-text conversion
- Sends ALL requests to Vercel `/api/...` endpoints
- Never calls OpenAI directly

### Website
- Hosted on Vercel
- Uses the same Vercel API `/api/...` endpoints as the Electron client

### Vercel
1. **Backend API Proxy:**
   - Provides `/api/chat`, `/api/speech`, `/api/usage` endpoints
   - Forwards requests to OpenAI and streams responses
   - Hides OpenAI API key from clients
   - Checks plan/usage limits

2. **Frontend Hosting:**
   - Hosts the Website frontend

### OpenAI
- Only Vercel communicates with OpenAI
- Clients never directly access OpenAI APIs

## Build System

### Bazel
- Used ONLY for building Electron, tools, and managing dependencies
- Not part of runtime architecture
- Bazel targets are kept simple and minimal











