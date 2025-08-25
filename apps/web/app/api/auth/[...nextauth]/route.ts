/**
 * NextAuth.js API Route Handler
 * 
 * This file handles all authentication routes for our app.
 * It provides the API endpoints:
 * - GET/POST /api/auth/signin - Sign in page and handling
 * - GET/POST /api/auth/signout - Sign out handling  
 * - GET/POST /api/auth/callback/[provider] - OAuth callback handling
 * - GET /api/auth/session - Get current session
 * - GET /api/auth/providers - Get configured providers
 * - GET /api/auth/csrf - Get CSRF token
 * 
 * @see https://authjs.dev/reference/nextjs
 */

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
