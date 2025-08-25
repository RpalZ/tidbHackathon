/**
 * NextAuth.js Configuration
 * 
 * This file configures NextAuth.js for authentication in our AI Tutor application.
 * We're using NextAuth.js v5 (Auth.js) with the App Router.
 * 
 * Features implemented:
 * - Google OAuth authentication
 * - Custom pages for sign-in
 * - Session management
 * 
 * @see https://authjs.dev/getting-started
 */

import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"

/**
 * NextAuth configuration with Google OAuth provider
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  /**
   * In production, make sure NEXTAUTH_URL is set correctly
   */
  
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }) as any, // Type workaround for NextAuth v5 compatibility
    GitHub
  ],
  pages: {
    signIn: "/auth/signin",
  },
    session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
   callbacks: {
    /**
     * JWT callback - runs when JWT is created/updated
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }
      return token
    },
  },
  /**
   * Enable debug mode in development to see detailed error logs
   */
  // debug: process.env.NODE_ENV === "development",
}) as any
