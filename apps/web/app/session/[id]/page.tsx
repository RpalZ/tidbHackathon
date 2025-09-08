"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Brain, 
  CheckCircle, 
  Clock, 
  Activity,
  Download,
  Eye,
  Trash2,
  AlertCircle,
  RefreshCw,
  Target
} from "lucide-react"
import Link from "next/link"

interface ExamPaper {
  id: string
  filename: string
  examBoard: string
  subject: string
  year: number
  status: 'uploaded' | 'processing' | 'parsed' | 'solved' | 'error'
  uploadedAt: Date
  totalQuestions: number
  solvedQuestions: number
  accuracy?: number
  processingTime?: string
  errorMessage?: string
}

interface Question {
  id: string
  questionNumber: string
  text: string
  marks: number
  diagrams?: string[]
  solution?: {
    steps: string[]
    finalAnswer: string
    confidence: number
  }
  status: 'pending' | 'solving' | 'solved' | 'error'
}

interface SessionData {
  id: string
  name: string
  examBoard: 'Edexcel' | 'AQA' | 'Other'
  subject: 'Physics' | 'Mathematics' | 'Chemistry' | 'Biology' | 'Other'
  year: number
  createdAt: Date
  status: 'draft' | 'processing' | 'completed' | 'error'
  papers: ExamPaper[]
  totalQuestions: number
  solvedQuestions: number
  avgAccuracy: number
  totalProcessingTime: string
}

export default function SessionPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const sessionId = params.id as string

  // Session data state
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingPaper, setUploadingPaper] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleUploadPaper(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      handleUploadPaper(files[0])
    }
  }

  // Authentication check
  useEffect(() => {
    if (status === "loading") return
    
    if (!session?.user) {
      router.push("/auth")
    }
  }, [session, status, router])

  // Load session data
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        setLoading(true)
        
        // Mock session data for exam parser
        const mockSessionData: SessionData = {
          id: sessionId,
          name: `${sessionId.split('-').pop()} Exam Session`,
          examBoard: 'Edexcel',
          subject: 'Physics',
          year: 2024,
          createdAt: new Date(Date.now() - Math.random() * 86400000),
          status: 'processing',
          totalQuestions: 45,
          solvedQuestions: 28,
          avgAccuracy: 85.6,
          totalProcessingTime: '2m 34s',
          papers: [
            {
              id: 'paper1',
              filename: 'Edexcel_Physics_Paper_2_2024.pdf',
              examBoard: 'Edexcel',
              subject: 'Physics',
              year: 2024,
              status: 'solved',
              uploadedAt: new Date(Date.now() - 3600000),
              totalQuestions: 25,
              solvedQuestions: 25,
              accuracy: 92.0,
              processingTime: '1m 45s'
            },
            {
              id: 'paper2',
              filename: 'Edexcel_Physics_Paper_1_2024.pdf',
              examBoard: 'Edexcel',
              subject: 'Physics',
              year: 2024,
              status: 'processing',
              uploadedAt: new Date(Date.now() - 1800000),
              totalQuestions: 20,
              solvedQuestions: 3,
              processingTime: '49s'
            }
          ]
        }

        // Mock questions data
        const mockQuestions: Question[] = [
          {
            id: 'q1',
            questionNumber: '1(a)',
            text: 'A ball is thrown vertically upwards with a speed of 12 m/s. Calculate the time taken to reach maximum height.',
            marks: 3,
            solution: {
              steps: [
                'At maximum height, final velocity v = 0',
                'Using kinematic equation: v = u + at',
                '0 = 12 + (-9.8)t',
                't = 12/9.8 = 1.22 s'
              ],
              finalAnswer: '1.22 s',
              confidence: 95
            },
            status: 'solved'
          },
          {
            id: 'q2',
            questionNumber: '1(b)',
            text: 'Calculate the maximum height reached by the ball.',
            marks: 2,
            solution: {
              steps: [
                'Using v² = u² + 2as',
                '0² = 12² + 2(-9.8)s',
                '0 = 144 - 19.6s',
                's = 144/19.6 = 7.35 m'
              ],
              finalAnswer: '7.35 m',
              confidence: 93
            },
            status: 'solved'
          },
          {
            id: 'q3',
            questionNumber: '2(a)',
            text: 'A force of 50 N acts on a mass of 5 kg. Calculate the acceleration produced.',
            marks: 2,
            status: 'solving'
          }
        ]

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800))
        
        setSessionData(mockSessionData)
        setQuestions(mockQuestions)
        if (mockSessionData.papers.length > 0) {
          setSelectedPaper(mockSessionData.papers[0]!)
        }
        setError(null)
      } catch (err) {
        setError('Failed to load session data')
        console.error('Error loading session:', err)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      loadSessionData()
    }
  }, [sessionId])

  // Upload paper handler
  const handleUploadPaper = async (file: File) => {
    setUploadingPaper(true)
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      
      // Send to OCR API
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file: base64,
          filename: file.name
        })
      })
      
      if (!response.ok) {
        throw new Error('OCR request failed')
      }
      
      const result = await response.json()
      console.log('OCR Result:', result)
      
      if (result.success) {
        console.log(`✅ Processed ${result.totalPages} pages`)
        console.log(`📄 Full text length: ${result.result?.length || 0} characters`)
        
        // Log page breakdown
        result.pages?.forEach((page: any, index: number) => {
          console.log(`Page ${index + 1}: ${page.text.substring(0, 100)}...`)
        })
      }
      
      const newPaper: ExamPaper = {
        id: `paper-${Date.now()}`,
        filename: file.name,
        examBoard: 'Edexcel',
        subject: 'Physics',
        year: 2024,
        status: 'processing',
        uploadedAt: new Date(),
        totalQuestions: 0,
        solvedQuestions: 0
      }
      
      if (sessionData) {
        setSessionData(prev => prev ? {
          ...prev,
          papers: [...prev.papers, newPaper]
        } : null)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploadingPaper(false)
    }
  }

  // Process paper (OCR + Parsing)
  const processPaper = async (paperId: string) => {
    if (!sessionData) return
    
    const updatedPapers = sessionData.papers.map(paper => 
      paper.id === paperId ? { ...paper, status: 'processing' as const } : paper
    )
    
    setSessionData({ ...sessionData, papers: updatedPapers })
    
    // Simulate processing
    setTimeout(() => {
      const finalPapers = sessionData.papers.map(paper => 
        paper.id === paperId ? { 
          ...paper, 
          status: 'parsed' as const, 
          totalQuestions: 20,
          processingTime: '1m 23s'
        } : paper
      )
      setSessionData({ ...sessionData, papers: finalPapers })
    }, 3000)
  }

  // Solve questions
  const solveQuestions = async (paperId: string) => {
    if (!sessionData) return
    
    const updatedPapers = sessionData.papers.map(paper => 
      paper.id === paperId ? { ...paper, status: 'processing' as const } : paper
    )
    
    setSessionData({ ...sessionData, papers: updatedPapers })
    
    // Simulate solving
    setTimeout(() => {
      const finalPapers = sessionData.papers.map(paper => 
        paper.id === paperId ? { 
          ...paper, 
          status: 'solved' as const,
          solvedQuestions: paper.totalQuestions,
          accuracy: 88.5
        } : paper
      )
      setSessionData({ ...sessionData, papers: finalPapers })
    }, 5000)
  }

  // Test OCR endpoint function
  const testOCR = async () => {
    try {
      console.log('🧪 Testing OCR endpoint...')
      
      // Test with GET request first
      const getResponse = await fetch('/api/ocr', {
        method: 'GET'
      })
      
      if (getResponse.ok) {
        const getResult = await getResponse.json()
        console.log('✅ GET Test Result:', getResult)
      } else {
        console.error('❌ GET Test Failed:', getResponse.status)
      }
      
      // Test with POST request (empty payload)
      // const postResponse = await fetch('/api/ocr', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     image: 'test',
      //     filename: 'test.pdf'
      //   })
      // })
      
      // if (postResponse.ok) {
      //   const postResult = await postResponse.json()
      //   console.log('✅ POST Test Result:', postResult)
      // } else {
      //   const error = await postResponse.json()
      //   console.error('❌ POST Test Failed:', error)
      // }
      
    } catch (error) {
      console.error('❌ OCR Test Error:', error)
    }
  }

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-lg">Loading exam session...</div>
        </div>
      </div>
    )
  }

  // Authentication required
  if (!session?.user) {
    return null
  }

  // Error state
  if (error || !sessionData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'The requested exam session could not be found.'}
          </p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'processing': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'solved': return <Brain className="h-4 w-4" />
      case 'parsed': return <FileText className="h-4 w-4" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{sessionData.name}</h1>
            <p className="text-muted-foreground">
              {sessionData.examBoard} {sessionData.subject} • {sessionData.year} • 
              Created {sessionData.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={testOCR}
            className="bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800"
          >
            🧪 Test OCR
          </Button>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(sessionData.status)}`}>
            {getStatusIcon(sessionData.status)}
            <span>{sessionData.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Papers Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload New Paper */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Upload Exam Paper
              </CardTitle>
              <CardDescription>Upload PDF or image files for OCR processing and solving</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {dragActive ? 'Drop your exam papers here' : 'Drop your exam papers here, or click to browse'}
                </p>
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button 
                  disabled={uploadingPaper}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  {uploadingPaper ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports PDF, JPG, PNG up to 50MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Papers List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Exam Papers ({sessionData.papers.length})
              </CardTitle>
              <CardDescription>Manage and process your uploaded exam papers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionData.papers.map((paper) => (
                  <div key={paper.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{paper.filename}</h4>
                          <p className="text-sm text-muted-foreground">
                            Uploaded {paper.uploadedAt.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${getStatusColor(paper.status)}`}>
                          {getStatusIcon(paper.status)}
                          <span>{paper.status}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPaper(paper)}>
                          <Target className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Paper Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Questions:</span>
                        <span className="ml-1 font-medium">{paper.totalQuestions}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Solved:</span>
                        <span className="ml-1 font-medium">{paper.solvedQuestions}</span>
                      </div>
                      {paper.accuracy && (
                        <div>
                          <span className="text-muted-foreground">Accuracy:</span>
                          <span className="ml-1 font-medium">{paper.accuracy}%</span>
                        </div>
                      )}
                      {paper.processingTime && (
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <span className="ml-1 font-medium">{paper.processingTime}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {paper.status === 'uploaded' && (
                        <Button size="sm" onClick={() => processPaper(paper.id)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Parse Paper
                        </Button>
                      )}
                      {paper.status === 'parsed' && (
                        <Button size="sm" onClick={() => solveQuestions(paper.id)}>
                          <Brain className="h-4 w-4 mr-2" />
                          Solve Questions
                        </Button>
                      )}
                      {paper.status === 'solved' && (
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Export Solutions
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Questions Preview */}
          {selectedPaper && questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  Questions & Solutions
                </CardTitle>
                <CardDescription>
                  Viewing questions from {selectedPaper.filename}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {questions.map((question) => (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-lg">Question {question.questionNumber}</h4>
                          <span className="text-sm text-muted-foreground">{question.marks} marks</span>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${getStatusColor(question.status)}`}>
                          {getStatusIcon(question.status)}
                          <span>{question.status}</span>
                        </div>
                      </div>
                      
                      <p className="mb-4">{question.text}</p>
                      
                      {question.solution && (
                        <div className="bg-muted rounded-lg p-4">
                          <h5 className="font-medium mb-2 flex items-center">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Solution (Confidence: {question.solution.confidence}%)
                          </h5>
                          <ol className="list-decimal list-inside space-y-1 mb-3 text-sm">
                            {question.solution.steps.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                          <div className="bg-background rounded p-3 border-l-4 border-green-500">
                            <strong>Final Answer: {question.solution.finalAnswer}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Session Stats */}
        <div className="space-y-6">
          {/* Session Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Session Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Papers</span>
                </div>
                <span className="font-medium">{sessionData.papers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Total Questions</span>
                </div>
                <span className="font-medium">{sessionData.totalQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Solved</span>
                </div>
                <span className="font-medium">{sessionData.solvedQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Accuracy</span>
                </div>
                <span className="font-medium">{sessionData.avgAccuracy}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Processing Time</span>
                </div>
                <span className="font-medium">{sessionData.totalProcessingTime}</span>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Questions Solved</span>
                    <span>{sessionData.solvedQuestions}/{sessionData.totalQuestions}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(sessionData.solvedQuestions / sessionData.totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Accuracy</span>
                    <span>{sessionData.avgAccuracy}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${sessionData.avgAccuracy}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Upload className="h-4 w-4 mr-2" />
                Upload New Paper
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Brain className="h-4 w-4 mr-2" />
                Solve All Questions
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
