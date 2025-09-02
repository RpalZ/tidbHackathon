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
  SidebarRail
} from "@workspace/ui/components/sidebar"

// Menu items for dashboard navigation
const menuItems = [
  {
    title: "Sessions",
    icon: Users,
    id: "sessions",
  },
  {
    title: "Stats",
    icon: BarChart3,
    id: "stats",
  },
  {
    title: "Settings",
    icon: Settings,
    id: "settings",
  },
]

interface DashboardSidebarProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  marginTop?: string
}

export function DashboardSidebar({ activeTab, onTabChange, marginTop }: DashboardSidebarProps) {
  return (
    <Sidebar className="mt-16">
      <SidebarContent>
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
      <SidebarRail  />
    </Sidebar>
  )
}
