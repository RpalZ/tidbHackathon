"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import Link from "next/link"
import React from "react"
import { FileText, Zap, Shield, Users, Upload, Download, Clock } from "lucide-react"

export default function Page() {
  const [data, setData] = React.useState<string | null>(null)

  const handleClick = async () => {  
    console.log("Button clicked, fetching OCR data...")
    // TODO: Add axios import when API is ready
    // const response = await axios.get("/api/ocr")
    // setData(response.data.result)
    // console.log(response.data)
    
    // Mock data for demo purposes
    setData("Sample OCR result: This is extracted text from your document.")
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="flex items-center justify-center min-h-screen px-4">
        <div className="container flex flex-col items-center gap-6 text-center max-w-4xl">
          <h1 className="text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Transform Documents with AI-Powered OCR
          </h1>
          <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
            Experience powerful document processing with our advanced OCR technology. 
            Transform images and PDFs into searchable, editable text with ease.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button size="lg" asChild className="h-12 px-8">
              <Link href="/auth">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="h-12 px-8">
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/50">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl mb-4">
              Powerful Features
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to process documents efficiently and accurately
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">Advanced OCR</CardTitle>
                <CardDescription className="text-center">
                  Extract text from images and PDFs with 99%+ accuracy using state-of-the-art AI models.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">Lightning Fast</CardTitle>
                <CardDescription className="text-center">
                  Process documents in seconds, not minutes. Our optimized pipeline handles large batches efficiently.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">Secure & Private</CardTitle>
                <CardDescription className="text-center">
                  Your documents are encrypted and processed securely. We never store your sensitive data.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">24/7 Processing</CardTitle>
                <CardDescription className="text-center">
                  Our cloud infrastructure ensures your documents are processed anytime, anywhere.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">Multiple Formats</CardTitle>
                <CardDescription className="text-center">
                  Support for PNG, JPG, PDF, TIFF, and more. Batch process hundreds of files at once.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-2 w-full max-w-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-center">Export Options</CardTitle>
                <CardDescription className="text-center">
                  Export to TXT, DOCX, JSON, or CSV. Integrate seamlessly with your existing workflow.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto">
          <Card className="border-2 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-2">Try It Now</CardTitle>
              <CardDescription className="text-lg">
                Upload a document and see our OCR technology in action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Drag and drop your document here, or click to browse
                </p>
                <Button variant="outline">Choose File</Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleClick}
                  className="flex-1"
                  size="lg"
                >
                  Process Document
                </Button>
                <Button variant="outline" size="lg">
                  View Sample Output
                </Button>
              </div>

              {data && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Extracted Text:</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-60">
                      {data}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container max-w-4xl mx-auto">
          <Card className="text-center border-2">
            <CardHeader>
              <CardTitle className="text-3xl mb-4">
                Ready to Transform Your Documents?
              </CardTitle>
              <CardDescription className="text-lg">
                Join thousands of users who trust our OCR technology for their document processing needs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">99.5%</div>
                  <div className="text-muted-foreground">Accuracy Rate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">10M+</div>
                  <div className="text-muted-foreground">Documents Processed</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">50K+</div>
                  <div className="text-muted-foreground">Happy Users</div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild className="h-12 px-8">
                  <Link href="/auth">Start Free Trial</Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="h-12 px-8">
                  <Link href="#features">Contact Sales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
