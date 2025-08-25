# GitHub Copilot Instructions for TiDB Hackathon OCR Application

## Repository Overview

This is a **TiDB Hackathon OCR (Optical Character Recognition) application** - a full-stack document processing system that transforms images and PDFs into searchable, editable text using AI-powered OCR technology.

**Project Type**: Monorepo web application  
**Size**: ~4.7MB source code (~1,400 lines total: 1,181 TypeScript/JavaScript + 207 Python)  
**Architecture**: Next.js frontend + FastAPI backend + shared UI component library  
**Target Users**: Document processing and text extraction workflows  

### Technology Stack
- **Frontend**: Next.js 15.4.5, React 19.1.1, TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: FastAPI, Python 3.12.3, PaddleOCR, Google Cloud Document AI
- **Build System**: pnpm workspace + Turbo monorepo build system
- **Styling**: Tailwind CSS with dark/light theme support
- **Components**: shadcn/ui "New York" style with Radix UI primitives

## Build Instructions & Environment Setup

### Prerequisites
**CRITICAL**: Always install these exact versions to avoid compatibility issues:
- **Node.js**: 20.19.4+ (required by engines field)
- **pnpm**: 10.4.1 (specified in packageManager field)  
- **Python**: 3.12.3+ for backend

### Installation & Build Process

**1. Install pnpm globally first:**
```bash
npm install -g pnpm@10.4.1
```

**2. Install dependencies:**
```bash
pnpm install
```

**3. Build the project:**
```bash
pnpm build
```

**⚠️ KNOWN BUILD ISSUE - Google Fonts Network Failure:**
If build fails with `Failed to fetch Geist from Google Fonts`, temporarily modify `apps/web/app/layout.tsx`:

```typescript
// Comment out Google Font imports:
// import { Geist, Geist_Mono } from "next/font/google"

// Replace font variables with system fonts:
<body className="font-sans antialiased">
```

This is required in network-restricted environments. Restore Google Fonts for production deployments.

**4. Development server:**
```bash
pnpm dev --filter=web
# Runs on http://localhost:3000 (or next available port)
```


### Validation Commands

**Linting (with known issues):**
```bash
pnpm lint
```
**Known Issue**: ESLint dependency resolution may fail in UI package. If `eslint: command not found` occurs, this is a monorepo dependency resolution issue and can be safely ignored during development.

**Type checking:**
```bash
cd apps/web && pnpm typecheck
```

**Build verification:**
```bash
pnpm build  # Should complete successfully after font fixes
```

### Environment Variables
The application expects these environment variables for full functionality:
- `GOOGLE_CLOUD_CREDENTIALS`: JSON credentials for Google Cloud Document AI
- `DOCUMENT_AI_LOCATION`: Google Cloud region
- `DOCUMENT_AI_PROJECT_ID`: Google Cloud project ID  
- `DOCUMENT_AI_PROCESSOR_ID`: Document AI processor ID

For development, these can be omitted as the app includes mock OCR functionality.

## Project Layout & Architecture

### Monorepo Structure
```
├── apps/
│   ├── web/                    # Next.js frontend application
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── page.tsx       # Landing page with OCR demo
│   │   │   ├── auth/page.tsx  # Authentication placeholder
│   │   │   └── api/ocr/       # OCR API endpoints
│   │   ├── components/        # App-specific components
│   │   └── package.json       # Web app dependencies
│   └── backend/               # FastAPI Python server (deprecated)
│       ├── main.py           # OCR processing server
│       ├── requirements.txt  # Python dependencies
│       └── output/           # OCR processing results
├── packages/
│   ├── ui/                   # Shared UI component library
│   │   ├── src/components/   # shadcn/ui components
│   │   └── src/styles/       # Global CSS and themes
│   ├── eslint-config/        # Shared ESLint configuration
│   └── typescript-config/    # Shared TypeScript configuration
├── docs/                     # Project documentation
├── package.json              # Root workspace configuration
├── turbo.json               # Turbo build configuration
└── pnpm-workspace.yaml      # pnpm workspace definition
```

### Key Configuration Files
- **`turbo.json`**: Build system configuration with dependency caching
- **`pnpm-workspace.yaml`**: Defines monorepo packages  
- **`apps/web/components.json`**: shadcn/ui configuration (New York style)
- **`apps/web/next.config.mjs`**: Next.js configuration with UI transpilation
- **`.eslintrc.js`**: Root ESLint config (ignores apps/packages)

### Component Architecture
- **Landing Page**: Modern card-based layout with hero, features, demo, and CTA sections
- **Navbar**: Floating navbar with theme toggle and authentication placeholder
- **Theme System**: Dark/light mode with system preference detection
- **OCR Demo**: Interactive document processing with mock/real OCR integration

### API Structure
- **`/api/ocr` (GET)**: Test OCR processing with sample document
- **`/api/ocr` (POST)**: Process uploaded documents  
- **Backend `/test`**: Mock OCR processing for development
- **Backend `/`**: Real OCR processing with PaddleOCR

## Development Workflow

### Adding Components
```bash
# Add new shadcn/ui components to the web app:
pnpm dlx shadcn@latest add [component] -c apps/web
```

Components are automatically placed in `packages/ui/src/components` and can be imported as:
```typescript
import { ComponentName } from "@workspace/ui/components/component-name"
```

### Making Changes
1. **Frontend changes**: Modify files in `apps/web/`, components auto-reload
2. **UI components**: Edit `packages/ui/src/components/`, changes reflect across apps  
3. **Backend changes**: Restart Python server manually
4. **Build validation**: Run `pnpm build` before committing

### Testing OCR Functionality
1. Start backend: `cd apps/backend && python3 -m uvicorn main:app --reload`
2. Start frontend: `pnpm dev --filter=web`  
3. Navigate to landing page, use "Process Document" demo button
4. Mock OCR returns: "Sample OCR result: This is extracted text from your document."

## Troubleshooting Common Issues

**Build Failures:**
- Google Fonts network errors → Use system fonts temporarily
- ESLint command not found → Dependency resolution issue, can be ignored
- PaddleOCR import errors → Install PaddlePaddle or use mock backend

**Development Server Issues:**
- Port 3000 in use → Next.js auto-detects next available port
- Turbo dev hanging → Run `pnpm dev` directly in `apps/web` instead

**Performance Notes:**
- Initial build: ~35 seconds (includes TypeScript compilation)
- PaddleOCR first run: Downloads models (~2GB), requires 5-10 minutes
- Dev server startup: ~1.3 seconds with Turbopack

## Critical Instructions for Agents

1. **ALWAYS run `pnpm install` before any build operations**
2. **NEVER commit Google Font workarounds to production** - restore original imports
3. **USE system fonts temporarily** if build fails in network-restricted environments  
4. **EXPECT ESLint resolution issues** in monorepo - this is known and non-blocking
5. **TEST both mock and real OCR endpoints** when making API changes
6. **VALIDATE responsive design** on mobile/desktop when modifying UI
7. **PRESERVE theme system integrity** when adding new components

**Trust these instructions completely** - they are based on comprehensive testing of the build system, dependency resolution, and common development workflows. Only search for additional information if these instructions are incomplete or contain errors.