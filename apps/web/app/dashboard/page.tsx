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
    if (status === "loading") return // Still loading
    
    if (!session?.user) {
      console.log("No session found, redirecting to auth")
      router.push("/auth")
    }
  }, [session, status, router])

  // Show loading state while checking session
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Show nothing while redirecting
  if (!session?.user) {
    return null
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} marginTop="16" />
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