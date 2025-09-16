import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { 
  executeVectorSQL, 
  generateEmbedding, 
  findMarkSchemeForQuestion,
  generateModelAnswer,
  assessUserAnswer 
} from '@/lib/tidb-vector'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define structured response schemas (OpenAI Structured Outputs format)
const ExplanationResponse = z.object({
  type: z.literal('explanation'),
  explanation: z.string().describe('Detailed explanation of the concept, method, or solution. Should be comprehensive and educational.'),
  keyPoints: z.array(z.string()).describe('3-5 key points or takeaways that summarize the main concepts'),
  examples: z.array(z.string()).optional().describe('Practical examples or analogies to illustrate the concept'),
  followUpQuestions: z.array(z.string()).optional().describe('2-3 suggested questions for further learning'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('Complexity level of the explanation')
})

const AnswerResponse = z.object({
  type: z.literal('answer'),
  answer: z.string().describe('Clear, direct answer to the question or problem'),
  workingSteps: z.array(z.string()).optional().describe('Detailed step-by-step solution process'),
  confidence: z.number().min(0).max(100).describe('Confidence level in the answer (0-100)'),
  assumptions: z.array(z.string()).optional().describe('Any assumptions made in solving the problem'),
  alternativeApproaches: z.array(z.string()).optional().describe('Alternative methods or approaches to solve the problem')
})

const AssessmentResponse = z.object({
  type: z.literal('assessment'),
  feedback: z.string().describe('Detailed, constructive feedback on the student\'s answer'),
  marksAwarded: z.number().min(0).describe('Marks awarded for the answer'),
  maxMarks: z.number().min(0).describe('Maximum marks available for the question'),
  percentage: z.number().min(0).max(100).describe('Percentage score achieved'),
  improvements: z.array(z.string()).describe('Specific suggestions for how to improve the answer'),
  keywordMatches: z.array(z.string()).describe('Important keywords or concepts correctly identified'),
  missingElements: z.array(z.string()).optional().describe('Key elements that were missing from the answer'),
  strengths: z.array(z.string()).optional().describe('What the student did well')
})

const GeneralResponse = z.object({
  type: z.literal('general'),
  response: z.string().describe('Helpful, encouraging conversational response'),
  suggestions: z.array(z.string()).optional().describe('Actionable suggestions or tips for the student'),
  encouragement: z.string().optional().describe('Motivational or encouraging message'),
  nextSteps: z.array(z.string()).optional().describe('Recommended next actions or study steps')
})

const ChatResponse = z.discriminatedUnion('type', [
  ExplanationResponse,
  AnswerResponse,
  AssessmentResponse,
  GeneralResponse
])

// Define function schemas for tool calling (OpenAI Responses API format)
const tools = [
  {
    type: "function" as const,
    name: "search_similar_questions",
    description: "Search for similar questions in the current session. Can search by semantic similarity, exact question number, or both. Use this when the user asks about finding related questions, wants to practice similar problems, or references specific question numbers.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find similar questions. Should be descriptive of the topic or concept."
        },
        questionNumber: {
          type: ["string", "null"],
          description: "Specific question number to search for (e.g., '1', '2a', '3b'). If provided, will prioritize exact matches."
        },
        limit: {
          type: ["number", "null"],
          description: "Number of results to return (1-10). If not provided, defaults to 5.",
          minimum: 1,
          maximum: 10
        }
      },
      required: ["query", "questionNumber", "limit"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "get_question_details",
    description: "Get detailed information about a specific question including text, marks, type, and current answer status. Use this when user refers to a specific question.",
    parameters: {
      type: "object",
      properties: {
        questionId: {
          type: "string",
          description: "The unique ID of the question to retrieve details for"
        }
      },
      required: ["questionId"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "assess_user_answer",
    description: "Assess and grade a user's answer against the mark scheme. Use this when user wants feedback on their answer or asks for assessment.",
    parameters: {
      type: "object",
      properties: {
        questionId: {
          type: "string",
          description: "The unique ID of the question being answered"
        },
        userAnswer: {
          type: "string",
          description: "The complete answer provided by the user to be assessed"
        }
      },
      required: ["questionId", "userAnswer"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "get_mark_scheme",
    description: "Retrieve the marking criteria and expected answers for a specific question. Use when user asks about marking criteria or expected answers.",
    parameters: {
      type: "object",
      properties: {
        questionNumber: {
          type: "string",
          description: "The question number (e.g., '1a', '2b', '3') to find the mark scheme for"
        }
      },
      required: ["questionNumber"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function" as const,
    name: "generate_model_answer",
    description: "Generate a comprehensive model answer for a specific question based on the mark scheme. Use when user asks for the correct answer or solution.",
    parameters: {
      type: "object",
      properties: {
        questionId: {
          type: "string",
          description: "The unique ID of the question to generate a model answer for"
        }
      },
      required: ["questionId"],
      additionalProperties: false
    },
    strict: true
  }
]

// Tool implementations
async function searchSimilarQuestions(sessionId: string, query: string, questionNumber?: string | null, limit: number = 5, currentFileId?: string | null) {
  try {
    // First, try to extract question number from query if not explicitly provided
    let detectedQuestionNumber = questionNumber
    
    if (!detectedQuestionNumber) {
      // Try to extract question number from the query using regex
      const questionNumberRegex = /(?:question\s+)?(\d+[a-z]*(?:\([a-z]+\))?)/i
      const match = query.match(questionNumberRegex)
      if (match) {
        detectedQuestionNumber = match[1]
        console.log(`Auto-detected question number from query: ${detectedQuestionNumber}`)
      }
    }
    
    // Build base where clause
    const baseWhere = {
      file: {
        processorSessionId: sessionId,
        ...(currentFileId ? { id: currentFileId } : {}) // Filter by current file if provided
      }
    }
    
    // If we have a question number (provided or detected), prioritize exact question number matches
    if (detectedQuestionNumber) {
      console.log(`Searching for question number: ${detectedQuestionNumber}${currentFileId ? ` in file: ${currentFileId}` : ''}`)
      
      // First try exact match
      const exactMatch = await prisma.questions.findMany({
        where: {
          ...baseWhere,
          questionNumber: detectedQuestionNumber
        },
        include: {
          file: {
            select: {
              name: true
            }
          }
        },
        take: limit
      })
      
      if (exactMatch.length > 0) {
        console.log(`Found ${exactMatch.length} exact matches for question ${detectedQuestionNumber}`)
        return exactMatch.map((q: any) => ({
          ...q,
          similarity: 0, // Perfect match
          searchType: 'exact_number'
        }))
      }
      
      // If no exact match, try partial match (e.g., "2" should match "2a", "2b")
      const partialMatches = await prisma.questions.findMany({
        where: {
          ...baseWhere,
          questionNumber: {
            startsWith: detectedQuestionNumber
          }
        },
        include: {
          file: {
            select: {
              name: true
            }
          }
        },
        take: limit
      })
      
      if (partialMatches.length > 0) {
        console.log(`Found ${partialMatches.length} partial matches for question ${detectedQuestionNumber}`)
        return partialMatches.map((q: any) => ({
          ...q,
          similarity: 0.1, // Very close match
          searchType: 'partial_number'
        }))
      }
      
      console.log(`No exact or partial matches found for question ${detectedQuestionNumber}, falling back to vector search`)
    }
    
    // Fallback: Generate embedding for the search query (vector search)
    console.log(`Performing vector search with query: ${query}${currentFileId ? ` in file: ${currentFileId}` : ''}`)
    const queryEmbedding = await generateEmbedding(query)
    const vectorString = `[${queryEmbedding.join(',')}]`
    
    // Search for similar questions using vector similarity
    const similarQuestions = await executeVectorSQL(`
      SELECT 
        q.id,
        q.questionNumber,
        q.question,
        q.type,
        q.maxMarks,
        q.isMultipleChoice,
        q.answer,
        q.marked,
        q.marksAwarded,
        VEC_COSINE_DISTANCE(q.vectorEmbedding, ?) as similarity
      FROM Questions q
      JOIN File f ON q.fileId = f.id
      JOIN ProcessorSession ps ON f.processorSessionId = ps.id
      WHERE ps.id = ? AND q.vectorEmbedding IS NOT NULL
      ${currentFileId ? 'AND f.id = ?' : ''}
      ORDER BY similarity ASC
      LIMIT ?
    `, currentFileId ? [vectorString, sessionId, currentFileId, limit] : [vectorString, sessionId, limit])
    
    return similarQuestions.map((q: any) => ({
      ...q,
      searchType: 'vector_similarity'
    }))
  } catch (error) {
    console.error('Error searching similar questions:', error)
    return []
  }
}

async function getQuestionDetails(questionId: string) {
  try {
    const question = await prisma.questions.findUnique({
      where: { id: questionId },
      include: {
        file: true
      }
    })
    return question
  } catch (error) {
    console.error('Error getting question details:', error)
    return null
  }
}

async function getMarkSchemeForQuestion(questionNumber: string, sessionId: string, currentFileId?: string | null) {
  try {
    const markScheme = await prisma.msQuestions.findFirst({
      where: {
        questionNumber: questionNumber,
        file: {
          processorSession: {
            id: sessionId
          },
          ...(currentFileId ? { linkedMarkSchemeId: currentFileId } : {}) // Find mark scheme linked to current file
        }
      }
    })
    return markScheme
  } catch (error) {
    console.error('Error getting mark scheme:', error)
    return null
  }
}

// Helper function to truncate large outputs
function truncateOutput(result: any, maxLength: number = 50000): any {
  const resultString = JSON.stringify(result)
  
  if (resultString.length <= maxLength) {
    return result
  }
  
  console.warn(`Function result too large (${resultString.length} chars), truncating to ${maxLength} chars`)
  
  // If it's an array, truncate the array and add a note
  if (Array.isArray(result)) {
    const truncatedArray = []
    let currentLength = 0
    
    for (const item of result) {
      const itemString = JSON.stringify(item)
      if (currentLength + itemString.length > maxLength - 1000) { // Leave room for metadata
        break
      }
      truncatedArray.push(item)
      currentLength += itemString.length
    }
    
    return {
      data: truncatedArray,
      truncated: true,
      originalLength: result.length,
      truncatedLength: truncatedArray.length,
      note: `Results truncated due to size. Showing ${truncatedArray.length} of ${result.length} items.`
    }
  }
  
  // If it's an object, try to truncate string fields
  if (typeof result === 'object' && result !== null) {
    const truncatedResult = { ...result }
    
    // Truncate long string values
    for (const [key, value] of Object.entries(truncatedResult)) {
      if (typeof value === 'string' && value.length > 10000) {
        truncatedResult[key] = value.substring(0, 10000) + '... [truncated]'
      }
    }
    
    const newResultString = JSON.stringify(truncatedResult)
    if (newResultString.length <= maxLength) {
      return {
        ...truncatedResult,
        truncated: true,
        note: 'Some string fields were truncated due to size.'
      }
    }
  }
  
  // Fallback: return summary
  return {
    error: 'Result too large to include',
    type: typeof result,
    isArray: Array.isArray(result),
    length: Array.isArray(result) ? result.length : undefined,
    truncated: true,
    originalSize: resultString.length,
    note: 'Result was too large to include in response. Consider using more specific queries.'
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { message, sessionId, conversationHistory = [], currentPaper = null } = await request.json()

    if (!message || !sessionId) {
      return NextResponse.json({ 
        error: 'Missing required fields: message and sessionId' 
      }, { status: 400 })
    }

    // Get session context
    const sessionData = await prisma.processorSession.findUnique({
      where: { id: sessionId },
      include: {
        files: {
          include: {
            questions: true,
            msQuestions: true
          }
        }
      }
    })

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Build context about the session
    const contextInfo = {
      totalFiles: sessionData.files.length,
      questionPapers: sessionData.files.filter(f => f.type === 'qsPaper').length,
      markSchemes: sessionData.files.filter(f => f.type === 'markScheme').length,
      totalQuestions: sessionData.files.reduce((acc, f) => acc + f.questions.length, 0),
      totalMarkSchemes: sessionData.files.reduce((acc, f) => acc + f.msQuestions.length, 0)
    }

    // Create input list for OpenAI (following the function calling example format)
    const input = [
      {
        role: "system" as const,
        content: `You are an expert AI tutor helping a student with exam preparation. You are knowledgeable, patient, encouraging, and provide detailed explanations.

Response Guidelines:
- Use tools when they would provide better, more accurate information
- Be encouraging and supportive in your feedback
- Provide clear explanations with step-by-step reasoning
- Include examples and analogies when helpful
- Suggest practice strategies and study tips

Response Types (choose the most appropriate):
- "explanation": For teaching concepts, explaining methods, or providing detailed breakdowns
- "answer": For direct solutions with clear working steps and confidence levels
- "assessment": When evaluating student work with marks, feedback, and improvement suggestions
- "general": For conversational responses, encouragement, and general guidance

Always aim to help the student learn and improve their understanding.`
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.message
      })),
      {
        role: 'user' as const,
        content: message
      }
    ]

    // Call OpenAI with function calling (using responses API)
    let response = await openai.responses.create({
      model: 'gpt-5-mini',
      reasoning: {effort: "medium"},
      instructions: `You are an expert AI tutor helping a student with exam preparation. Provide clear, supportive, and educational responses. Use the function call results to enhance your answers and ensure accuracy. Make your responses presentable and easy to understand.

CRITICAL: Always use the available tools when they can provide better information. Don't ask for clarification when you can use tools to find the answer.

Current Session Context:
- Session ID: ${sessionId}
- Total Files: ${contextInfo.totalFiles}
- Question Papers: ${contextInfo.questionPapers}
- Mark Schemes: ${contextInfo.markSchemes}
- Total Questions: ${contextInfo.totalQuestions}
- Available Mark Schemes: ${contextInfo.totalMarkSchemes}

Currently Working On:
${currentPaper ? `- Paper: ${currentPaper.filename}
- Document Type: ${currentPaper.documentType === 'qsPaper' ? 'Question Paper' : 'Mark Scheme'}
- Status: ${currentPaper.status}
- Questions in this paper: ${currentPaper.totalQuestions || 'Unknown'}
- Processing: ${currentPaper.processingTime || 'N/A'}
${currentPaper.linkedMarkSchemeId ? '- Has linked mark scheme: Yes' : '- Has linked mark scheme: No'}` : '- No specific paper selected'}

TOOL USAGE RULES (Priority Order):
1. **Question Number Search FIRST**: When user mentions any question number (like "question 1", "2a", "3b", "explain question 5"):
   - ALWAYS use search_similar_questions with the questionNumber parameter
   - The system automatically detects question numbers from queries like "explain question 1" → extracts "1"
   - This searches for exact matches first, then partial matches (e.g., "2" finds "2a", "2b")
   - **Now searches ONLY in the current working paper/file for focused results**
   - Only falls back to semantic search if no question number matches found

2. **Semantic Search as Fallback**: When no question number is mentioned OR no question number results found:
   - Use search_similar_questions with descriptive query for topic-based search
   - **Now limited to current working paper for relevant results**
   - Examples: "calculus questions", "integration problems", "trigonometry"

3. **Follow-up Tools**: After finding questions, use other tools as needed:
   - get_question_details: Get full question text and details  
   - assess_user_answer: Evaluate student answers with feedback
   - get_mark_scheme: Get marking criteria and rubrics **for the current paper**
   - generate_model_answer: Provide model solutions

Available Tools:
- search_similar_questions: Find questions by number OR topic (use questionNumber param for specific questions like "1", "2a")
- get_question_details: Get full question text and details  
- assess_user_answer: Evaluate student answers with feedback
- get_mark_scheme: Get marking criteria and rubrics
- generate_model_answer: Provide model solutions

REMEMBER: If there's a current paper loaded and user mentions a question number, search for it immediately using the tools rather than asking for clarification.`,
      input: input,
      tools: tools,
    })

    if (!response) {
      throw new Error('No response from OpenAI')
    }

    // Function call loop - continue until we get a normal response
    let maxIterations = 10 // Prevent infinite loops
    let iteration = 0
    const allToolResults: any[] = []
    const allToolsUsed: string[] = []

    while (iteration < maxIterations) {
      iteration++
      console.log(`Function call iteration ${iteration}`)
      
      // First, add all items from the response output to input (as per OpenAI docs)
      input.push(...(response.output || []))
      
      // Check if there are any function calls in this response
      let functionCallsInThisResponse = false
      const toolResultsThisIteration: any[] = []
      
      // Process all items in response.output to execute function calls
      for (const item of response.output || []) {
        if (item.type === "function_call") {
          console.log(`Function call found: ${item.name}`)
          functionCallsInThisResponse = true
          allToolsUsed.push(item.name)
          
          const functionName = item.name
          let functionArgs
          
          try {
            functionArgs = JSON.parse(item.arguments || '{}')
          } catch (parseError) {
            console.error('Error parsing function arguments:', parseError)
            input.push({
              type: "function_call_output",
              call_id: item.call_id,
              output: JSON.stringify({ error: 'Invalid function arguments' })
            })
            continue
          }
          
          let functionResult = null
          
          try {
            switch (functionName) {
              case 'search_similar_questions':
                functionResult = await searchSimilarQuestions(
                  sessionId, 
                  functionArgs.query, 
                  functionArgs.questionNumber || null,
                  functionArgs.limit || 5,
                  currentPaper?.id || null
                )
                break
                
              case 'get_question_details':
                functionResult = await getQuestionDetails(functionArgs.questionId)
                break
                
              case 'assess_user_answer':
                const question = await getQuestionDetails(functionArgs.questionId)
                if (question) {
                  const markScheme = await findMarkSchemeForQuestion(
                    functionArgs.questionId,
                    currentPaper?.linkedMarkSchemeId || undefined
                  )
                  if (markScheme) {
                    const modelAnswer = await generateModelAnswer(markScheme, question)
                    functionResult = await assessUserAnswer(
                      functionArgs.userAnswer,
                      markScheme,
                      question,
                      modelAnswer
                    )
                  } else {
                    functionResult = { error: 'No mark scheme found for this question' }
                  }
                } else {
                  functionResult = { error: 'Question not found' }
                }
                break
                
              case 'get_mark_scheme':
                functionResult = await getMarkSchemeForQuestion(
                  functionArgs.questionNumber, 
                  sessionId,
                  currentPaper?.id || null
                )
                break
                
              case 'generate_model_answer':
                const questionForAnswer = await getQuestionDetails(functionArgs.questionId)
                if (questionForAnswer) {
                  const markSchemeForAnswer = await findMarkSchemeForQuestion(
                    functionArgs.questionId,
                    currentPaper?.linkedMarkSchemeId || undefined
                  )
                  if (markSchemeForAnswer) {
                    functionResult = await generateModelAnswer(markSchemeForAnswer, questionForAnswer)
                  } else {
                    functionResult = { error: 'No mark scheme found for this question' }
                  }
                } else {
                  functionResult = { error: 'Question not found' }
                }
                break
                
              default:
                functionResult = { error: `Unknown function: ${functionName}` }
            }
          } catch (functionError: any) {
            console.error(`Error executing function ${functionName}:`, functionError)
            functionResult = { error: `Function execution failed: ${functionError?.message || 'Unknown error'}` }
          }
          
          // Add function result to input for next call
          const truncatedResult = truncateOutput(functionResult)
          input.push({
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(truncatedResult || { error: 'No result' })
          })
          
          toolResultsThisIteration.push(functionResult)
        }
      }
      
      // Add this iteration's results to the overall results
      allToolResults.push(...toolResultsThisIteration)
      
      // If no function calls were found in this response, we're done
      if (!functionCallsInThisResponse) {
        console.log('No more function calls found, returning final response')
        const finalText = response.output_text || 'I apologize, but I encountered an issue processing your request.'
        
        return NextResponse.json({
          success: true,
          response: {
            type: 'general',
            response: finalText
          },
          toolsUsed: [...new Set(allToolsUsed)], // Remove duplicates
          toolResults: allToolResults,
          iterations: iteration
        })
      }
      
      // Make another call with the updated input (including function results)
      console.log(`Making follow-up call with ${input.length} input items`)
      response = await openai.responses.create({
        model: 'gpt-5-mini',
        reasoning: {effort: "medium"},
        instructions: "Continue processing. Use the function call results to provide a comprehensive response to the user. If you need more information, feel free to make additional function calls. When you have enough information, provide a final helpful response.",
        input: input,
        tools: tools,
      })
      
      if (!response) {
        throw new Error('No response from OpenAI in iteration ' + iteration)
      }
    }
    
    // If we hit the max iterations, return what we have
    console.log('Hit maximum iterations, returning current response')
    const finalText = response.output_text || 'I apologize, but I encountered an issue processing your request after multiple attempts.'
    
    return NextResponse.json({
      success: true,
      response: {
        type: 'general',
        response: finalText
      },
      toolsUsed: [...new Set(allToolsUsed)],
      toolResults: allToolResults,
      iterations: iteration,
      warning: 'Hit maximum iteration limit'
    })

  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json({ 
      error: 'Failed to process chat message' 
    }, { status: 500 })
  }
}
