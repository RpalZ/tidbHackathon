"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { ThemeToggle } from "./theme-toggle"
import { GraduationCap, Menu, BookOpen, HelpCircle, User, Settings, LogOut } from "lucide-react"
import { Session } from "inspector/promises"

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // const [session, setSession] = useState<any | null>(null)
  // const [status, setStatus] = useState<any | null>(null)
  const {data: session, status} = useSession();
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }


  // const getSesh = async () => {
  //     const sessionD = await getSession() as any
  //     console.log("Session:", sessionD)
  //     // console.log("Status:", status)
  //     setSession(session)
  //     setStatus(status)
  // }

  //   getSesh();
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { href: "/#features", label: "Features", icon: BookOpen },
    { href: "/#how-it-works", label: "How It Works", icon: HelpCircle },
  ]

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const userMenuItems = [
    { href: "/dashboard", label: "Dashboard", icon: BookOpen },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-background/80 backdrop-blur-md border-b shadow-sm" 
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity"
            aria-label="AI Tutor Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="hidden sm:inline-block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              AI Tutor
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            
            <div className="flex items-center gap-3">
              <ThemeToggle />
              
              {status === "loading" ? (
                <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
              ) : session ? (
                // Authenticated User
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                        <AvatarFallback>
                          {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {session.user?.name && (
                          <p className="font-medium">{session.user.name}</p>
                        )}
                        {session.user?.email && (
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {session.user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {userMenuItems.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href} className="flex items-center">
                          <item.icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                // Guest User
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full border-2 hover:bg-primary hover:text-primary-foreground transition-all duration-200" 
                    asChild
                  >
                    <Link href="/auth">Sign in</Link>
                  </Button>
                  
                  <Button 
                    size="sm" 
                    className="rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200" 
                    asChild
                  >
                    <Link href="/auth">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col gap-6 pt-6">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 font-bold text-xl text-left">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      AI Tutor
                    </SheetTitle>
                  </SheetHeader>

                  {/* User Info in Mobile */}
                  {session && (
                    <div className="flex items-center space-x-3 rounded-lg bg-muted/50 p-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                        <AvatarFallback>
                          {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.user?.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mobile Navigation Links */}
                  <div className="flex flex-col gap-4">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 text-lg font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    ))}

                    {/* Authenticated User Menu Items */}
                    {session && (
                      <>
                        <div className="border-t pt-4">
                          {userMenuItems.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="flex items-center gap-3 text-lg font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <item.icon className="h-5 w-5" />
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Mobile Auth Buttons */}
                  <div className="flex flex-col gap-3 pt-4 border-t mt-auto">
                    {session ? (
                      <Button 
                        variant="outline"
                        className="w-full rounded-full"
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          handleSignOut()
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          className="w-full rounded-full border-2" 
                          asChild
                        >
                          <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                            Sign in
                          </Link>
                        </Button>
                        
                        <Button 
                          className="w-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md" 
                          asChild
                        >
                          <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                            Get Started
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
