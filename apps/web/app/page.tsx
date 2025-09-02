"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import Link from "next/link"
import React from "react"
import { useSession } from "next-auth/react"
import { FileText, Zap, Shield, Users, Upload, Download, Clock, Image, BookOpen, Brain, CheckCircle, AlertCircle, Search, GraduationCap } from "lucide-react"

export default function Page() {
  const [data, setData] = React.useState<string | null>(null)
  const { data: session } = useSession()

  const handleClick = async () => {  
    console.log("Button clicked, analyzing test paper...")
    // TODO: Add API integration for test analysis
    // const response = await axios.post("/api/analyze-test", formData)
    // setData(response.data.analysis)
    // console.log(response.data)
    
    // Mock data for demo purposes
    setData(`Test Analysis Complete!

Question 2: Incorrect Answer ❌
Your answer: "Photosynthesis occurs only during the day"
Correct answer: "Photosynthesis occurs during daylight hours, but cellular respiration occurs continuously"

Explanation: You missed the key concept that plants perform both photosynthesis AND cellular respiration. While photosynthesis requires light, cellular respiration happens 24/7 to provide energy for cellular processes.

Improvement tip: Review the relationship between photosynthesis and cellular respiration in plant metabolism.

Score: 7/10 - Great work! Focus on the concepts above to improve.`)
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative flex items-center justify-center min-h-screen px-4">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        
        <div className="container relative z-10 flex flex-col lg:flex-row items-center gap-16 text-center lg:text-left max-w-7xl">
          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                  AI-Powered Test Analysis
                </span>
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  & Tutoring
                </span>
              </h1>
              <p className="mx-auto max-w-[42rem] leading-relaxed text-muted-foreground sm:text-xl sm:leading-8 lg:mx-0">
                Upload your test papers from any exam board and get instant AI feedback. 
                Learn from your mistakes with personalized explanations and improve your grades.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Edexcel
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                CIE
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                AQA
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" asChild className="h-12 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
                <Link href={session ? "/dashboard" : "/auth"}>Start Learning</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-12 px-8 rounded-lg border-2 hover:bg-muted/50 transition-all duration-300">
                <Link href="#features">See How It Works</Link>
              </Button>
            </div>
          </div>
          
          {/* Hero Visual */}
          <div className="flex-1 w-full max-w-lg">
            <div className="relative">
              {/* Main Card */}
              <Card className="relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Smart Analysis</CardTitle>
                        <CardDescription>AI Tutor Ready</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-400 opacity-75" />
                      <div className="h-3 w-3 rounded-full bg-yellow-400 opacity-75" />
                      <div className="h-3 w-3 rounded-full bg-green-400 opacity-75" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4">
                  {/* Mock Test Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Question 1</span>
                      </div>
                      <span className="text-sm text-green-600">Correct</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Question 2</span>
                      </div>
                      <span className="text-sm text-red-600">Review</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Question 3</span>
                      </div>
                      <span className="text-sm text-green-600">Correct</span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-muted p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Brain className="h-4 w-4 text-primary" />
                      Overall Score: 85%
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 h-8 w-8 rounded-full bg-green-500 opacity-20 animate-pulse" />
              <div className="absolute -bottom-4 -left-4 h-6 w-6 rounded-full bg-purple-500 opacity-30 animate-pulse delay-700" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
        
        <div className="container relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
              <Brain className="h-4 w-4" />
              AI-Powered Features
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Your AI-Powered Study Companion
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground sm:text-lg">
              From instant test analysis to personalized tutoring, discover how our AI transforms your learning experience
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Search className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">Smart Test Analysis</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Upload test papers and get instant AI-powered analysis with detailed feedback on every question.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Automatic question detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Mark scheme comparison</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Performance insights</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Brain className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">AI Explanations</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Get personalized explanations for every mistake with step-by-step solutions and learning tips.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Detailed solution breakdown</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Common mistake patterns</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Study recommendations</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">Multi-Exam Board Support</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Works with all major exam boards including Edexcel, CIE, AQA, OCR, and WJEC mark schemes.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Edexcel & CIE certified</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>AQA & OCR compatible</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>WJEC mark schemes</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">Personalized Tutoring</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    AI tutor adapts to your learning style and provides targeted practice questions and study plans.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Adaptive learning paths</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Custom practice tests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Progress tracking</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">Progress Tracking</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Monitor your improvement over time with detailed analytics and performance insights.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Performance analytics</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Grade predictions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Weekly reports</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">Mistake Analysis</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    Identify patterns in your errors and get targeted recommendations to avoid similar mistakes.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Error pattern detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Targeted remediation</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Learning strategies</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 bg-muted/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our AI tutor analyzes your test papers and provides personalized feedback in just three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <Card className="text-center border-2 relative overflow-hidden">
              <div className="absolute top-4 right-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <CardHeader className="pb-4">
                <div className="aspect-square max-w-48 mx-auto bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border-2 border-dashed border-blue-500/30 flex items-center justify-center mb-6">
                  <div className="text-center space-y-2">
                    <Upload className="h-12 w-12 text-blue-500 mx-auto" />
                    <div className="text-xs text-blue-600 font-medium">UPLOAD</div>
                  </div>
                </div>
                <CardTitle className="text-xl">Upload Test Paper</CardTitle>
                <CardDescription>
                  Upload your completed test paper or exam script to our secure AI platform
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 2 */}
            <Card className="text-center border-2 relative overflow-hidden">
              <div className="absolute top-4 right-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <CardHeader className="pb-4">
                <div className="aspect-square max-w-48 mx-auto bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border-2 border-dashed border-green-500/30 flex items-center justify-center mb-6">
                  <div className="text-center space-y-2">
                    <Brain className="h-12 w-12 text-green-500 mx-auto animate-pulse" />
                    <div className="text-xs text-green-600 font-medium">ANALYZE</div>
                  </div>
                </div>
                <CardTitle className="text-xl">AI Analysis</CardTitle>
                <CardDescription>
                  Our AI tutor analyzes your answers against mark schemes and identifies areas for improvement
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Step 3 */}
            <Card className="text-center border-2 relative overflow-hidden">
              <div className="absolute top-4 right-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <CardHeader className="pb-4">
                <div className="aspect-square max-w-48 mx-auto bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border-2 border-dashed border-purple-500/30 flex items-center justify-center mb-6">
                  <div className="text-center space-y-2">
                    <GraduationCap className="h-12 w-12 text-purple-500 mx-auto" />
                    <div className="text-xs text-purple-600 font-medium">LEARN</div>
                  </div>
                </div>
                <CardTitle className="text-xl">Get Feedback</CardTitle>
                <CardDescription>
                  Receive personalized explanations, corrections, and study recommendations to improve your performance
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        
        <div className="container relative z-10 max-w-5xl mx-auto">
          <Card className="relative overflow-hidden border-2 bg-gradient-to-br from-background/80 to-muted/40 shadow-2xl backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            
            <CardHeader className="relative z-10 text-center pb-8 pt-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg">
                <GraduationCap className="h-8 w-8 dark:text-black" />
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl mb-4">
                Ready to Boost Your Grades?
              </CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-lg leading-relaxed">
                Join thousands of students who are already improving their academic performance with our AI tutor.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative z-10 pb-12">
              <div className="space-y-12">
                {/* Stats */}
                <div className="grid gap-8 md:grid-cols-3">
                  <div className="text-center">
                    <div className="mb-2 text-4xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                      95%
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Grade Improvement</div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                      500K+
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Tests Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">
                      25K+
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Students Helped</div>
                  </div>
                </div>

                {/* Testimonial */}
                <div className="mx-auto max-w-2xl rounded-2xl border bg-background/50 p-6 text-center backdrop-blur-sm">
                  <div className="mb-4 flex justify-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-5 w-5 rounded-full bg-yellow-400" />
                    ))}
                  </div>
                  <blockquote className="text-muted-foreground italic mb-4">
                    "This AI tutor helped me improve my Physics grade from a C to an A* in just 3 months. The personalized feedback was exactly what I needed!"
                  </blockquote>
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                    <div className="text-left">
                      <div className="font-semibold">Sarah Chen</div>
                      <div className="text-sm text-muted-foreground">A-Level Student</div>
                    </div>
                  </div>
                </div>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild className="h-14 px-8 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300">
                    <Link href="/auth">Start Learning Free</Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild className="h-14 px-8 rounded-xl text-base border-2 hover:bg-muted/50 transition-all duration-300">
                    <Link href="#features">See Demo</Link>
                  </Button>
                </div>

                {/* Trust indicators */}
                <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Free to start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
