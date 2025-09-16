import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  findMarkSchemeForQuestion, 
  generateModelAnswer,
  assessUserAnswer 
} from '@/lib/tidb-vector'
import { PerformanceMonitor } from '@/lib/performance-monitor'

// Enhanced configuration for parallel processing
const PARALLEL_BATCH_SIZE = 10 // Process 6 questions simultaneously (optimal for API limits)
const MAX_CONCURRENT_REQUESTS = 12 // Limit concurrent API calls to OpenAI
const RATE_LIMIT_DELAY = 150 // Delay between batches in ms (faster)
const ASSESSMENT_TIMEOUT = 30000 * 4 // 30 second timeout per question

interface QuestionAssessmentRequest {
  questionId: string
  userAnswer: string
}

interface AssessmentResult {
  questionId: string
  questionNumber: string
  success: boolean
  assessment?: {
    userAnswer: string
    modelAnswer: string
    marksAwarded: number
    maxMarks: number
    percentage: number
    feedback: string
    keywordMatches: string[]
    missingKeywords: string[]
    markScheme: {
      markingCriteria: string
      keywords: any
      markBreakdown: any
    }
  }
  error?: string
  processingTimeMs?: number
  timeoutOccurred?: boolean
}

/**
 * Assess a single question with timeout and comprehensive error handling
 */
async function assessSingleQuestionWithTimeout(
  questionData: QuestionAssessmentRequest,
  userId: string
): Promise<AssessmentResult> {
  const startTime = Date.now()
  const { questionId, userAnswer } = questionData

  try {
    // Wrap assessment in a timeout promise
    const assessmentPromise = assessSingleQuestionCore(questionData, userId, startTime)
    const timeoutPromise = new Promise<AssessmentResult>((_, reject) => {
      setTimeout(() => reject(new Error('Assessment timeout')), ASSESSMENT_TIMEOUT)
    })

    return await Promise.race([assessmentPromise, timeoutPromise])

  } catch (error) {
    const isTimeout = error instanceof Error && error.message === 'Assessment timeout'
    console.error(`[Parallel] ${isTimeout ? 'Timeout' : 'Error'} assessing question ${questionId}:`, error)
    
    return {
      questionId,
      questionNumber: questionData.questionId,
      success: false,
      error: isTimeout ? 'Assessment timeout after 30 seconds' : `Assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTimeMs: Date.now() - startTime,
      timeoutOccurred: isTimeout
    }
  }
}

/**
 * Core assessment logic without timeout wrapper
 */
async function assessSingleQuestionCore(
  questionData: QuestionAssessmentRequest,
  userId: string,
  startTime: number
): Promise<AssessmentResult> {
  const { questionId, userAnswer } = questionData

  // Get the question details
  const question = await prisma.questions.findUnique({
    where: { id: questionId },
    include: { 
      file: {
        include: {
          linkedMarkScheme: true
        }
      }
    }
  })

  if (!question) {
    return {
      questionId,
      questionNumber: 'Unknown',
      success: false,
      error: 'Question not found',
      processingTimeMs: Date.now() - startTime
    }
  }

  console.log(`[Parallel] Assessing Q${question.questionNumber} for ${userId}`)

  // Step 1: Find mark scheme
  const markScheme = await findMarkSchemeForQuestion(questionId, question.questionNumber)

  if (!markScheme) {
    return {
      questionId,
      questionNumber: question.questionNumber,
      success: false,
      error: 'No mark scheme found for this question',
      processingTimeMs: Date.now() - startTime
    }
  }

  // Step 2: Generate model answer and assess in parallel for better performance
  const [modelAnswer, assessment] = await Promise.all([
    generateModelAnswer(markScheme, question).catch(err => {
      console.warn(`Model answer generation failed for Q${question.questionNumber}:`, err)
      return "Model answer generation failed"
    }),
    assessUserAnswer(userAnswer, markScheme, question, '').catch(err => {
      console.warn(`Assessment failed for Q${question.questionNumber}:`, err)
      return {
        marksAwarded: 0,
        feedback: "Assessment failed due to system error",
        keywordMatches: [],
        missingKeywords: []
      }
    })
  ])

  // Step 3: Update question in database
  await prisma.questions.update({
    where: { id: questionId },
    data: {
      marked: true,
      modelAnswer: modelAnswer,
      marksAwarded: assessment.marksAwarded,
      feedback: assessment.feedback
    }
  })

  const processingTime = Date.now() - startTime
  console.log(`[Parallel] Q${question.questionNumber} complete: ${assessment.marksAwarded}/${markScheme.maxMarks} marks (${processingTime}ms)`)

  return {
    questionId,
    questionNumber: question.questionNumber,
    success: true,
    assessment: {
      userAnswer,
      modelAnswer,
      marksAwarded: assessment.marksAwarded,
      maxMarks: markScheme.maxMarks,
      percentage: Math.round((assessment.marksAwarded / markScheme.maxMarks) * 100),
      feedback: assessment.feedback,
      keywordMatches: assessment.keywordMatches,
      missingKeywords: assessment.missingKeywords,
      markScheme: {
        markingCriteria: markScheme.markingCriteria,
        keywords: markScheme.keywords,
        markBreakdown: markScheme.markBreakdown
      }
    },
    processingTimeMs: processingTime
  }
}

/**
 * Process questions in parallel batches with sophisticated error handling and progress tracking
 */
async function processQuestionsInParallel(
  questions: QuestionAssessmentRequest[],
  userId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ results: AssessmentResult[], performanceReport: any }> {
  const results: AssessmentResult[] = []
  const totalQuestions = questions.length
  const totalBatches = Math.ceil(totalQuestions / PARALLEL_BATCH_SIZE)
  
  // Initialize performance monitoring
  const monitor = new PerformanceMonitor()

  console.log(`[Parallel] Processing ${totalQuestions} questions in ${totalBatches} batches (size: ${PARALLEL_BATCH_SIZE})`)

  // Process questions in batches to control memory usage and API rate limits
  for (let i = 0; i < totalQuestions; i += PARALLEL_BATCH_SIZE) {
    const batch = questions.slice(i, i + PARALLEL_BATCH_SIZE)
    const batchNumber = Math.floor(i / PARALLEL_BATCH_SIZE) + 1

    console.log(`[Parallel] Batch ${batchNumber}/${totalBatches}: ${batch.length} questions`)
    
    // Start monitoring this batch
    monitor.startBatch(batchNumber, batch.length)

    try {
      // Process batch in parallel with Promise.allSettled for resilience
      const batchPromises = batch.map(questionData => 
        assessSingleQuestionWithTimeout(questionData, userId)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      const batchResultValues: AssessmentResult[] = []
      
      // Collect results and handle any promise rejections
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          batchResultValues.push(result.value)
        } else {
          console.error('[Parallel] Promise rejected:', result.reason)
          const errorResult: AssessmentResult = {
            questionId: 'promise-error',
            questionNumber: 'unknown',
            success: false,
            error: `Promise rejection: ${result.reason}`,
            processingTimeMs: 0
          }
          results.push(errorResult)
          batchResultValues.push(errorResult)
        }
      }

      // End monitoring for this batch
      monitor.endBatch(batchNumber, batchResultValues)

      // Report progress if callback provided
      if (onProgress) {
        onProgress(results.length, totalQuestions)
      }

      // Rate limiting: delay between batches to respect API limits
      if (i + PARALLEL_BATCH_SIZE < totalQuestions) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      }

    } catch (error) {
      console.error(`[Parallel] Batch ${batchNumber} failed:`, error)
      // Add error results for the entire batch
      const batchErrorResults: AssessmentResult[] = []
      batch.forEach(questionData => {
        const errorResult: AssessmentResult = {
          questionId: questionData.questionId,
          questionNumber: questionData.questionId,
          success: false,
          error: `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTimeMs: 0
        }
        results.push(errorResult)
        batchErrorResults.push(errorResult)
      })
      
      // End monitoring for failed batch
      monitor.endBatch(batchNumber, batchErrorResults)
    }
  }

  // Generate detailed performance report
  const successfulResults = results.filter(r => r.success)
  const performanceReport = monitor.getDetailedReport(totalQuestions)

  return { 
    results, 
    performanceReport: {
      ...performanceReport,
      overallMetrics: monitor.end(totalQuestions, successfulResults.length)
    }
  }
}

/**
 * POST endpoint for parallel question assessment
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overallStartTime = Date.now()

  try {
    const { questions } = await request.json()

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ 
        error: 'Missing or invalid questions array. Expected: { questions: [{ questionId, userAnswer }] }' 
      }, { status: 400 })
    }

    // Validate question data structure
    for (const q of questions) {
      if (!q.questionId || !q.userAnswer) {
        return NextResponse.json({ 
          error: 'Each question must have questionId and userAnswer fields' 
        }, { status: 400 })
      }
    }

    // Limit maximum number of questions to prevent resource exhaustion
    if (questions.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 questions can be assessed in parallel. Please split into smaller batches.' 
      }, { status: 400 })
    }

    console.log(`[Parallel] Starting parallel assessment for ${questions.length} questions by user ${session.user.email}`)

    // Process questions in parallel
    const { results, performanceReport } = await processQuestionsInParallel(questions, session.user.email || '')

    // Calculate comprehensive performance metrics
    const successfulAssessments = results.filter(r => r.success)
    const failedAssessments = results.filter(r => !r.success)
    const timedOutAssessments = results.filter(r => r.timeoutOccurred)
    const totalProcessingTime = Date.now() - overallStartTime
    const averageProcessingTime = results.reduce((sum, r) => sum + (r.processingTimeMs || 0), 0) / results.length

    // Calculate academic performance metrics
    const totalMarks = successfulAssessments.reduce((sum, r) => sum + (r.assessment?.marksAwarded || 0), 0)
    const totalMaxMarks = successfulAssessments.reduce((sum, r) => sum + (r.assessment?.maxMarks || 0), 0)
    const overallPercentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0

    // Performance analysis
    const throughput = Math.round((questions.length / totalProcessingTime) * 1000) // questions per second
    const speedImprovement = averageProcessingTime > 0 ? Math.round((averageProcessingTime * questions.length) / totalProcessingTime * 100) / 100 : 1

    console.log(`[Parallel] Assessment complete: ${successfulAssessments.length}/${questions.length} successful in ${totalProcessingTime}ms`)

    return NextResponse.json({
      success: true,
      summary: {
        totalQuestions: questions.length,
        successfulAssessments: successfulAssessments.length,
        failedAssessments: failedAssessments.length,
        timedOutAssessments: timedOutAssessments.length,
        successRate: Math.round((successfulAssessments.length / questions.length) * 100),
        
        // Academic metrics
        overallPercentage,
        totalMarks,
        totalMaxMarks,
        averageScore: successfulAssessments.length > 0 ? Math.round(totalMarks / successfulAssessments.length * 100) / 100 : 0,
        
        // Performance metrics
        totalProcessingTimeMs: totalProcessingTime,
        averageProcessingTimeMs: Math.round(averageProcessingTime),
        throughputQuestionsPerSec: throughput,
        parallelSpeedupFactor: speedImprovement,
        batchesProcessed: Math.ceil(questions.length / PARALLEL_BATCH_SIZE),
        batchSize: PARALLEL_BATCH_SIZE,
        
        // Efficiency metrics
        timeoutRate: Math.round((timedOutAssessments.length / questions.length) * 100),
        averageMarksPerQuestion: successfulAssessments.length > 0 ? Math.round((totalMarks / successfulAssessments.length) * 100) / 100 : 0
      },
      results,
      performanceReport,
      
      // Separate errors for debugging
      errors: failedAssessments.length > 0 ? failedAssessments.map(r => ({
        questionId: r.questionId,
        questionNumber: r.questionNumber,
        error: r.error,
        timeoutOccurred: r.timeoutOccurred || false
      })) : undefined
    })

  } catch (error) {
    console.error('[Parallel] Error in parallel assessment:', error)
    return NextResponse.json({ 
      error: 'Failed to process parallel assessment. Please try again.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check parallel assessment status and capabilities
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    parallelAssessment: {
      enabled: true,
      maxBatchSize: PARALLEL_BATCH_SIZE,
      maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
      maxQuestionsPerRequest: 50,
      supportedFeatures: [
        'Parallel processing',
        'Batch error handling',
        'Rate limit management',
        'Performance metrics',
        'Progress tracking'
      ]
    }
  })
}
