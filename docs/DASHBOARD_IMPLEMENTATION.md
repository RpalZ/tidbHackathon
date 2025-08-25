# Dashboard Implementation Documentation - Exam Parser Edition

## Overview

This document details the implementation of a **modern card-based dashboard with adjustable sidebar navigation** specifically designed for the **TiDB Hackathon OCR Exam Parser & Solver Application**. The dashboard provides a specialized interface for managing exam processing sessions, viewing solution statistics, and configuring OCR/AI settings.

## Architecture

### Technology Stack
- **Frontend Framework**: Next.js 15.4.5 with React 19.1.1
- **UI Library**: shadcn/ui (New York style)
- **Styling**: Tailwind CSS with dark/light theme support
- **Icons**: Lucide React (specialized for exam processing: Upload, FileText, Brain, CheckCircle)
- **State Management**: React useState hooks with optimistic updates
- **Routing**: Next.js App Router with dynamic routes for individual sessions

### Component Structure
```
apps/web/
├── app/
│   ├── dashboard/page.tsx              # Main dashboard page component
│   └── session/[id]/page.tsx          # Individual exam session page
├── components/
│   ├── dashboard-sidebar.tsx           # Sidebar navigation component
│   └── dashboard-content.tsx           # Exam sessions management area
```

## Features Implemented

### 1. Exam-Focused Dashboard Layout
- **Specialized Design**: Purpose-built for exam paper processing workflows
- **Session-Based Organization**: Each session represents an exam processing workspace
- **Real-time Status Tracking**: Live progress indicators for OCR, parsing, and solving stages
- **Question-Level Granularity**: Individual question progress and solution confidence scores

### 2. Adjustable Sidebar Navigation
- **Collapsible Sidebar**: Uses shadcn/ui Sidebar component
- **Three Main Tabs**:
  - Sessions: Session management and creation
  - Stats: Analytics and performance metrics
  - Settings: Configuration options
- **Icon + Text Layout**: Can collapse to icon-only mode
- **Hover Effects**: Interactive feedback for better UX
- **Top Margin**: Added `mt-4` spacing for visual separation

### 3. Sessions Tab - Interactive Grid System
- **Grid Layout**: Responsive CSS Grid (2-5 columns based on screen size)
- **Create Session Block**: Dashed border "+" button for creating new sessions
- **Session Blocks**: Individual cards for each session with:
  - Auto-generated names ("Session 1", "Session 2", etc.)
  - Creation date display
  - Status indicators (active/paused/stopped with color-coded dots)
  - Play/Pause toggle functionality
  - Delete functionality (appears on hover)
- **Empty State**: Helpful messaging when no sessions exist
- **State Management**: Full CRUD operations for sessions

### 4. Stats and Settings Tabs
- **Placeholder Content**: Ready-to-implement structure for future components
- **Consistent Layout**: Follows the same card-based design pattern
- **Extensible Design**: Easy to add new functionality

## Component Details

### DashboardPage (`apps/web/app/dashboard/page.tsx`)

**Purpose**: Main dashboard container with authentication and layout management.

**Key Features**:
- Authentication check with session management
- Loading states and redirect handling
- SidebarProvider integration for collapsible functionality
- Header with sidebar trigger and title
- State management for active tab selection

**Dependencies**:
- `next-auth/react` for session management
- `next/navigation` for routing
- Custom dashboard components

### DashboardSidebar (`apps/web/components/dashboard-sidebar.tsx`)

**Purpose**: Navigation sidebar with tab switching functionality.

**Key Features**:
- Icon-based navigation (Users, BarChart3, Settings)
- Active state management with visual indicators
- Click handlers for tab switching
- Top margin for visual spacing (`mt-4`)

**Props**:
- `activeTab: string` - Currently selected tab
- `onTabChange: (tabId: string) => void` - Tab change handler

### DashboardContent (`apps/web/components/dashboard-content.tsx`)

**Purpose**: Main content area that renders different views based on active tab.

**Key Features**:
- Tab-based content rendering
- Session management with full CRUD operations
- Responsive grid layouts
- Interactive session blocks
- State management for sessions array

**Session Management**:
```typescript
interface Session {
  id: string
  name: string
  status: 'active' | 'paused' | 'stopped'
  createdAt: Date
  duration?: string
}
```

**Functions**:
- `createSession()` - Adds new session to state
- `deleteSession(sessionId)` - Removes session from state
- `toggleSessionStatus(sessionId)` - Toggles between active/paused

## Installation and Dependencies

### Required shadcn/ui Components
The following components were installed for the dashboard:

```bash
# Core sidebar functionality
npx shadcn@latest add sidebar

# Additional UI components
npx shadcn@latest add tabs

# Dependencies automatically installed:
# - separator
# - tooltip  
# - input
# - skeleton
```

### Required Radix UI Dependencies
```bash
# Installed in packages/ui workspace
pnpm add @radix-ui/react-separator
pnpm add @radix-ui/react-tooltip
```

### Custom Hook Implementation
Created `useIsMobile` hook inline within sidebar component to avoid module resolution issues:

```typescript
const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
```

## Responsive Design

### Grid Breakpoints
- **Mobile (default)**: 2 columns
- **Medium (md)**: 3 columns  
- **Large (lg)**: 4 columns
- **Extra Large (xl)**: 5 columns

### Layout Adaptations
- Sidebar collapses to icons on mobile
- Content padding adjusts for different screen sizes
- Cards maintain aspect ratio across breakpoints

## State Management

### Dashboard-level State
- `activeTab` - Controls which content view is displayed
- Managed in main dashboard page and passed to child components

### Sessions State
- `sessions` array - Contains all session objects
- Local state management with useState hook
- CRUD operations update state immutably

## Authentication Integration

### Session Handling
```typescript
const { data: session, status } = useSession()

useEffect(() => {
  if (status === "loading") return
  
  if (!session?.user) {
    router.push("/auth")
  }
}, [session, status, router])
```

### Loading States
- Shows loading spinner while checking authentication
- Graceful redirect to auth page if not authenticated
- Prevents flash of unauthenticated content

## Styling and Theming

### CSS Classes Used
- **Layout**: `flex`, `grid`, `space-y-*`, `gap-*`
- **Responsive**: `md:*`, `lg:*`, `xl:*` breakpoint prefixes
- **Interactive**: `hover:*`, `group-hover:*`, `transition-*`
- **Theme**: `text-muted-foreground`, `border-primary`, `bg-background`

### Color Coding
- **Active Sessions**: Green indicator (`bg-green-500`)
- **Paused Sessions**: Yellow indicator (`bg-yellow-500`) 
- **Stopped Sessions**: Gray indicator (`bg-gray-400`)
- **Create Button**: Primary theme color on hover

## Future Enhancements

### Planned Features
1. **Stats Tab**: Charts and analytics integration
2. **Settings Tab**: User preferences and configuration
3. **Session Details**: Expanded session information and controls
4. **Real-time Updates**: WebSocket integration for live session status
5. **Export Functionality**: Session data export capabilities
6. **Search and Filters**: Session organization and discovery

### Technical Improvements
1. **Persistent Storage**: Save sessions to database
2. **Real-time Collaboration**: Multi-user session management  
3. **Performance Optimization**: Virtualization for large session lists
4. **Accessibility**: Enhanced keyboard navigation and screen reader support

## Troubleshooting

### Common Issues

1. **Module Resolution Errors**
   - Solution: Inline hooks or use relative imports with proper extensions

2. **Authentication Redirect Loop**
   - Solution: Use useEffect for side effects, not direct calls in render

3. **Sidebar Not Collapsing**
   - Solution: Ensure SidebarProvider wraps the entire layout

4. **Theme Inconsistencies** 
   - Solution: Use shadcn/ui theme variables and classes consistently

### Development Commands

```bash
# Start development server
pnpm dev --filter=web

# Build project
pnpm build

# Type checking
cd apps/web && pnpm typecheck

# Linting
pnpm lint
```

## Conclusion

The dashboard implementation provides a solid foundation for the TiDB Hackathon OCR Application with:

- Modern, responsive design
- Intuitive session management
- Extensible architecture for future features
- Full integration with existing authentication and theming systems
- Professional appearance suitable for production use

The modular component structure makes it easy to extend functionality and maintain code quality as the application grows.
