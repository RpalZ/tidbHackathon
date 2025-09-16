# TiDB Hackathon OCR Application

A full-stack document processing system that transforms images and PDFs into searchable, editable text using AI-powered OCR technology. Built with Next.js, FastAPI, and TiDB for intelligent exam paper analysis and question assessment.

## 🚀 Features

- **Advanced OCR Processing**: Transform PDFs and images into structured text using PaddleOCR and Google Document AI
- **Intelligent Question Parsing**: Automatically extract and categorize exam questions from papers
- **AI-Powered Chat Assistant**: Get contextual help and explanations for specific questions
- **Mark Scheme Integration**: Link question papers with mark schemes for comprehensive analysis
- **Session Management**: Organize and track multiple exam processing sessions
- **Real-time Assessment**: Interactive question-by-question assessment with AI feedback
- **Dark/Light Theme**: Modern UI with system preference detection

## 🏗️ Architecture

**Monorepo Structure:**
- **Frontend**: Next.js 15.4.5 with React 19.1.1 and TypeScript
- **Backend**: FastAPI with Python 3.12.3 (optional - API routes handle OCR)
- **UI Library**: shadcn/ui components with Tailwind CSS
- **Database**: TiDB with Prisma ORM
- **Build System**: pnpm workspace with Turbo monorepo

## 📋 Prerequisites

**Required Software:**
- **Node.js**: 20.19.4+ (required by engines field)
- **pnpm**: 10.4.1 (specified in packageManager field)
- **Python**: 3.12.3+ (for backend OCR processing)


- TiDB Cloud account (or local TiDB instance)

## 🛠️ Installation & Setup

### 1. Install Dependencies

**Install pnpm globally:**
```bash
npm install -g pnpm@10.4.1
```

**Clone and install project dependencies:**
```bash
git clone <repository-url>
cd tidbHackathon
pnpm install
```

### 2. Environment Configuration

**Copy environment template:**
```bash
cd apps/web
cp .env.example .env.local
```

**Configure required environment variables in `apps/web/.env.local`:**
```env
# Database (Required)
DATABASE_URL="mysql://username:password@host:port/database"

# NextAuth (Required)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Required for auth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI (Required for AI features)
OPENAI_API_KEY="your-openai-api-key"


### 3. Database Setup

**Push database schema:**
```bash
cd apps/web
pnpm prisma db push
```

**Generate Prisma client:**
```bash
pnpm prisma generate
```

## 🚦 Running the Application

### Development Mode

**Start the development server:**
```bash
# From project root
pnpm dev --filter=web

# Or from web app directory
cd apps/web
pnpm dev
```

The application will be available at `http://localhost:3000`

### Build for Production

**Build the project:**
```bash
# From project root
pnpm build
```

**⚠️ Known Build Issue - Google Fonts:**
If build fails with `Failed to fetch Geist from Google Fonts`, temporarily modify `apps/web/app/layout.tsx`:

```typescript
// Comment out Google Font imports:
// import { Geist, Geist_Mono } from "next/font/google"

// Replace font variables with system fonts:
<body className="font-sans antialiased">
```

### Optional: Backend OCR Server

**For enhanced OCR processing, start the Python backend:**
```bash
cd apps/backend
pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Backend will run on `http://localhost:8000`

## 📖 Usage Guide

### 1. Authentication
- Navigate to `http://localhost:3000`
- Sign in with Google OAuth
- Create or access existing sessions

### 2. Document Processing
- **Upload Documents**: Upload PDF question papers and mark schemes
- **Link Files**: Connect question papers with their corresponding mark schemes
- **Auto-Processing**: OCR extraction and question parsing happens automatically

### 3. AI Chat Assistant
- **Switch to Chat Mode**: Use the toggle in the left panel
- **Ask Questions**: Get contextual help about specific questions or concepts
- **Current Paper Context**: Chat responses are scoped to your currently selected paper

### 4. Question Assessment
- **Review Questions**: Browse extracted questions in the main panel
- **Get Mark Schemes**: View corresponding mark scheme information
- **AI Feedback**: Receive intelligent explanations and scoring guidance

## 🧰 Development Commands

**Linting:**
```bash
pnpm lint
```
*Note: ESLint dependency resolution may fail in UI package - this is a known monorepo issue and can be ignored.*

**Type checking:**
```bash
cd apps/web && pnpm typecheck
```

**Database management:**
```bash
cd apps/web
pnpm prisma studio    # Visual database browser
pnpm prisma migrate dev --name <migration-name>
pnpm prisma db push   # Push schema changes
```

**Add new UI components:**
```bash
pnpm dlx shadcn@latest add [component] -c apps/web
```

## 🏗️ Project Structure

```
├── apps/
│   ├── web/                    # Next.js frontend application
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── page.tsx       # Landing page
│   │   │   ├── auth/          # Authentication
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── session/       # Session management
│   │   │   └── api/           # API routes (OCR, chat, etc.)
│   │   ├── components/        # App-specific components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and configurations
│   │   └── prisma/            # Database schema and migrations
│   └── backend/               # FastAPI Python server (optional)
│       ├── main.py           # OCR processing server
│       └── requirements.txt  # Python dependencies
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

## 🔧 Configuration Files

- **`turbo.json`**: Build system configuration with dependency caching
- **`pnpm-workspace.yaml`**: Defines monorepo packages
- **`apps/web/components.json`**: shadcn/ui configuration (New York style)
- **`apps/web/next.config.mjs`**: Next.js configuration with UI transpilation

## 📊 Performance Notes

- **Initial build**: ~35 seconds (includes TypeScript compilation)
- **PaddleOCR first run**: Downloads models (~2GB), requires 5-10 minutes
- **Dev server startup**: ~1.3 seconds with Turbopack
- **Hot reload**: Near-instant with Next.js Fast Refresh

## 🚨 Troubleshooting

**Common Issues:**

1. **Build Failures:**
   - Google Fonts network errors → Use system fonts temporarily
   - ESLint command not found → Dependency resolution issue, can be ignored

2. **Development Server Issues:**
   - Port 3000 in use → Next.js auto-detects next available port
   - Turbo dev hanging → Run `pnpm dev` directly in `apps/web`

3. **Database Issues:**
   - Connection errors → Check DATABASE_URL in .env.local
   - Migration conflicts → Run `pnpm prisma db push` to sync schema

4. **OCR Processing:**
   - PaddleOCR import errors → Install PaddlePaddle or use mock backend
   - Google Document AI errors → Check cloud credentials and API limits

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Run linting and type checking: `pnpm lint && pnpm typecheck`
5. Commit changes: `git commit -m 'Add new feature'`
6. Push to branch: `git push origin feature/new-feature`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏆 TiDB Hackathon

This project was built for the TiDB Hackathon, showcasing the integration of TiDB's distributed database capabilities with modern OCR and AI technologies for intelligent document processing.

---

**Built with ❤️ for the TiDB Hackathon**
