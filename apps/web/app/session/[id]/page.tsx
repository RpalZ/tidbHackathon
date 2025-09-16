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
  X,
  RotateCcw,
  AlertCircle as AlertCircleIcon
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
  // Assessment fields
  marked?: boolean
  modelAnswer?: string
  marksAwarded?: number
  feedback?: string
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
  const [activeTab, setActiveTab] = useState<string>('')
  const [editingAnswers, setEditingAnswers] = useState<Set<string>>(new Set())
  const [tempAnswers, setTempAnswers] = useState<Record<string, string>>({})
  const [collapsedMainQuestions, setCollapsedMainQuestions] = useState<Set<string>>(new Set())
  const [savingAnswers, setSavingAnswers] = useState<Set<string>>(new Set())
  
  // PDF Viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null)
  const [currentPdfName, setCurrentPdfName] = useState<string>('')
  const [loadingPdf, setLoadingPdf] = useState(false)
  
  // Assessment state
  const [assessingQuestions, setAssessingQuestions] = useState<Set<string>>(new Set())
  const [assessmentResults, setAssessmentResults] = useState<Record<string, any>>({})
  const [showAssessmentModal, setShowAssessmentModal] = useState(false)
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null)
  
  // Chat Mode state
  const [isChatMode, setIsChatMode] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Delete state
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())

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

  // Chat Mode Functions
  const sendGlobalChatMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      id: `chat-${Date.now()}`,
      message: chatInput.trim(),
      timestamp: new Date(),
      isUser: true
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)

    try {
      // Call the new chat API with RAG and tool calling
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.message,
          sessionId: sessionId,
          conversationHistory: chatMessages.slice(-10), // Send last 10 messages for context
          currentPaper: selectedPaper ? {
            id: selectedPaper.id,
            filename: selectedPaper.filename,
            documentType: selectedPaper.documentType,
            status: selectedPaper.status,
            totalQuestions: selectedPaper.totalQuestions,
            linkedMarkSchemeId: selectedPaper.linkedMarkSchemeId
          } : null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const result = await response.json()
      
      // Format the AI response based on type
      const aiResponse = result.response
      let aiResponseText = ''

      // Handle different response types
      if (aiResponse.type) {
        switch (aiResponse.type) {
          case 'explanation':
            aiResponseText = `**Explanation:**\n${aiResponse.explanation}\n\n`
            if (aiResponse.keyPoints?.length > 0) {
              aiResponseText += `**Key Points:**\n${aiResponse.keyPoints.map((point: string) => `• ${point}`).join('\n')}\n\n`
            }
            if (aiResponse.examples?.length > 0) {
              aiResponseText += `**Examples:**\n${aiResponse.examples.map((example: string) => `• ${example}`).join('\n')}\n\n`
            }
            if (aiResponse.followUpQuestions?.length > 0) {
              aiResponseText += `**Follow-up Questions:**\n${aiResponse.followUpQuestions.map((q: string) => `• ${q}`).join('\n')}\n\n`
            }
            if (aiResponse.difficulty) {
              aiResponseText += `**Difficulty Level:** ${aiResponse.difficulty.charAt(0).toUpperCase() + aiResponse.difficulty.slice(1)}`
            }
            break
            
          case 'answer':
            aiResponseText = `**Answer:** ${aiResponse.answer}\n\n`
            if (aiResponse.workingSteps?.length > 0) {
              aiResponseText += `**Working Steps:**\n${aiResponse.workingSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n\n`
            }
            aiResponseText += `**Confidence:** ${aiResponse.confidence}%\n\n`
            if (aiResponse.assumptions?.length > 0) {
              aiResponseText += `**Assumptions Made:**\n${aiResponse.assumptions.map((assumption: string) => `• ${assumption}`).join('\n')}\n\n`
            }
            if (aiResponse.alternativeApproaches?.length > 0) {
              aiResponseText += `**Alternative Approaches:**\n${aiResponse.alternativeApproaches.map((approach: string) => `• ${approach}`).join('\n')}`
            }
            break
            
          case 'assessment':
            aiResponseText = `**Assessment Results:**\n`
            aiResponseText += `**Score:** ${aiResponse.marksAwarded}/${aiResponse.maxMarks} marks (${aiResponse.percentage}%)\n\n`
            aiResponseText += `**Feedback:** ${aiResponse.feedback}\n\n`
            if (aiResponse.strengths?.length > 0) {
              aiResponseText += `**Strengths:**\n${aiResponse.strengths.map((strength: string) => `• ${strength}`).join('\n')}\n\n`
            }
            if (aiResponse.keywordMatches?.length > 0) {
              aiResponseText += `**Keywords Found:** ${aiResponse.keywordMatches.join(', ')}\n\n`
            }
            if (aiResponse.missingElements?.length > 0) {
              aiResponseText += `**Missing Elements:**\n${aiResponse.missingElements.map((element: string) => `• ${element}`).join('\n')}\n\n`
            }
            if (aiResponse.improvements?.length > 0) {
              aiResponseText += `**Improvements:**\n${aiResponse.improvements.map((imp: string) => `• ${imp}`).join('\n')}`
            }
            break
            
          case 'general':
          default:
            aiResponseText = aiResponse.response
            if (aiResponse.encouragement) {
              aiResponseText += `\n\n**Encouragement:** ${aiResponse.encouragement}`
            }
            if (aiResponse.suggestions?.length > 0) {
              aiResponseText += `\n\n**Suggestions:**\n${aiResponse.suggestions.map((s: string) => `• ${s}`).join('\n')}`
            }
            if (aiResponse.nextSteps?.length > 0) {
              aiResponseText += `\n\n**Next Steps:**\n${aiResponse.nextSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`
            }
            break
        }
      } else {
        // Simple response format fallback
        aiResponseText = aiResponse.response || aiResponse || 'I apologize, but I encountered an issue processing your request.'
      }

      // Add tool usage information if available (updated for multiple tools)
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        aiResponseText += `\n\n*Used tools: ${result.toolsUsed.join(', ')}*`
      } else if (result.toolUsed) {
        aiResponseText += `\n\n*Used tool: ${result.toolUsed}*`
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        message: aiResponseText,
        timestamp: new Date(),
        isUser: false
      }
      
      setChatMessages(prev => [...prev, aiMessage])
      
    } catch (error) {
      console.error('Error sending chat message:', error)
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        isUser: false
      }
      
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // Assess individual question
  const assessQuestion = async (questionId: string, forceReassess: boolean = false) => {
    const question = questions.find(q => q.id === questionId)
    const answerToAssess = question?.userAnswer?.trim() || question?.detectedAnswer?.answer?.trim()
    
    if (!question || !answerToAssess) {
      alert('Please provide an answer before assessment')
      return
    }

    if (question.marked && !forceReassess) {
      // If already marked, ask user what they want to do
      const choice = confirm(
        `This question has already been assessed (${question.marksAwarded}/${question.marks} marks).\n\n` +
        `Click "OK" to re-assess the question\n` +
        `Click "Cancel" to view existing results`
      )
      
      if (choice) {
        // User wants to re-assess
        return assessQuestion(questionId, true)
      } else {
        // User wants to view existing results
        viewAssessmentResult(questionId)
        return
      }
    }

    setAssessingQuestions(prev => new Set(prev).add(questionId))

    try {
      const response = await fetch('/api/assess-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionId,
          userAnswer: answerToAssess
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Assessment failed')
      }

      const result = await response.json()
      
      // Update question with assessment results
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? {
          ...q,
          marked: true,
          modelAnswer: result.assessment.modelAnswer,
          marksAwarded: result.assessment.marksAwarded,
          feedback: result.assessment.feedback
        } : q
      ))

      // Store detailed assessment results
      setAssessmentResults(prev => ({
        ...prev,
        [questionId]: result.assessment
      }))

      // Show assessment result modal
      setSelectedAssessment(result.assessment)
      setShowAssessmentModal(true)

    } catch (error) {
      console.error('Error assessing question:', error)
      alert(error instanceof Error ? error.message : 'Assessment failed')
    } finally {
      setAssessingQuestions(prev => {
        const newSet = new Set(prev)
        newSet.delete(questionId)
        return newSet
      })
    }
  }

  // View assessment result for already marked question
  const viewAssessmentResult = async (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question?.marked) return

    // Check if we already have the result cached
    if (assessmentResults[questionId]) {
      setSelectedAssessment(assessmentResults[questionId])
      setShowAssessmentModal(true)
      return
    }

    try {
      const response = await fetch(`/api/assess-question?questionId=${questionId}`)
      if (response.ok) {
        const result = await response.json()
        setAssessmentResults(prev => ({
          ...prev,
          [questionId]: result.assessment
        }))
        setSelectedAssessment(result.assessment)
        setShowAssessmentModal(true)
      }
    } catch (error) {
      console.error('Error fetching assessment result:', error)
    }
  }

  // Mark all questions in current paper
  const markAllQuestions = async () => {
    if (!selectedPaper) return
    
    const questionsWithAnswers = questions.filter(q => 
      q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim()
    )

    if (questionsWithAnswers.length === 0) {
      alert('No questions with answers found to assess')
      return
    }

    // Separate marked and unmarked questions
    const unmarkedQuestions = questionsWithAnswers.filter(q => !q.marked)
    const markedQuestions = questionsWithAnswers.filter(q => q.marked)

    let confirmMessage = ''
    let questionsToProcess = unmarkedQuestions

    if (unmarkedQuestions.length > 0 && markedQuestions.length > 0) {
      // Mixed: some marked, some unmarked
      const choice = confirm(
        `Found ${unmarkedQuestions.length} unmarked and ${markedQuestions.length} already marked questions.\n\n` +
        `Click "OK" to assess only unmarked questions\n` +
        `Click "Cancel" to re-assess ALL questions`
      )
      
      if (choice) {
        confirmMessage = `This will assess ${unmarkedQuestions.length} unmarked questions. Continue?`
        questionsToProcess = unmarkedQuestions
      } else {
        confirmMessage = `This will re-assess ALL ${questionsWithAnswers.length} questions. Continue?`
        questionsToProcess = questionsWithAnswers
      }
    } else if (markedQuestions.length > 0) {
      // All are already marked
      const choice = confirm(
        `All ${markedQuestions.length} questions have already been assessed.\n\n` +
        `Do you want to re-assess all of them?`
      )
      
      if (!choice) return
      
      confirmMessage = `This will re-assess all ${markedQuestions.length} questions. Continue?`
      questionsToProcess = markedQuestions
    } else {
      // All are unmarked
      confirmMessage = `This will assess ${unmarkedQuestions.length} questions. Continue?`
      questionsToProcess = unmarkedQuestions
    }

    const finalConfirm = confirm(confirmMessage)
    if (!finalConfirm) return

    // Mark all questions that need assessment as being processed
    const questionIds = questionsToProcess.map(q => q.id)
    setAssessingQuestions(prev => new Set([...prev, ...questionIds]))

    let successCount = 0
    let errorCount = 0

    for (const question of questionsToProcess) {
      try {
        const answerToAssess = question.userAnswer?.trim() || question.detectedAnswer?.answer?.trim()
        
        const response = await fetch('/api/assess-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            userAnswer: answerToAssess
          })
        })

        if (response.ok) {
          const result = await response.json()
          
          // Update question with assessment results
          setQuestions(prev => prev.map(q => 
            q.id === question.id ? {
              ...q,
              marked: true,
              modelAnswer: result.assessment.modelAnswer,
              marksAwarded: result.assessment.marksAwarded,
              feedback: result.assessment.feedback
            } : q
          ))

          // Store detailed assessment results
          setAssessmentResults(prev => ({
            ...prev,
            [question.id]: result.assessment
          }))

          successCount++
        } else {
          const errorData = await response.json()
          console.error(`Failed to assess question ${question.questionNumber}:`, errorData.error)
          errorCount++
        }
      } catch (error) {
        console.error(`Error assessing question ${question.questionNumber}:`, error)
        errorCount++
      }

      // Remove from assessing set
      setAssessingQuestions(prev => {
        const newSet = new Set(prev)
        newSet.delete(question.id)
        return newSet
      })
    }

    alert(`Assessment complete!\nSuccessful: ${successCount}\nFailed: ${errorCount}`)
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

  // View PDF function
  const viewPdf = async (fileId: string, filename: string) => {
    setLoadingPdf(true)
    try {
      console.log('Fetching PDF for file ID:', fileId)
      const response = await fetch(`/api/files/${fileId}`)
      
      if (response.ok) {
        const fileData = await response.json()
        console.log('File data received:', { ...fileData, content: `${fileData.content?.length || 0} characters` })
        
        if (!fileData.content) {
          console.error('No content found in file data')
          alert('PDF content is empty')
          return
        }
        
        // Create blob URL from base64 content
        const base64Content = fileData.content
        console.log('Converting base64 to blob, content length:', base64Content.length)
        
        // Convert base64 to binary
        const binaryString = atob(base64Content)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // Create blob with correct MIME type
        const blob = new Blob([bytes], { type: fileData.mimetype || 'application/pdf' })
        console.log('Blob created:', { size: blob.size, type: blob.type })
        
        const url = URL.createObjectURL(blob)
        console.log('Object URL created:', url)
        
        setCurrentPdfUrl(url)
        setCurrentPdfName(filename)
        setShowPdfViewer(true)
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch PDF content:', errorData)
        alert('Failed to load PDF: ' + (errorData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error viewing PDF:', error)
      alert('Error loading PDF: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoadingPdf(false)
    }
  }

  // Close PDF viewer
  const closePdfViewer = () => {
    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl)
    }
    setCurrentPdfUrl(null)
    setCurrentPdfName('')
    setShowPdfViewer(false)
  }

  // Delete file function
  const deleteFile = async (fileId: string, filename: string) => {
    // Prevent deletion if already in progress
    if (deletingFiles.has(fileId)) return

    const confirmed = confirm(
      `Are you sure you want to delete "${filename}"? This action cannot be undone and will also delete all associated questions and marks.`
    )
    if (!confirmed) return

    setDeletingFiles(prev => new Set(prev).add(fileId))

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete file')
      }

      // Remove file from session data
      if (sessionData) {
        const updatedPapers = sessionData.papers.filter(paper => paper.id !== fileId)
        setSessionData({ ...sessionData, papers: updatedPapers })

        // If this was the selected paper, clear questions and selection
        if (selectedPaper?.id === fileId) {
          setSelectedPaper(null)
          setQuestions([])
          setActiveTab('')
        }
      }

      console.log('File deleted successfully')
    } catch (error) {
      console.error('Error deleting file:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete file')
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
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
            variant={isChatMode ? "default" : "outline"}
            size="sm" 
            onClick={() => setIsChatMode(!isChatMode)}
            className={isChatMode ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {isChatMode ? "Exit Chat" : "Chat Mode"}
          </Button>
         
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(sessionData.status)}`}>
            {getStatusIcon(sessionData.status)}
            <span>{sessionData.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
        {/* Left Column - Documents Management + Session Overview OR Chat Module */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto top-6 h-[calc(100vh-140px)]">
          {!isChatMode ? (
            <>
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
                        {/* View PDF Button */}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => viewPdf(paper.id, paper.filename)}
                          disabled={loadingPdf}
                          className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                          title="View PDF"
                        >
                          {loadingPdf ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        
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
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteFile(paper.id, paper.filename)}
                          disabled={deletingFiles.has(paper.id)}
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                          title="Delete file"
                        >
                          {deletingFiles.has(paper.id) ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
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
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Progress Overview
              </CardTitle>
              <CardDescription>Track your session completion and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Questions Progress */}
                <div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="font-medium text-foreground">Questions Solved</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">{sessionData.solvedQuestions}/{sessionData.totalQuestions}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                        {sessionData.totalQuestions > 0 ? Math.round((sessionData.solvedQuestions / sessionData.totalQuestions) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                      style={{ width: `${sessionData.totalQuestions > 0 ? (sessionData.solvedQuestions / sessionData.totalQuestions) * 100 : 0}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Start</span>
                    <span>Complete</span>
                  </div>
                </div>
                
                {/* Accuracy Progress */}
                <div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="font-medium text-foreground">Average Accuracy</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        sessionData.avgAccuracy >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        sessionData.avgAccuracy >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {sessionData.avgAccuracy >= 90 ? 'Excellent' :
                         sessionData.avgAccuracy >= 70 ? 'Good' : 'Needs Work'}
                      </span>
                      <span className="text-muted-foreground font-medium">{sessionData.avgAccuracy}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
                        sessionData.avgAccuracy >= 90 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                        sessionData.avgAccuracy >= 70 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                        'bg-gradient-to-r from-red-500 to-red-400'
                      }`}
                      style={{ width: `${sessionData.avgAccuracy}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold text-primary">
                      {sessionData.papers.filter(p => p.status === 'solved' || p.status === 'parsed').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Papers Done</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">
                      {sessionData.totalProcessingTime}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Time</div>
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
            </>
          ) : (
            /* Chat Module */
            <Card className="h-[calc(100vh-140px)] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  AI Chat Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about your exam or get help with specific problems
                </CardDescription>
                
                {/* Current Context */}
                {selectedPaper && (
                  <div className="mt-2 p-2 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Currently working on:</p>
                    <p className="text-sm font-medium">{selectedPaper.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {sessionData?.examBoard} {sessionData?.subject} • {questions.length} questions
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                {/* Chat Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0 w-full max-w-full">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">AI Chat Assistant</h3>
                      <p className="text-muted-foreground mb-4">
                        Ask me anything about your exam questions or concepts you'd like to understand better.
                      </p>
                      
                      {/* Suggested Prompts */}
                      <div className="space-y-2 max-w-md mx-auto">
                        <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
                        <div className="grid gap-2">
                          {[
                            selectedPaper 
                              ? `Help me with ${selectedPaper.filename.replace('.pdf', '')} questions`
                              : "Show me similar questions to practice",
                            questions.length > 0 
                              ? `Explain question ${questions[0]?.questionNumber || '1'} step by step`
                              : "What concepts should I focus on for this exam?",
                            sessionData?.subject 
                              ? `Give me tips for ${sessionData.subject} problem-solving`
                              : "What's the best approach for solving exam questions?",
                            "Assess my answer and give detailed feedback"
                          ].map((prompt, index) => (
                            <button
                              key={index}
                              onClick={() => setChatInput(prompt)}
                              className="text-xs bg-muted hover:bg-muted/80 px-3 py-2 rounded-lg text-left transition-colors"
                            >
                              "{prompt}"
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex w-full ${message.isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] min-w-0 rounded-lg px-3 py-2 break-words overflow-hidden ${
                            message.isUser
                              ? 'bg-primary text-primary-foreground ml-4'
                              : 'bg-muted mr-4'
                          }`}
                          style={{ wordWrap: 'break-word', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                        >
                          <div className="text-sm break-words" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                            {message.isUser ? (
                              message.message
                            ) : (
                              // Render AI messages with basic markdown formatting
                              message.message
                                .split('\n')
                                .map((line, index) => {
                                  if (line.startsWith('**') && line.endsWith('**')) {
                                    // Bold headers
                                    return (
                                      <div key={index} className="font-semibold mt-2 first:mt-0 break-words">
                                        {line.slice(2, -2)}
                                      </div>
                                    )
                                  } else if (line.startsWith('• ')) {
                                    // Bullet points
                                    return (
                                      <div key={index} className="ml-4 mt-1 break-words">
                                        {line}
                                      </div>
                                    )
                                  } else if (line.match(/^\d+\. /)) {
                                    // Numbered lists
                                    return (
                                      <div key={index} className="ml-4 mt-1 break-words">
                                        {line}
                                      </div>
                                    )
                                  } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
                                    // Italic text (like tool usage)
                                    return (
                                      <div key={index} className="italic text-xs opacity-70 mt-2 break-words">
                                        {line.slice(1, -1)}
                                      </div>
                                    )
                                  } else if (line.trim() === '') {
                                    // Empty lines for spacing
                                    return <div key={index} className="h-2"></div>
                                  } else {
                                    // Regular text
                                    return (
                                      <div key={index} className="mt-1 first:mt-0 break-words">
                                        {line}
                                      </div>
                                    )
                                  }
                                })
                            )}
                          </div>
                          <p className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 mr-4">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat Input */}
                <div className="border-t p-4 flex-shrink-0">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendGlobalChatMessage()
                        }
                      }}
                      placeholder="Ask a question..."
                      className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={isTyping}
                    />
                    <Button 
                      onClick={sendGlobalChatMessage}
                      disabled={!chatInput.trim() || isTyping}
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
                  Answer questions and use Chat Mode for AI assistance
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
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div>
                                {questionGroup.filter(q => q.userAnswer || q.detectedAnswer?.answer).length}/{questionGroup.length} answered
                              </div>
                              <div>
                                {questionGroup.filter(q => q.marked).length}/{questionGroup.length} assessed
                              </div>
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

                                {/* Assessment Section */}
                                <div className="border-t pt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-medium text-sm">Assessment</h5>
                                    {question.marked && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm text-green-600 font-medium">
                                          {question.marksAwarded}/{question.marks} marks
                                        </span>
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                          <div 
                                            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                                            style={{ 
                                              width: `${question.marks > 0 ? (question.marksAwarded || 0) / question.marks * 100 : 0}%` 
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    {question.marked ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => viewAssessmentResult(question.id)}
                                          className="text-green-600 border-green-600 hover:bg-green-50"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          View Results
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => assessQuestion(question.id, true)}
                                          disabled={
                                            assessingQuestions.has(question.id) || 
                                            (!question.userAnswer?.trim() && !question.detectedAnswer?.answer?.trim())
                                          }
                                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                        >
                                          {assessingQuestions.has(question.id) ? (
                                            <>
                                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                              Re-assessing...
                                            </>
                                          ) : (
                                            <>
                                              <RotateCcw className="h-4 w-4 mr-2" />
                                              Re-assess
                                            </>
                                          )}
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                          Question assessed ({question.marksAwarded}/{question.marks} marks)
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => assessQuestion(question.id)}
                                          disabled={
                                            assessingQuestions.has(question.id) || 
                                            (!question.userAnswer?.trim() && !question.detectedAnswer?.answer?.trim())
                                          }
                                          className={question.marked 
                                            ? "bg-orange-600 hover:bg-orange-700 text-white" 
                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                          }
                                        >
                                          {assessingQuestions.has(question.id) ? (
                                            <>
                                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                              Assessing...
                                            </>
                                          ) : question.marked ? (
                                            <>
                                              <Eye className="h-4 w-4 mr-2" />
                                              View/Remark ({question.marksAwarded || 0}/{question.marks || 0})
                                            </>
                                          ) : (
                                            <>
                                              <Target className="h-4 w-4 mr-2" />
                                              Assess Answer
                                            </>
                                          )}
                                        </Button>
                                        {!question.userAnswer?.trim() && !question.detectedAnswer?.answer?.trim() && (
                                          <span className="text-xs text-muted-foreground">
                                            Answer required for assessment
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Mark All Button */}
                    <div className="pt-6 border-t space-y-3">
                      {/* Assessment Progress */}
                      <div className="text-center">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Questions Assessed</span>
                          <span>
                            {questions.filter(q => q.marked).length}/{questions.filter(q => q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim()).length} answered questions
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                            style={{ 
                              width: `${questions.filter(q => q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim()).length > 0 
                                ? (questions.filter(q => q.marked).length / questions.filter(q => q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim()).length) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={markAllQuestions}
                        className="w-full py-3 text-lg font-medium"
                        size="lg"
                        disabled={
                          questions.filter(q => q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim()).length === 0 ||
                          assessingQuestions.size > 0
                        }
                      >
                        {assessingQuestions.size > 0 ? (
                          <>
                            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                            Assessing {assessingQuestions.size} Questions...
                          </>
                        ) : (() => {
                          const questionsWithAnswers = questions.filter(q => q.userAnswer?.trim() || q.detectedAnswer?.answer?.trim())
                          const unmarkedQuestions = questionsWithAnswers.filter(q => !q.marked)
                          const markedQuestions = questionsWithAnswers.filter(q => q.marked)
                          
                          if (questionsWithAnswers.length === 0) {
                            return (
                              <>
                                <AlertCircle className="h-5 w-5 mr-2" />
                                No Answered Questions
                              </>
                            )
                          } else if (unmarkedQuestions.length === 0) {
                            return (
                              <>
                                <RotateCcw className="h-5 w-5 mr-2" />
                                Re-assess All Questions ({markedQuestions.length})
                              </>
                            )
                          } else if (markedQuestions.length === 0) {
                            return (
                              <>
                                <GraduationCap className="h-5 w-5 mr-2" />
                                Mark All Questions ({unmarkedQuestions.length})
                              </>
                            )
                          } else {
                            return (
                              <>
                                <GraduationCap className="h-5 w-5 mr-2" />
                                Mark Remaining Questions ({unmarkedQuestions.length} of {questionsWithAnswers.length})
                              </>
                            )
                          }
                        })()}
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

      {/* PDF Viewer Modal */}
      {showPdfViewer && currentPdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg w-[95vw] h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold truncate">{currentPdfName}</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = currentPdfUrl
                    link.download = currentPdfName
                    link.click()
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closePdfViewer}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* PDF Viewer Content */}
            <div className="flex-1 p-4">
              <iframe
                src={currentPdfUrl}
                className="w-full h-full border rounded"
                title={`PDF Viewer - ${currentPdfName}`}
                onError={(e) => {
                  console.error('PDF iframe error:', e)
                }}
                onLoad={() => {
                  console.log('PDF iframe loaded successfully')
                }}
              />
              {/* Fallback link in case iframe fails */}
              <div className="mt-2 text-center">
                <p className="text-sm text-muted-foreground">
                  PDF not displaying correctly?{' '}
                  <a 
                    href={currentPdfUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open in new tab
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Results Modal */}
      {showAssessmentModal && selectedAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-semibold">Assessment Results</h3>
                <p className="text-muted-foreground">Question {selectedAssessment.questionNumber}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedAssessment.marksAwarded}/{selectedAssessment.maxMarks}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAssessment.percentage}%
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAssessmentModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Your Answer */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Edit className="h-4 w-4 mr-2" />
                  Your Answer
                </h4>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {selectedAssessment.userAnswer}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Model Answer */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Model Answer
                </h4>
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {selectedAssessment.modelAnswer}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <MessageCircle className="h-4 w-4 mr-2 text-blue-600" />
                  Detailed Feedback
                </h4>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {selectedAssessment.feedback}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Keywords Analysis (if available) */}
              {(selectedAssessment.keywordMatches?.length > 0 || selectedAssessment.missingKeywords?.length > 0) && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <Target className="h-4 w-4 mr-2 text-orange-600" />
                    Keywords Analysis
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedAssessment.keywordMatches?.length > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                          ✓ Keywords Found
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {selectedAssessment.keywordMatches.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedAssessment.missingKeywords?.length > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <h5 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                          ✗ Missing Keywords
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {selectedAssessment.missingKeywords.map((keyword: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mark Scheme Details (if available) */}
              {selectedAssessment.markScheme && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-purple-600" />
                    Marking Criteria
                  </h4>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>
                        {selectedAssessment.markScheme.markingCriteria}
                      </ReactMarkdown>
                    </div>
                    {selectedAssessment.markScheme.markBreakdown && (
                      <div className="mt-3 pt-3 border-t">
                        <h6 className="text-sm font-medium mb-2">Mark Breakdown:</h6>
                        <pre className="text-xs bg-background p-2 rounded">
                          {JSON.stringify(selectedAssessment.markScheme.markBreakdown, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 flex justify-end">
              <Button onClick={() => setShowAssessmentModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
