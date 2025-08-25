# Dashboard Setup Guide

## Prerequisites

Before setting up the dashboard, ensure you have:

- Node.js 20.19.4+
- pnpm 10.4.1
- Python 3.12.3+ (for backend if needed)
- Existing TiDB Hackathon OCR Application setup

## Installation Steps

### 1. Install Required shadcn/ui Components

Navigate to the web app directory and install the necessary components:

```bash
cd apps/web

# Install sidebar component (includes dependencies)
npx shadcn@latest add sidebar

# Install tabs component  
npx shadcn@latest add tabs
```

This will automatically create the following files:
- `packages/ui/src/components/sidebar.tsx`
- `packages/ui/src/components/separator.tsx`
- `packages/ui/src/components/tooltip.tsx`
- `packages/ui/src/components/input.tsx`
- `packages/ui/src/components/skeleton.tsx`
- `packages/ui/src/components/tabs.tsx`
- `apps/web/hooks/use-mobile.ts`

### 2. Install Radix UI Dependencies

Install the required Radix UI packages in the UI workspace:

```bash
cd packages/ui

# Install separator component dependency
pnpm add @radix-ui/react-separator

# Install tooltip component dependency  
pnpm add @radix-ui/react-tooltip
```

### 3. Create Dashboard Components

Create the main dashboard components in `apps/web/components/`:

#### DashboardSidebar Component
Create `apps/web/components/dashboard-sidebar.tsx`:

```typescript
"use client"

import { BarChart3, Settings, Users } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

// Menu items for dashboard navigation
const menuItems = [
  { title: "Sessions", icon: Users, id: "sessions" },
  { title: "Stats", icon: BarChart3, id: "stats" },
  { title: "Settings", icon: Settings, id: "settings" },
]

interface DashboardSidebarProps {
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function DashboardSidebar({ activeTab, onTabChange }: DashboardSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent className="mt-4">
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    isActive={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
```

#### DashboardContent Component
Create `apps/web/components/dashboard-content.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Plus, Play, Pause, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface Session {
  id: string
  name: string
  status: 'active' | 'paused' | 'stopped'
  createdAt: Date
  duration?: string
}

interface DashboardContentProps {
  activeTab: string
}

export function DashboardContent({ activeTab }: DashboardContentProps) {
  const [sessions, setSessions] = useState<Session[]>([])

  const createSession = () => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name: `Session ${sessions.length + 1}`,
      status: 'stopped',
      createdAt: new Date(),
    }
    setSessions(prev => [...prev, newSession])
  }

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId))
  }

  const toggleSessionStatus = (sessionId: string) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { 
            ...session, 
            status: session.status === 'active' ? 'paused' : 'active' 
          }
        : session
    ))
  }

  const renderContent = () => {
    switch (activeTab) {
      case "sessions":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Sessions</h2>
              <p className="text-muted-foreground">
                Create and manage your sessions
              </p>
            </div>
            
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <Card 
                className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={createSession}
              >
                <CardContent className="flex flex-col items-center justify-center h-32 p-6">
                  <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors mt-2">
                    Create Session
                  </p>
                </CardContent>
              </Card>

              {sessions.map((session) => (
                <Card key={session.id} className="relative group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm truncate">{session.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                        onClick={() => deleteSession(session.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      {session.createdAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className={`w-2 h-2 rounded-full ${
                            session.status === 'active' ? 'bg-green-500' : 
                            session.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="text-xs capitalize text-muted-foreground">
                          {session.status}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleSessionStatus(session.id)}
                      >
                        {session.status === 'active' ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sessions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No sessions created yet. Click the "+" button to create your first session.
                </p>
              </div>
            )}
          </div>
        )
      
      case "stats":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
              <p className="text-muted-foreground">Analytics and performance metrics</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>System performance overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    Charts and graphs will be rendered here
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      
      case "settings":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
              <p className="text-muted-foreground">Configure your dashboard preferences</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic configuration options</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  Settings form components will be added here
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Select a tab to view content</p>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      {renderContent()}
    </div>
  )
}
```

### 4. Update Dashboard Page

Replace the content of `apps/web/app/dashboard/page.tsx`:

```typescript
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  SidebarProvider, 
  SidebarTrigger,
  SidebarInset 
} from "@workspace/ui/components/sidebar"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardContent } from "@/components/dashboard-content"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("sessions")

  useEffect(() => {
    if (status === "loading") return
    
    if (!session?.user) {
      console.log("No session found, redirecting to auth")
      router.push("/auth")
    }
  }, [session, status, router])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Dashboard</h1>
            </div>
          </header>
          <DashboardContent activeTab={activeTab} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
```

### 5. Fix Module Resolution Issues

The sidebar component may have import issues. Update `packages/ui/src/components/sidebar.tsx` to inline the mobile hook:

```typescript
// Add this at the top of the file after other imports
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

## Testing the Implementation

### 1. Start Development Server

```bash
cd /path/to/tidbHackathon
pnpm dev --filter=web
```

### 2. Navigate to Dashboard

1. Open browser to `http://localhost:3000`
2. Navigate to `/dashboard` 
3. Ensure you're authenticated (redirect to `/auth` if not)

### 3. Test Features

#### Sidebar Navigation
- Click on "Sessions", "Stats", "Settings" tabs
- Verify active state highlighting
- Test sidebar collapse/expand functionality

#### Sessions Tab
- Click the "+" button to create sessions
- Verify session blocks appear in grid
- Test play/pause toggle buttons
- Test delete functionality (hover to see delete button)
- Verify responsive grid layout on different screen sizes

#### Responsive Design  
- Test on mobile, tablet, and desktop sizes
- Verify sidebar collapses appropriately
- Check grid column adjustments

## Troubleshooting

### Common Issues

1. **Module not found errors**
   ```
   Solution: Ensure all dependencies are installed in correct workspaces
   ```

2. **Sidebar component import issues**
   ```
   Solution: Use inline hooks or relative imports with .js extensions
   ```

3. **Authentication redirect loops**
   ```
   Solution: Wrap router.push in useEffect, not in render
   ```

4. **Styling not applied**
   ```
   Solution: Verify shadcn/ui components are properly installed and Tailwind CSS is configured
   ```

### Verification Commands

```bash
# Check if components are installed
ls packages/ui/src/components/

# Check dependencies
cat packages/ui/package.json | grep radix

# Test build
pnpm build

# Run type checking  
cd apps/web && pnpm typecheck
```

## Next Steps

After successful setup, you can:

1. **Extend Stats Tab**: Add charts and analytics
2. **Enhance Settings Tab**: Add configuration forms  
3. **Persist Sessions**: Connect to database or local storage
4. **Add Real-time Features**: WebSocket integration
5. **Improve Accessibility**: Keyboard navigation and screen reader support

The dashboard is now ready for development and customization!
