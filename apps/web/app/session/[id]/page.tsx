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
  Target,
  Link2,
  Link2Off,
  MessageCircle,
  Send,
  GraduationCap
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
  documentType?: 'qsPaper' | 'markScheme'
  linkedMarkSchemeId?: string // For question papers
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
  const [documentType, setDocumentType] = useState<'qsPaper' | 'markScheme'>('qsPaper')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkingPaperId, setLinkingPaperId] = useState<string | null>(null)
  const [availableMarkSchemes, setAvailableMarkSchemes] = useState<ExamPaper[]>([])

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
        
        // Load real session data from database
        const response = await fetch(`/api/sessions/${sessionId}`)
        if (!response.ok) {
          throw new Error('Failed to load session data')
        }
        
        const sessionData = await response.json()
        
        // Convert date strings back to Date objects
        const processedSessionData = {
          ...sessionData,
          createdAt: new Date(sessionData.createdAt),
          papers: sessionData.papers.map((paper: any) => ({
            ...paper,
            uploadedAt: new Date(paper.uploadedAt)
          }))
        }
        
        setSessionData(processedSessionData)
        
        // Load questions for the selected paper
        if (sessionData.papers.length > 0) {
          setSelectedPaper(sessionData.papers[0])
          await loadQuestionsForPaper(sessionData.papers[0].id)
        }
        
        setError(null)
      } catch (err) {
        setError('Failed to load session data')
        console.error('Error loading session:', err)
        
        // Fallback: Create empty session if none exists
        const fallbackSession: SessionData = {
          id: sessionId,
          name: `Session ${sessionId.slice(-8)}`,
          examBoard: 'Edexcel',
          subject: 'Physics',
          year: 2024,
          createdAt: new Date(),
          status: 'draft',
          totalQuestions: 0,
          solvedQuestions: 0,
          avgAccuracy: 0,
          totalProcessingTime: '0s',
          papers: []
        }
        setSessionData(fallbackSession)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      loadSessionData()
    }
  }, [sessionId])

  // Load questions for a specific paper
  const loadQuestionsForPaper = async (paperId: string) => {
    try {
      const response = await fetch(`/api/questions?fileId=${paperId}`)
      if (response.ok) {
        const questionsData = await response.json()
        setQuestions(questionsData.questions || [])
      }
    } catch (error) {
      console.error('Error loading questions:', error)
      setQuestions([])
    }
  }

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
      
      // Choose API endpoint based on document type
      const apiEndpoint = documentType === 'markScheme' ? '/api/markscheme' : '/api/ocr'
      
      // Send to appropriate API
      const response = await fetch(apiEndpoint, {
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
        throw new Error(`${documentType === 'markScheme' ? 'Mark scheme' : 'OCR'} request failed`)
      }
      
      const result = await response.json()
      console.log(`${documentType === 'markScheme' ? 'Mark Scheme' : 'OCR'} Result:`, result)
      
      // Handle different response formats
      if (documentType === 'markScheme') {
        if (result.markSchemeData) {
          console.log(`✅ Processed ${result.markSchemeData.markSchemes.length} mark scheme entries`)
          console.log(`� Linked ${result.linkingResults.linked} to existing questions`)
        }
      } else {
        if (result.qna?.QnAs) {
          console.log(`✅ Processed ${result.qna.QnAs.length} questions`)
        }
      }
      
      const newPaper: ExamPaper = {
        id: `paper-${Date.now()}`,
        filename: file.name,
        examBoard: 'Edexcel',
        subject: 'Physics',
        year: 2024,
        status: 'processing',
        uploadedAt: new Date(),
        totalQuestions: documentType === 'markScheme' 
          ? (result.markSchemeData?.markSchemes?.length || 0)
          : (result.qna?.QnAs?.length || 0),
        solvedQuestions: 0,
        documentType: documentType
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

  // File linking functions
  const openLinkModal = (questionPaperId: string) => {
    setLinkingPaperId(questionPaperId)
    // Get available mark schemes from current session
    const markSchemes = sessionData?.papers.filter(p => p.documentType === 'markScheme') || []
    setAvailableMarkSchemes(markSchemes)
    setShowLinkModal(true)
  }

  const linkFiles = async (questionPaperId: string, markSchemeId: string) => {
    try {
      const response = await fetch('/api/link-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionPaperId, markSchemeId })
      })

      if (!response.ok) {
        throw new Error('Failed to link files')
      }

      const result = await response.json()
      console.log('Files linked successfully:', result)

      // Update session data to reflect the link
      if (sessionData) {
        const updatedPapers = sessionData.papers.map(paper => 
          paper.id === questionPaperId 
            ? { ...paper, linkedMarkSchemeId: markSchemeId }
            : paper
        )
        setSessionData({ ...sessionData, papers: updatedPapers })
      }

      setShowLinkModal(false)
    } catch (error) {
      console.error('Error linking files:', error)
    }
  }

  const unlinkFiles = async (questionPaperId: string) => {
    try {
      const response = await fetch('/api/link-files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionPaperId })
      })

      if (!response.ok) {
        throw new Error('Failed to unlink files')
      }

      // Update session data to remove the link
      if (sessionData) {
        const updatedPapers = sessionData.papers.map(paper => 
          paper.id === questionPaperId 
            ? { ...paper, linkedMarkSchemeId: undefined }
            : paper
        )
        setSessionData({ ...sessionData, papers: updatedPapers })
      }

      console.log('Files unlinked successfully')
    } catch (error) {
      console.error('Error unlinking files:', error)
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
                Upload Document
              </CardTitle>
              <CardDescription>Upload PDF files for processing (question papers or mark schemes)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="documentType"
                      value="qsPaper"
                      checked={documentType === 'qsPaper'}
                      onChange={(e) => setDocumentType(e.target.value as 'qsPaper')}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm">Question Paper</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="documentType"
                      value="markScheme"
                      checked={documentType === 'markScheme'}
                      onChange={(e) => setDocumentType(e.target.value as 'markScheme')}
                      className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm">Mark Scheme</span>
                  </label>
                </div>
              </div>

              {/* Upload Area */}
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
                  {dragActive 
                    ? `Drop your ${documentType === 'qsPaper' ? 'question paper' : 'mark scheme'} here` 
                    : `Drop your ${documentType === 'qsPaper' ? 'question paper' : 'mark scheme'} here, or click to browse`
                  }
                </p>
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf"
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose {documentType === 'qsPaper' ? 'Question Paper' : 'Mark Scheme'}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports PDF files up to 50MB • 
                  {documentType === 'qsPaper' 
                    ? ' Questions will be extracted and parsed' 
                    : ' Marking criteria will be extracted and linked to questions'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Papers List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Documents ({sessionData.papers.length})
              </CardTitle>
              <CardDescription>Manage and process your uploaded documents (question papers and mark schemes)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionData.papers.map((paper) => (
                  <div key={paper.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{paper.filename}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              paper.documentType === 'markScheme' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            }`}>
                              {paper.documentType === 'markScheme' ? 'Mark Scheme' : 'Question Paper'}
                            </span>
                            {/* Link status indicator */}
                            {paper.documentType === 'qsPaper' && paper.linkedMarkSchemeId && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex items-center">
                                <Link2 className="h-3 w-3 mr-1" />
                                Linked
                              </span>
                            )}
                          </div>
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
                        <Button variant="ghost" size="sm" onClick={() => {
                          setSelectedPaper(paper)
                          loadQuestionsForPaper(paper.id)
                        }}>
                          <Target className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Paper Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          {paper.documentType === 'markScheme' ? 'Criteria:' : 'Questions:'}
                        </span>
                        <span className="ml-1 font-medium">{paper.totalQuestions}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {paper.documentType === 'markScheme' ? 'Linked:' : 'Solved:'}
                        </span>
                        <span className="ml-1 font-medium">{paper.solvedQuestions}</span>
                      </div>
                      {paper.accuracy && (
                        <div>
                          <span className="text-muted-foreground">
                            {paper.documentType === 'markScheme' ? 'Match Rate:' : 'Accuracy:'}
                          </span>
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
                          {paper.documentType === 'markScheme' ? 'Process Mark Scheme' : 'Parse Paper'}
                        </Button>
                      )}
                      {paper.status === 'parsed' && paper.documentType === 'qsPaper' && (
                        <Button size="sm" onClick={() => solveQuestions(paper.id)}>
                          <Brain className="h-4 w-4 mr-2" />
                          Solve Questions
                        </Button>
                      )}
                      {paper.status === 'solved' && (
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          {paper.documentType === 'markScheme' ? 'Export Criteria' : 'Export Solutions'}
                        </Button>
                      )}
                      
                      {/* Link/Unlink buttons for question papers */}
                      {paper.documentType === 'qsPaper' && (
                        paper.linkedMarkSchemeId ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => unlinkFiles(paper.id)}
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <Link2Off className="h-4 w-4 mr-2" />
                            Unlink
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openLinkModal(paper.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Link MS
                          </Button>
                        )
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

      {/* Link Files Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Link to Mark Scheme</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select a mark scheme to link with this question paper. This will enable targeted semantic matching.
            </p>
            
            <div className="space-y-2 mb-4">
              {availableMarkSchemes.length > 0 ? (
                availableMarkSchemes.map((markScheme) => (
                  <Button
                    key={markScheme.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => linkingPaperId && linkFiles(linkingPaperId, markScheme.id)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {markScheme.filename}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No mark schemes available. Upload a mark scheme first.
                </p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLinkModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
