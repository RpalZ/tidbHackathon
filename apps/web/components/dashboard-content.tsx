"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Plus, Play, Pause, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface Session {
  id: string
  name: string
  status: 'active' | 'paused' | 'stopped'
  createdAt: Date
  duration?: string
  fileCount?: number
}

interface DashboardContentProps {
  activeTab: string
}

export function DashboardContent({ activeTab }: DashboardContentProps) {
  // State for managing sessions
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load sessions from database
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt)
        })))
      } else {
        setError('Failed to load sessions')
      }
    } catch (err) {
      setError('Failed to load sessions')
      console.error('Error loading sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create a new session
  const createSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Session ${sessions.length + 1}`
        })
      })

      if (response.ok) {
        const newSession = await response.json()
        setSessions(prev => [...prev, {
          ...newSession,
          createdAt: new Date(newSession.createdAt)
        }])
      } else {
        setError('Failed to create session')
      }
    } catch (err) {
      setError('Failed to create session')
      console.error('Error creating session:', err)
    }
  }

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?id=${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSessions(prev => prev.filter(session => session.id !== sessionId))
      } else {
        setError('Failed to delete session')
      }
    } catch (err) {
      setError('Failed to delete session')
      console.error('Error deleting session:', err)
    }
  }

  // Toggle session status (for now just local state, could add API call)
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
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4">
                  {error}
                </div>
              )}
            </div>
            
            {/* Loading State */}
            {loading ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="h-32 animate-pulse">
                    <CardContent className="h-full bg-gray-200 rounded" />
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Sessions Grid */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {/* Create New Session Block */}
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

                  {/* Session Blocks */}
                  {sessions.map((session) => (
                    <div key={session.id} className="relative group">
                      <Link href={`/session/${session.id}`} className="block">
                        <Card className="h-45 flex flex-col cursor-pointer hover:shadow-md transition-shadow">
                          <CardHeader className="pb-2 flex-shrink-0">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm truncate">{session.name}</CardTitle>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 z-10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <CardDescription className="text-xs">
                              {session.createdAt.toLocaleDateString()}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 flex-1 flex flex-col justify-between">
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
                                className="h-6 w-6 p-0 z-10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleSessionStatus(session.id);
                                }}
                              >
                                {session.status === 'active' ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            {session.duration && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Duration: {session.duration}
                              </p>
                            )}
                            {session.fileCount !== undefined && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Files: {session.fileCount}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Empty state message when no sessions */}
                {sessions.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No sessions created yet. Click the "+" button to create your first session.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )
      
      case "stats":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Statistics</h2>
              <p className="text-muted-foreground">
                Analytics and performance metrics
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Metrics</CardTitle>
                  <CardDescription>System performance overview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    Charts and graphs will be rendered here
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usage Analytics</CardTitle>
                  <CardDescription>User interaction patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    Analytics components will be added here
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Detailed Reports</CardTitle>
                <CardDescription>
                  Comprehensive statistical analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  Report components will be integrated here
                </div>
              </CardContent>
            </Card>
          </div>
        )
      
      case "settings":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
              <p className="text-muted-foreground">
                Configure your dashboard preferences
              </p>
            </div>
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">General Settings</CardTitle>
                  <CardDescription>Basic configuration options</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Settings form components will be added here
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                  <CardDescription>Manage your notification settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Notification settings will be implemented here
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data & Privacy</CardTitle>
                  <CardDescription>Control your data and privacy settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    Privacy controls will be added here
                  </div>
                </CardContent>
              </Card>
            </div>
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
