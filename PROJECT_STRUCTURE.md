# Project Structure

```
interview-ai/
├── api/                      # Vercel API Routes
│   ├── chat.ts              # POST /api/chat - Chat completions
│   ├── speech.ts            # POST /api/speech - Speech-to-text
│   ├── usage.ts             # GET/POST /api/usage - Usage tracking
│   └── package.json         # API dependencies
│
├── electron/                # Electron Desktop Client
│   ├── src/                 # Main process (TypeScript)
│   │   ├── main.ts         # Main process entry point
│   │   └── preload.ts      # Preload script for IPC
│   ├── renderer/           # Renderer process (HTML/CSS/JS)
│   │   ├── main.html       # Main window UI
│   │   └── floating.html   # Floating window UI
│   ├── BUILD               # Bazel build file
│   ├── package.json        # Electron dependencies
│   └── tsconfig.json       # TypeScript config
│
├── website/                # Next.js Web Frontend
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   ├── page.module.css # Home page styles
│   │   ├── globals.css    # Global styles
│   │   └── globals.d.ts   # TypeScript declarations
│   ├── BUILD              # Bazel build file
│   ├── package.json       # Website dependencies
│   ├── tsconfig.json      # TypeScript config
│   └── next.config.js     # Next.js config
│
├── docs/                   # Documentation
│   └── architecture.md    # Architecture documentation
│
├── BUILD                   # Root Bazel build file
├── WORKSPACE              # Bazel workspace configuration
├── package.json           # Root package.json (workspaces)
├── tsconfig.json          # Root TypeScript config
├── vercel.json            # Vercel deployment config
├── .gitignore            # Git ignore rules
├── README.md             # Main README
├── SETUP.md              # Setup guide
└── PROJECT_STRUCTURE.md  # This file
```

## Key Files

### API Routes (`api/`)
- **chat.ts**: Handles chat completion requests, forwards to OpenAI
- **speech.ts**: Handles speech-to-text transcription requests
- **usage.ts**: Tracks API usage and enforces limits

### Electron Client (`electron/`)
- **main.ts**: Main process that creates windows and handles IPC
- **preload.ts**: Bridge between renderer and main process
- **main.html**: Main application window UI
- **floating.html**: Floating window UI

### Website (`website/`)
- **page.tsx**: Main chat interface (React component)
- **layout.tsx**: Root layout wrapper
- Uses Next.js App Router architecture

### Build System
- **WORKSPACE**: Bazel workspace configuration
- **BUILD**: Bazel build targets
- Bazel is used for building Electron and managing dependencies

## Data Flow

1. **Client** (Electron or Website) → **Vercel API** (`/api/*`)
2. **Vercel API** → **OpenAI API** (with API key)
3. **OpenAI API** → **Vercel API** → **Client**

All clients communicate through Vercel API only. OpenAI API key is never exposed to clients.











