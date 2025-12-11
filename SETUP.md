# Setup Guide

## Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory (or set environment variables in Vercel):

```env
OPENAI_API_KEY=your_openai_api_key_here
VERCEL_API_URL=https://your-app.vercel.app
```

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
```bash
cd electron
npm run build
npm start
```

### 4. Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add `OPENAI_API_KEY` with your OpenAI API key

4. Update `VERCEL_API_URL` in your local `.env` to point to your deployed URL

## API Endpoints

Once deployed, the following endpoints will be available:

- `POST /api/chat` - Chat completions
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


