# NextAuth.js Google OAuth Setup Guide

## Overview
This guide walks you through setting up Google OAuth authentication using NextAuth.js v5 for the AI Tutor application.

## What's Implemented

### 1. Authentication Configuration (`lib/auth.ts`)
- NextAuth.js v5 (Auth.js) configuration
- Google OAuth provider setup
- JWT strategy for serverless compatibility
- Custom sign-in page configuration
- Session and callback configurations

### 2. Authentication Pages (`app/auth/page.tsx`)
- Modern, responsive sign-in page using shadcn/ui components
- Google OAuth integration with loading states
- Error handling and user feedback
- Mobile-responsive design with professional styling
- Redirect handling for protected routes

### 3. Navigation Integration (`components/navbar.tsx`)
- Dynamic authentication state display
- User avatar and dropdown menu when signed in
- Sign in/out functionality
- Mobile-responsive authentication UI
- User profile information display

### 4. Session Management (`components/providers.tsx`)
- SessionProvider wrapper for the entire app
- Theme provider integration
- Client-side session management

## Setup Instructions

### Step 1: Google Cloud Console Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project**
3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - For production, add your domain: `https://yourdomain.com/api/auth/callback/google`

### Step 2: Environment Variables

1. **Copy the environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your Google OAuth credentials in `.env.local`**:
   ```env
   # Generate a secret key (32+ characters)
   AUTH_SECRET=your-super-secret-key-minimum-32-characters
   
   # From Google Cloud Console
   AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
   AUTH_GOOGLE_SECRET=your-google-client-secret
   
   # Your app URL
   NEXTAUTH_URL=http://localhost:3000
   
   # Trust host for CSRF protection (NextAuth v5)
   AUTH_TRUST_HOST=true
   ```

3. **Generate AUTH_SECRET**:
   ```bash
   # Option 1: Using OpenSSL
   openssl rand -base64 32
   
   # Option 2: Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Option 3: Online generator
   # Visit: https://generate-secret.vercel.app/32
   ```

### Step 3: Testing the Implementation

1. **Start the development server**:
   ```bash
   pnpm dev --filter=web
   ```

2. **Navigate to**: http://localhost:3000

3. **Test authentication flow**:
   - Click "Sign In" or "Get Started" in the navbar
   - You should be redirected to `/auth`
   - Click "Continue with Google"
   - Complete Google OAuth flow
   - You should be redirected back and see your user avatar in the navbar

### Step 4: Verify Integration

**Check these features work correctly**:
- [ ] Sign-in redirects to Google OAuth
- [ ] Successful authentication shows user avatar in navbar
- [ ] Dropdown menu displays user info and navigation
- [ ] Sign-out works and returns to guest state
- [ ] Mobile responsive design works
- [ ] Theme toggle continues to work
- [ ] Protected route redirects work (when you add them)

## Available Routes and Components

### Authentication Routes
- `/auth` - Sign-in page with Google OAuth
- `/api/auth/*` - NextAuth.js API routes (handled automatically)

### Key Components
- `Navbar` - Integrated authentication UI
- `SessionProvider` - Session management wrapper
- `ThemeToggle` - Theme switching (unchanged)

## Future Implementation Steps

### 1. Protected Routes
Create protected pages like dashboard:

```tsx
// app/dashboard/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Dashboard() {
  const session = await auth()
  
  if (!session) {
    redirect("/auth?callbackUrl=/dashboard")
  }

  return (
    <div>
      <h1>Welcome, {session.user?.name}!</h1>
      {/* Dashboard content */}
    </div>
  )
}
```

### 2. Middleware for Route Protection
Create `middleware.ts` in the root:

```tsx
export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### 3. Database Integration
Add user data persistence:
- Set up database (PostgreSQL, MySQL, etc.)
- Add database adapter to NextAuth config
- Store user profiles and preferences

### 4. Additional Providers
Add more authentication options:
- GitHub OAuth
- Discord OAuth
- Email/Password authentication

## Troubleshooting

### Common Issues

1. **"MissingCSRF: CSRF token was missing" Error**:
   - Ensure `trustHost: true` is set in your auth.config
   - Add `AUTH_TRUST_HOST=true` to your `.env.local` file
   - Verify `AUTH_SECRET` is set and at least 32 characters long
   - Check that `NEXTAUTH_URL` matches your development URL exactly
   - Restart your development server after environment changes

2. **"Configuration Error" on sign-in**:
   - Check your Google OAuth credentials
   - Verify redirect URI matches exactly
   - Ensure Google+ API is enabled

3. **Environment variables not loading**:
   - File must be named `.env.local` (not `.env.example`)
   - Restart development server after changes
   - Check for syntax errors in env file

4. **Type errors with NextAuth**:
   - We've added type workarounds for NextAuth v5 beta
   - These will be resolved in stable releases

5. **Session not persisting**:
   - Check AUTH_SECRET is set correctly
   - Verify SessionProvider wraps your app
   - Check browser console for errors

### Getting Help

- NextAuth.js Documentation: https://next-auth.js.org/
- Google OAuth Setup: https://developers.google.com/identity/protocols/oauth2
- shadcn/ui Components: https://ui.shadcn.com/

## Security Notes

- Never commit `.env.local` to version control
- Use strong, unique AUTH_SECRET in production
- Regularly rotate your Google OAuth credentials
- Enable 2FA on your Google Cloud Console account
- Review OAuth scopes and permissions regularly

The authentication system is now fully implemented and ready for use! 🎉
