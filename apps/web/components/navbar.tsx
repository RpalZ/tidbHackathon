"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { ThemeToggle } from "./theme-toggle"

export function Navbar() {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-screen-xl bg-black dark:bg-white dark:text-black text-white z-50 rounded-full border border-black-800 shadow-lg">
      <div className="mx-6 flex h-14 items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          Logo
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {/* Guest View */}
          <Button className="bg-white text-black hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 rounded-full px-6" asChild>
            <Link href="/auth">Sign in</Link>
          </Button>

          {/* Authenticated View - Uncomment when auth is implemented
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          */}
        </div>
      </div>
    </nav>
  )
}
