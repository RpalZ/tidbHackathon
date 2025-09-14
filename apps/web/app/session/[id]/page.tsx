"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
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
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X
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
  type: 'main' | 'subquestion' | 'subpart' // Question hierarchy type
  parentQuestionNumber?: string // Parent question identifier
  isMultipleChoice: boolean
  imageDescription?: string
  pageNumber: number
  diagrams?: string[]
  // Detected answer from OCR (user's original response)
  detectedAnswer?: {
    type: 'text' | 'mcq'
    answer: string | null
    choices?: string[] // For MCQ questions
  }
  solution?: {
    steps: string[]
    finalAnswer: string
    confidence: number
  }
  status: 'pending' | 'solving' | 'solved' | 'error'
  userAnswer?: string // User's current/edited answer
  chatMessages?: ChatMessage[] // Chat history for this question
}

interface ChatMessage {
  id: string
  message: string
  timestamp: Date
  isUser: boolean // true for user messages, false for AI responses
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
  
    // New states for revamped UI
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set())
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<string>('')
  const [editingAnswers, setEditingAnswers] = useState<Set<string>>(new Set())
  const [tempAnswers, setTempAnswers] = useState<Record<string, string>>({})
  const [collapsedMainQuestions, setCollapsedMainQuestions] = useState<Set<string>>(new Set())
  const [savingAnswers, setSavingAnswers] = useState<Set<string>>(new Set())

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
        const loadedQuestions = questionsData.questions || []
        setQuestions(loadedQuestions)
        
        // Automatically collapse all main questions on load
        const mainQuestionNumbers = new Set<string>(
          loadedQuestions
            .filter((q: Question) => q.type === 'main')
            .map((q: Question) => q.questionNumber)
        )
        setCollapsedMainQuestions(mainQuestionNumbers)
      }
    } catch (error) {
      console.error('Error loading questions:', error)
      setQuestions([])
      setCollapsedMainQuestions(new Set()) // Reset collapsed state on error
    }
  }

  // Handle user answer changes
  const handleAnswerChange = (questionId: string, answer: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, userAnswer: answer } : q
    ))
  }

  // Toggle answer editing
  const toggleAnswerEdit = (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    setEditingAnswers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
        // Remove temp answer when canceling edit
        setTempAnswers(tempPrev => {
          const newTemp = { ...tempPrev }
          delete newTemp[questionId]
          return newTemp
        })
      } else {
        newSet.add(questionId)
        // Initialize temp answer with detected answer or current user answer
        const currentAnswer = question.userAnswer || question.detectedAnswer?.answer || ''
        setTempAnswers(tempPrev => ({
          ...tempPrev,
          [questionId]: currentAnswer
        }))
      }
      return newSet
    })
  }

  // Handle temp answer change during editing
  const handleTempAnswerChange = (questionId: string, answer: string) => {
    setTempAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Save edited answer
  const saveAnswerEdit = async (questionId: string) => {
    const tempAnswer = tempAnswers[questionId]
    const question = questions.find(q => q.id === questionId)
    if (tempAnswer === undefined || !question) return

    setSavingAnswers(prev => new Set(prev).add(questionId))
    
    try {
      // Prepare answer object based on question type
      const answerObject = question.isMultipleChoice ? {
        type: 'mcq',
        choices: question.detectedAnswer?.choices || [],
        answer: tempAnswer
      } : {
        type: 'text',
        answer: tempAnswer
      }

      // Save to database
      const response = await fetch('/api/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionId,
          answer: answerObject
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save answer')
      }

      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { 
          ...q, 
          userAnswer: tempAnswer,
          detectedAnswer: question.isMultipleChoice ? {
            type: 'mcq' as const,
            answer: tempAnswer,
            choices: question.detectedAnswer?.choices || []
          } : {
            type: 'text' as const,
            answer: tempAnswer
          }
        } : q
      ))

      // Remove from editing set and temp answers
      setEditingAnswers(prev => {
        const newSet = new Set(prev)
        newSet.delete(questionId)
        return newSet
      })
      
      setTempAnswers(prev => {
        const newTemp = { ...prev }
        delete newTemp[questionId]
        return newTemp
      })

    } catch (error) {
      console.error('Error saving answer:', error)
      // TODO: Show error toast
    } finally {
      setSavingAnswers(prev => {
        const newSet = new Set(prev)
        newSet.delete(questionId)
        return newSet
      })
    }
  }

  // Group questions by main question
  const groupQuestionsByMain = (questions: Question[]) => {
    const grouped: Record<string, Question[]> = {}
    
    questions.forEach(question => {
      if (question.type === 'main') {
        // Main question is a group header
        if (!grouped[question.questionNumber]) {
          grouped[question.questionNumber] = []
        }
        grouped[question.questionNumber]!.unshift(question) // Add main question at beginning
      } else {
        // Find the main question this belongs to
        let mainQuestionNumber = question.parentQuestionNumber
        
        // For subparts, we need to find the ultimate main question
        if (question.type === 'subpart') {
          const parentQuestion = questions.find(q => q.questionNumber === question.parentQuestionNumber)
          if (parentQuestion && parentQuestion.type === 'subquestion') {
            mainQuestionNumber = parentQuestion.parentQuestionNumber
          }
        }
        
        if (mainQuestionNumber) {
          if (!grouped[mainQuestionNumber]) {
            grouped[mainQuestionNumber] = []
          }
          grouped[mainQuestionNumber]!.push(question)
        }
      }
    })
    
    return grouped
  }

  // Toggle main question collapse
  const toggleMainQuestion = (mainQuestionNumber: string) => {
    setCollapsedMainQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(mainQuestionNumber)) {
        newSet.delete(mainQuestionNumber)
      } else {
        newSet.add(mainQuestionNumber)
      }
      return newSet
    })
  }

  // Toggle chat expansion for a question
  const toggleChat = (questionId: string) => {
    setExpandedChats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  // Handle chat input changes
  const handleChatInputChange = (questionId: string, message: string) => {
    setChatInputs(prev => ({
      ...prev,
      [questionId]: message
    }))
  }

  // Send chat message
  const sendChatMessage = (questionId: string) => {
    const message = chatInputs[questionId]
    if (!message || !message.trim()) return

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      message: message.trim(),
      timestamp: new Date(),
      isUser: true
    }

    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { 
            ...q, 
            chatMessages: [...(q.chatMessages || []), newMessage] 
          } 
        : q
    ))

    setChatInputs(prev => ({
      ...prev,
      [questionId]: ''
    }))

    // TODO: Send to AI for response
  }

  // Mark all questions in current paper
  const markAllQuestions = async () => {
    if (!selectedPaper) return
    
    // TODO: Implement marking logic
    console.log('Marking all questions for paper:', selectedPaper.filename)
    console.log('User answers:', questions.map(q => ({ 
      questionId: q.id, 
      questionNumber: q.questionNumber,
      userAnswer: q.userAnswer 
    })))
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
          filename: file.name,
          sessionId: sessionId // Include sessionId so file gets associated with this session
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
          console.log(`🔗 Linked ${result.linkingResults.linked} to existing questions`)
        }
      } else {
        if (result.qna?.QnAs) {
          console.log(`✅ Processed ${result.qna.QnAs.length} questions`)
        }
      }
      
      // Reload session data to get the actual file data from the database
      await loadSessionData()
      
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploadingPaper(false)
    }
  }

  // Load session data function (extracted for reuse)
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
        const questionPapers = sessionData.papers.filter((p: any) => p.documentType === 'qsPaper')
        if (questionPapers.length > 0) {
          setSelectedPaper(questionPapers[0])
          setActiveTab(questionPapers[0].id)
          await loadQuestionsForPaper(questionPapers[0].id)
        }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
        {/* Left Column - Documents Management + Session Overview */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto top-6 h-[calc(100vh-100px)]">
          {/* Upload New Paper */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </CardTitle>
              <CardDescription className="text-sm">Upload PDF files for processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <div className="space-y-2">
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
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-3 text-sm">
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
                  size="sm"
                >
                  {uploadingPaper ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF files up to 50MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Papers List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <FileText className="h-4 w-4 mr-2" />
                Documents ({sessionData.papers.length})
              </CardTitle>
              <CardDescription className="text-sm">Manage your uploaded documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sessionData.papers.map((paper) => (
                  <div key={paper.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{paper.filename}</h4>
                            <div className="flex flex-col space-y-1 mt-1">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full w-fit ${
                                paper.documentType === 'markScheme' 
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                              }`}>
                                {paper.documentType === 'markScheme' ? 'Mark Scheme' : 'Question Paper'}
                              </span>
                              {paper.documentType === 'qsPaper' && paper.linkedMarkSchemeId && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex items-center w-fit">
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Linked
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {paper.uploadedAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${getStatusColor(paper.status)} flex-shrink-0 ml-2`}>
                        {getStatusIcon(paper.status)}
                        <span>{paper.status}</span>
                      </div>
                    </div>
                    
                    {/* Compact Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
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
                    </div>

                    {/* Compact Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {paper.status === 'uploaded' && (
                          <Button size="sm" onClick={() => processPaper(paper.id)} className="h-7 px-2 text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {paper.documentType === 'markScheme' ? 'Process' : 'Parse'}
                          </Button>
                        )}
                        {paper.status === 'parsed' && paper.documentType === 'qsPaper' && (
                          <Button size="sm" onClick={() => solveQuestions(paper.id)} className="h-7 px-2 text-xs">
                            <Brain className="h-3 w-3 mr-1" />
                            Solve
                          </Button>
                        )}
                        {paper.documentType === 'qsPaper' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setSelectedPaper(paper)
                              loadQuestionsForPaper(paper.id)
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Target className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {/* Link/Unlink buttons for question papers */}
                        {paper.documentType === 'qsPaper' && (
                          paper.linkedMarkSchemeId ? (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => unlinkFiles(paper.id)}
                              className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                            >
                              <Link2Off className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openLinkModal(paper.id)}
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                          )
                        )}
                        
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                      style={{ width: `${sessionData.totalQuestions > 0 ? (sessionData.solvedQuestions / sessionData.totalQuestions) * 100 : 0}%` }}
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
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Export All Solutions
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reprocess All Papers
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Target className="h-4 w-4 mr-2" />
                Mark All Questions
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Main Content - Questions & Answers */}
        <div className="lg:col-span-2 space-y-6 ">
          {sessionData.papers.filter(p => p.documentType === 'qsPaper').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  Questions & Answers
                </CardTitle>
                <CardDescription>
                  Answer questions and chat with AI for help
                </CardDescription>
              </CardHeader>
              
              {/* Paper Tabs */}
              <div className="border-b px-6">
                <div className="flex space-x-1 overflow-x-auto">
                  {sessionData.papers
                    .filter(p => p.documentType === 'qsPaper')
                    .map((paper) => (
                      <button
                        key={paper.id}
                        onClick={() => {
                          setActiveTab(paper.id)
                          setSelectedPaper(paper)
                          loadQuestionsForPaper(paper.id)
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                          activeTab === paper.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {(paper.filename.split('.')[0] || paper.filename).slice(0, 20)}
                        {paper.filename.length > 20 && '...'}
                      </button>
                    ))}
                </div>
              </div>

              <CardContent className="p-6 h-[calc(100vh-280px)] overflow-y-auto">
                {questions.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(groupQuestionsByMain(questions)).map(([mainQuestionNumber, questionGroup]) => (
                      <div key={mainQuestionNumber} className="border rounded-lg bg-card">
                        {/* Main Question Header - Collapsible */}
                        <div className="p-4 border-b bg-muted/50">
                          <button
                            onClick={() => toggleMainQuestion(mainQuestionNumber)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                {collapsedMainQuestions.has(mainQuestionNumber) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronUp className="h-4 w-4" />
                                )}
                                <h3 className="font-semibold text-lg">Question {mainQuestionNumber}</h3>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                ({questionGroup.length} part{questionGroup.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {questionGroup.filter(q => q.userAnswer || q.detectedAnswer?.answer).length}/{questionGroup.length} answered
                            </div>
                          </button>
                        </div>

                        {/* Question Parts - Collapsible Content */}
                        {!collapsedMainQuestions.has(mainQuestionNumber) && (
                          <div className="divide-y">
                            {questionGroup.map((question) => (
                              <div key={question.id} className="p-6">
                                {/* Question Header */}
                                <div className="flex items-start justify-between mb-4">
                                  <div>
                                    <h4 className="font-medium text-lg flex items-center space-x-2">
                                      <span>Question {question.questionNumber}</span>
                                      {question.isMultipleChoice && (
                                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                                          MCQ
                                        </span>
                                      )}
                                    </h4>
                                    <span className="text-sm text-muted-foreground">{question.marks} marks</span>
                                    {question.imageDescription && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">
                                        📷 {question.imageDescription}
                                      </p>
                                    )}
                                  </div>
                                  <div className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${getStatusColor(question.status)}`}>
                                    {getStatusIcon(question.status)}
                                    <span>{question.status}</span>
                                  </div>
                                </div>
                                
                                {/* Question Text */}
                                <div className="mb-6 p-4 bg-muted rounded-lg">
                                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath]}
                                      rehypePlugins={[rehypeKatex]}
                                    >
                                      {question.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                                
                                {/* Answer Section */}
                                <div className="mb-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium">
                                      {question.isMultipleChoice ? 'Your Selection:' : 'Your Answer:'}
                                    </label>
                                    <div className="flex items-center space-x-2">
                                      {editingAnswers.has(question.id) && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => toggleAnswerEdit(question.id)}
                                          disabled={savingAnswers.has(question.id)}
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Cancel
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => editingAnswers.has(question.id) ? saveAnswerEdit(question.id) : toggleAnswerEdit(question.id)}
                                        disabled={savingAnswers.has(question.id)}
                                      >
                                        {savingAnswers.has(question.id) ? (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Saving...
                                          </>
                                        ) : editingAnswers.has(question.id) ? (
                                          <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Save
                                          </>
                                        ) : (
                                          <>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {editingAnswers.has(question.id) ? (
                                    // Editing Mode
                                    <div className="space-y-3">
                                      {question.isMultipleChoice && question.detectedAnswer?.choices ? (
                                        // MCQ Editing Mode
                                        <div className="space-y-2">
                                          {question.detectedAnswer.choices.map((choice, index) => (
                                            <label key={index} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                                              <input
                                                type="radio"
                                                name={`question-${question.id}`}
                                                value={choice}
                                                checked={tempAnswers[question.id] === choice}
                                                onChange={(e) => handleTempAnswerChange(question.id, e.target.value)}
                                                className="w-4 h-4 text-primary"
                                              />
                                              <span className="flex-1">{choice}</span>
                                            </label>
                                          ))}
                                        </div>
                                      ) : (
                                        // Text Editing Mode
                                        <div className="space-y-2">
                                          <textarea
                                            value={tempAnswers[question.id] || ''}
                                            onChange={(e) => handleTempAnswerChange(question.id, e.target.value)}
                                            placeholder="Enter your answer here... (Supports Markdown and LaTeX)"
                                            className="w-full min-h-[8rem] max-h-64 p-3 border rounded-lg resize-y focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                                            rows={4}
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            Supports Markdown and LaTeX. Use $...$ for inline math or $$...$$ for display math.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // Display Mode
                                    <div className="min-h-[6rem] p-3 border rounded-lg bg-background overflow-auto">
                                      {question.userAnswer || question.detectedAnswer?.answer ? (
                                        question.isMultipleChoice && question.detectedAnswer?.choices ? (
                                          // MCQ Display Mode
                                          <div className="space-y-2">
                                            <p className="font-medium text-sm text-muted-foreground mb-3">Available choices:</p>
                                            {question.detectedAnswer.choices.map((choice, index) => (
                                              <div 
                                                key={index} 
                                                className={`p-2 border rounded ${
                                                  (question.userAnswer || question.detectedAnswer?.answer) === choice
                                                    ? 'border-primary bg-primary/10 font-medium'
                                                    : 'border-muted'
                                                }`}
                                              >
                                                <span className="flex items-center space-x-2">
                                                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs">
                                                    {String.fromCharCode(65 + index)}
                                                  </span>
                                                  <span>{choice}</span>
                                                  {(question.userAnswer || question.detectedAnswer?.answer) === choice && (
                                                    <CheckCircle className="h-4 w-4 text-primary ml-auto" />
                                                  )}
                                                </span>
                                              </div>
                                            ))}
                                            <p className="text-sm text-muted-foreground mt-3">
                                              Selected: <span className="font-medium">{question.userAnswer || question.detectedAnswer?.answer}</span>
                                            </p>
                                          </div>
                                        ) : (
                                          // Text Display Mode
                                          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground">
                                            <ReactMarkdown
                                              remarkPlugins={[remarkMath]}
                                              rehypePlugins={[rehypeKatex]}
                                            >
                                              {question.userAnswer || question.detectedAnswer?.answer || ''}
                                            </ReactMarkdown>
                                          </div>
                                        )
                                      ) : (
                                        <p className="text-muted-foreground italic">No answer detected. Click Edit to add your answer.</p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Chat Section */}
                                <div className="border-t pt-4">
                                  <button
                                    onClick={() => toggleChat(question.id)}
                                    className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                    <span>Chat with AI about this question</span>
                                    {expandedChats.has(question.id) ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </button>

                                  {expandedChats.has(question.id) && (
                                    <div className="mt-4 border rounded-lg bg-background">
                                      {/* Chat Messages */}
                                      <div className="p-4 max-h-48 overflow-y-auto">
                                        {question.chatMessages && question.chatMessages.length > 0 ? (
                                          <div className="space-y-3">
                                            {question.chatMessages.map((msg) => (
                                              <div
                                                key={msg.id}
                                                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                                              >
                                                <div
                                                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                                                    msg.isUser
                                                      ? 'bg-primary text-primary-foreground'
                                                      : 'bg-muted text-foreground'
                                                  }`}
                                                >
                                                  <p>{msg.message}</p>
                                                  <p className="text-xs mt-1 opacity-70">
                                                    {msg.timestamp.toLocaleTimeString()}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground text-center py-4">
                                            No messages yet. Ask a question about this problem!
                                          </p>
                                        )}
                                      </div>

                                      {/* Chat Input */}
                                      <div className="border-t p-4">
                                        <div className="flex space-x-2">
                                          <input
                                            type="text"
                                            value={chatInputs[question.id] || ''}
                                            onChange={(e) => handleChatInputChange(question.id, e.target.value)}
                                            placeholder="Ask a question about this problem..."
                                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            onKeyPress={(e) => {
                                              if (e.key === 'Enter') {
                                                sendChatMessage(question.id)
                                              }
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() => sendChatMessage(question.id)}
                                            disabled={!chatInputs[question.id]?.trim()}
                                          >
                                            <Send className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Mark All Button */}
                    <div className="pt-6 border-t">
                      <Button
                        onClick={markAllQuestions}
                        className="w-full py-3 text-lg font-medium"
                        size="lg"
                      >
                        <GraduationCap className="h-5 w-5 mr-2" />
                        Mark All Questions
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Questions Available</h3>
                    <p className="text-muted-foreground">
                      {selectedPaper ? 'This paper has no questions yet.' : 'Select a question paper to view questions.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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
