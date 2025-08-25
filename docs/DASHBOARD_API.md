# Component API Documentation

## DashboardPage

**File**: `apps/web/app/dashboard/page.tsx`

### Description
Main dashboard container component that handles authentication, layout, and tab state management.

### Dependencies
```typescript
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
```

### State
- `activeTab: string` - Currently selected tab ("sessions" | "stats" | "settings")

### Authentication Flow
1. Checks session status using `useSession()`
2. Shows loading state while authentication is being verified
3. Redirects to `/auth` if no valid session
4. Renders dashboard if authenticated

### Layout Structure
```jsx
<SidebarProvider defaultOpen={true}>
  <div className="flex h-screen w-full">
    <DashboardSidebar />
    <SidebarInset>
      <header>{/* Sidebar trigger and title */}</header>
      <DashboardContent />
    </SidebarInset>
  </div>
</SidebarProvider>
```

---

## DashboardSidebar

**File**: `apps/web/components/dashboard-sidebar.tsx`

### Description
Collapsible sidebar navigation component with tab switching functionality.

### Props
```typescript
interface DashboardSidebarProps {
  activeTab: string           // Currently active tab
  onTabChange: (tabId: string) => void  // Tab change callback
}
```

### Menu Items
```typescript
const menuItems = [
  { title: "Sessions", icon: Users, id: "sessions" },
  { title: "Stats", icon: BarChart3, id: "stats" },
  { title: "Settings", icon: Settings, id: "settings" }
]
```

### Features
- **Visual Active State**: Highlights current tab with `isActive` prop
- **Icon Integration**: Uses Lucide React icons
- **Click Handlers**: Calls `onTabChange` when menu items are clicked
- **Responsive**: Collapses to icon-only mode on mobile
- **Top Spacing**: Includes `mt-4` margin for visual separation

### Usage
```jsx
<DashboardSidebar 
  activeTab="sessions" 
  onTabChange={(tabId) => setActiveTab(tabId)} 
/>
```

---

## DashboardContent

**File**: `apps/web/components/dashboard-content.tsx`

### Description
Main content area that renders different views based on the active tab.

### Props
```typescript
interface DashboardContentProps {
  activeTab: string  // Determines which content to render
}
```

### Session Interface
```typescript
interface Session {
  id: string                    // Unique identifier
  name: string                  // Display name
  status: 'active' | 'paused' | 'stopped'  // Current status
  createdAt: Date              // Creation timestamp
  duration?: string            // Optional duration display
}
```

### State Management
```typescript
const [sessions, setSessions] = useState<Session[]>([])
```

### Methods

#### `createSession()`
Creates a new session and adds it to the state.
```typescript
const createSession = () => {
  const newSession: Session = {
    id: `session-${Date.now()}`,
    name: `Session ${sessions.length + 1}`,
    status: 'stopped',
    createdAt: new Date(),
  }
  setSessions(prev => [...prev, newSession])
}
```

#### `deleteSession(sessionId: string)`
Removes a session from the state.
```typescript
const deleteSession = (sessionId: string) => {
  setSessions(prev => prev.filter(session => session.id !== sessionId))
}
```

#### `toggleSessionStatus(sessionId: string)`
Toggles session status between active and paused.
```typescript
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
```

### Content Rendering

#### Sessions Tab
- **Grid Layout**: Responsive grid with 2-5 columns
- **Create Block**: Dashed border card with plus icon
- **Session Cards**: Individual session management blocks
- **Empty State**: Message when no sessions exist

#### Stats Tab
- **Placeholder Structure**: Ready for charts and analytics
- **Card Layout**: Consistent with overall design

#### Settings Tab  
- **Configuration Areas**: General, notifications, privacy sections
- **Form Ready**: Structure prepared for settings forms

### Grid Classes
```css
grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
```

### Status Indicators
- **Active**: `bg-green-500` (Green dot)
- **Paused**: `bg-yellow-500` (Yellow dot)  
- **Stopped**: `bg-gray-400` (Gray dot)

### Usage
```jsx
<DashboardContent activeTab="sessions" />
```

---

## Session Block Component Structure

### Create Session Block
```jsx
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
```

### Session Block
```jsx
<Card key={session.id} className="relative group">
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm truncate">{session.name}</CardTitle>
      <Button /* Delete button with trash icon */ />
    </div>
    <CardDescription className="text-xs">
      {session.createdAt.toLocaleDateString()}
    </CardDescription>
  </CardHeader>
  <CardContent className="pt-0">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className={`status-indicator ${statusColor}`} />
        <span className="text-xs capitalize text-muted-foreground">
          {session.status}
        </span>
      </div>
      <Button /* Play/Pause toggle */ />
    </div>
  </CardContent>
</Card>
```

---

## Styling Classes Reference

### Layout Classes
- `flex h-screen w-full` - Full screen flex layout
- `grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` - Responsive grid
- `space-y-6` - Vertical spacing between sections

### Interactive Classes
- `hover:border-primary/50 transition-colors cursor-pointer group` - Hover effects
- `opacity-0 group-hover:opacity-100 transition-opacity` - Show on hover
- `group-hover:text-primary transition-colors` - Color transitions

### Status Classes
- `bg-green-500` - Active session indicator
- `bg-yellow-500` - Paused session indicator  
- `bg-gray-400` - Stopped session indicator

### Theme Classes
- `text-muted-foreground` - Secondary text color
- `border-primary` - Primary border color
- `bg-background` - Background color
- `text-primary` - Primary text color

---

## Event Handlers

### Tab Navigation
```typescript
const handleTabChange = (tabId: string) => {
  setActiveTab(tabId)
}
```

### Session Management
```typescript
// Create new session
const handleCreateSession = () => {
  createSession()
}

// Delete session
const handleDeleteSession = (sessionId: string) => {
  if (confirm('Are you sure you want to delete this session?')) {
    deleteSession(sessionId)
  }
}

// Toggle session status
const handleToggleStatus = (sessionId: string) => {
  toggleSessionStatus(sessionId)
}
```

### Authentication
```typescript
useEffect(() => {
  if (status === "loading") return
  
  if (!session?.user) {
    console.log("No session found, redirecting to auth")
    router.push("/auth")
  }
}, [session, status, router])
```
