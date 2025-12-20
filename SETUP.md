# Setup Guide

## Quick Start

### 1. Environment Setup

Create a `.env.local` file in the `website` directory:

```bash
cd website
cp .env.local.example .env.local
```

Edit `.env.local` and add your OpenAI API key:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Get your API key from: https://platform.openai.com/api-keys

### 2. Install Dependencies

```bash
# Root dependencies
npm install

# Website dependencies
cd website
npm install
cd ..

# Electron dependencies
cd electron
npm install
cd ..
```

### 3. Local Development

#### Website (Next.js)
```bash
cd website
npm run dev
# Opens at http://localhost:3000
```

#### Electron Client

**Important:** The Electron client needs the API server to be running locally.

```bash
# Terminal 1: Start the API server
cd website
npm install
npm run dev
# This starts Next.js on http://127.0.0.1:3000

# Terminal 2: Start Electron
cd electron
npm install
npm run build
npm start
```

The Electron app will automatically connect to `http://127.0.0.1:3000`.

### 4. Production Build (Optional)

If you want to build for production:

```bash
cd website
npm run build
npm start
```

This will start the production server on http://localhost:3000

## API Endpoints

The following API endpoints are available locally at `http://127.0.0.1:3000/api/`:

- `POST /api/interview` - Interview conversation (with prompts)
- `POST /api/tts` - Text-to-speech conversion
- `POST /api/speech` - Speech-to-text transcription
- `GET /api/usage` - Get usage statistics
- `POST /api/usage` - Increment usage counter

## Building with Bazel

```bash
# Install Bazel (if not already installed)
# See: https://bazel.build/install

# Build Electron
bazel build //electron:electron-app

# Build Website
bazel build //website:website-package
```

## Troubleshooting

### API Routes Not Working
- Ensure `OPENAI_API_KEY` is set in Vercel environment variables
- Check that API routes are in the `api/` directory
- Verify `vercel.json` configuration

### Electron Not Starting
- Run `npm run build` in the `electron/` directory first
- Check that all dependencies are installed
- Ensure TypeScript compilation succeeds

### Website Build Errors
- Clear `.next` directory: `rm -rf website/.next`
- Reinstall dependencies: `cd website && rm -rf node_modules && npm install`



