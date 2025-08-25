/**
 * Authentication Page
 * 
 * This page provides a modern, responsive authentication interface using shadcn/ui components.
 * Features:
 * - Google OAuth sign-in
 * - Modern card-based design
 * - Mobile responsive
 * - Loading states and error handling
 * - Redirect after successful authentication
 * 
 * @see https://authjs.dev/getting-started/authentication/oauth
 */

"use client"

import { signIn, useSession, getSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { GraduationCap, Chrome, Loader2, AlertCircle, ArrowLeft, Github } from "lucide-react"

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  /**
   * Check if user is already authenticated
   * If so, redirect them to the intended page
   */
  useEffect(() => {
    const checkAuth = async () => {
      const session = await getSession()
      if (session) {
        router.push(callbackUrl)
      
      }
      console.log(session)
    }
    checkAuth()
  }, [router, callbackUrl])

  /**
   * Handle Google OAuth sign-in
   * 
   * This function initiates the Google OAuth flow using NextAuth.js
   * It includes loading states and error handling for better UX
   */
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      /**
       * Initiate sign-in with Google provider
       * 
       * Parameters:
       * - "google": Provider ID
       * - callbackUrl: Where to redirect after successful auth
       * - redirect: false to handle the result manually
       */
      await signIn("google")

      /**
       * Handle sign-in result
       * 
       * If successful, NextAuth will redirect automatically
       * If there's an error, we display it to the user
       */
     
    } catch (err) {
      console.error("Sign-in error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }
  const handleGithubSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      /**
       * Initiate sign-in with Google provider
       * 
       * Parameters:
       * - "google": Provider ID
       * - callbackUrl: Where to redirect after successful auth
       * - redirect: false to handle the result manually
       */
      const result = await signIn("github")

      /**
       * Handle sign-in result
       * 
       * If successful, NextAuth will redirect automatically
       * If there's an error, we display it to the user
       */
      // if (result) {
      //   setError("Failed to sign in. Please try again.")
      // } else if (result?.ok) {
      //   // Success! Redirect will happen automatically
      //   router.push(callbackUrl)
      // }
    } catch (err) {
      console.error("Sign-in error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Back to Home Button */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Main Auth Card */}
        <Card className="border-2 bg-gradient-to-br from-background/80 to-muted/40 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center space-y-6">
            {/* Logo and Branding */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
              <GraduationCap className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Welcome to AI Tutor
              </CardTitle>
              <CardDescription className="text-base">
                Sign in to access personalized test analysis and AI-powered learning recommendations
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Google Sign-In Button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              size="lg"
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5" />
                  Continue with Google
                </>
              )}
            </Button>
            {/* GitHub Sign-In Button */}
            <Button
              onClick={handleGithubSignIn}
              disabled={isLoading}
              size="lg"
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Github className="mr-2 h-5 w-5" />
                  Continue with GitHub
                </>
              )}
            </Button>


            {/* Features Preview */}
            <div className="pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                What you'll get access to:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>AI-powered test analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>Personalized learning recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span>Progress tracking and analytics</span>
                </div>
              </div>
            </div>

            {/* Terms and Privacy */}
            <p className="text-xs text-muted-foreground text-center">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Additional Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Need help?{" "}
            <Link href="/contact" className="underline hover:text-foreground">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
