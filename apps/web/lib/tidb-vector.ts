/**
 * TiDB Vector Utilities for OCR QnA Application
 * 
 * This module provides utilities for working with TiDB's native VECTOR data type.
 * Since Prisma doesn't directly support TiDB's VECTOR type, we store embeddings 
 * as strings and use raw SQL for vector operations.
 * 
 * Key Functions:
 * - vectorToString: Convert number array to TiDB VECTOR format
 * - stringToVector: Parse TiDB VECTOR string back to number array  
 * - executeVectorSQL: Execute raw SQL for vector operations
 * - generateEmbedding: Create embeddings using OpenAI
 * - insertQuestionWithVector: Store question and embedding in TiDB
 * - searchSimilarQuestions: Perform semantic search using cosine similarity
 */

import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod.mjs'
import { z } from 'zod'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Convert a number array to TiDB VECTOR string format
 * 
 * @param vector - Array of numbers representing the embedding
 * @returns String in format "[0.1,0.2,0.3,...]" for TiDB VECTOR column
 * 
 * Example: [0.1, 0.2, 0.3] → "[0.1,0.2,0.3]"
 */
export function vectorToString(vector: number[]): string {
  return `[${vector.join(',')}]`
}

/**
 * Parse TiDB VECTOR string back to number array
 * 
 * @param vectorString - String from TiDB VECTOR column
 * @returns Array of numbers representing the embedding
 * 
 * Example: "[0.1,0.2,0.3]" → [0.1, 0.2, 0.3]
 */
export function stringToVector(vectorString: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorString.replace(/^\[|\]$/g, '')
  return cleaned.split(',').map(num => parseFloat(num.trim()))
}

/**
 * Execute raw SQL queries for vector operations
 * This bypasses Prisma's limitations with TiDB VECTOR type
 * 
 * @param query - SQL query string with ? placeholders
 * @param params - Parameters to bind to the query
 * @returns Query results as array of objects
 * 
 * Example: executeVectorSQL('SELECT * FROM Questions WHERE id = ?', ['123'])
 */
export async function executeVectorSQL(query: string, params: any[] = []): Promise<any[]> {
  try {
    return await prisma.$queryRawUnsafe(query, ...params)
  } catch (error) {
    console.error('Vector SQL execution failed:', error)
    throw new Error(`Vector SQL Error: ${error}`)
  }
}

/**
 * Generate vector embedding using OpenAI's text-embedding-3-small model
 * 
 * @param text - Text to convert to embedding
 * @param dimensions - Optional dimension reduction (default: 1536)
 * @returns Array of numbers representing the text embedding
 * 
 * This function handles API errors gracefully and provides fallback options
 */
export async function generateEmbedding(
  text: string, 
  dimensions: number = 1536
): Promise<number[]> {
  try {
    // Truncate text to avoid token limits
    const truncatedText = text.substring(0, 8000)
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
      dimensions: dimensions, // Use dimension reduction for better performance
    }) as any

    return response.data[0].embedding
  } catch (error) {
    console.error('OpenAI embedding generation failed:', error)
    
    // Fallback: generate mock embedding if OpenAI fails
    console.warn('Using mock embedding as fallback')
    return generateMockEmbedding(dimensions)
  }
}

/**
 * Generate a mock embedding for testing/fallback purposes
 * 
 * @param dimensions - Number of dimensions for the embedding
 * @returns Normalized random vector
 * 
 * Used when OpenAI API is unavailable or for testing
 */
export function generateMockEmbedding(dimensions: number = 1536): number[] {
  const vector = Array.from({ length: dimensions }, () => Math.random() - 0.5)
  
  // Normalize the vector to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(val => val / magnitude)
}

/**
 * Insert a question with its vector embedding into TiDB
 * This combines Prisma for basic data and raw SQL for vector storage
 * 
 * @param questionData - Question data matching your Zod schema
 * @param fileId - ID of the source file
 * @returns Object with question ID and embedding confirmation
 * 
 * Steps:
 * 1. Generate embedding from semantic summary
 * 2. Insert question data using Prisma  
 * 3. Update with vector embedding using raw SQL
 */
export async function insertQuestionWithVector(
  questionData: {
    questionNumber: string
    question: string
    type: string
    parentQuestionNumber?: string | null
    isMultipleChoice: boolean
    imageDescription?: string
    answer: any
    maxMarks: number
    pageNumber: number
    semanticSummary: string
  },
  fileId: string
): Promise<{ questionId: string; embeddingStored: boolean }> {
  try {
    // Step 1: Generate vector embedding from semantic summary
    const embedding = await generateEmbedding(questionData.semanticSummary)
    const vectorString = vectorToString(embedding)

    // Step 2: Insert question using Prisma (without vector)
    const question = await prisma.questions.create({
      data: {
        questionNumber: questionData.questionNumber,
        question: questionData.question,
        type: questionData.type,
        parentQuestionNumber: questionData.parentQuestionNumber,
        isMultipleChoice: questionData.isMultipleChoice,
        imageDescription: questionData.imageDescription,
        answer: questionData.answer,
        maxMarks: questionData.maxMarks,
        pageNumber: questionData.pageNumber,
        semanticSummary: questionData.semanticSummary,
        fileId: fileId,
      }
    })

    // Step 3: Update with vector embedding using raw SQL
    await executeVectorSQL(`
      UPDATE Questions 
      SET vectorEmbedding = ?
      WHERE id = ?
    `, [vectorString, question.id])

    return {
      questionId: question.id,
      embeddingStored: true
    }
  } catch (error) {
    console.error('Failed to insert question with vector:', error)
    throw new Error(`Question insertion failed: ${error}`)
  }
}

/**
 * Search for similar questions using TiDB's vector similarity
 * 
 * @param searchQuery - Natural language query
 * @param fileId - Optional: limit search to specific file
 * @param limit - Maximum number of results to return
 * @param threshold - Minimum similarity score (0-1)
 * @returns Array of similar questions with similarity scores
 * 
 * Uses TiDB's vec_cosine_distance function for efficient similarity search
 */
export async function searchSimilarQuestions(
  searchQuery: string,
  fileId?: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<Array<{
  id: string
  questionNumber: string
  question: string
  type: string
  similarity: number
  semanticSummary: string
  pageNumber: number
}>> {
  try {
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery)
    const queryVectorString = vectorToString(queryEmbedding)

    // Build SQL query with optional file filtering
    const fileFilter = fileId ? 'AND fileId = ?' : ''
    const params = [
      queryVectorString, // for distance calculation
      queryVectorString, // for similarity calculation
      ...(fileId ? [fileId] : []),
      queryVectorString, // for WHERE clause
      threshold,
      limit
    ]

    const searchSQL = `
      SELECT 
        id,
        questionNumber,
        question,
        type,
        semanticSummary,
        pageNumber,
        vec_cosine_distance(vectorEmbedding, ?) as distance,
        (1 - vec_cosine_distance(vectorEmbedding, ?)) as similarity
      FROM Questions
      WHERE vectorEmbedding IS NOT NULL
        ${fileFilter}
        AND (1 - vec_cosine_distance(vectorEmbedding, ?)) >= ?
      ORDER BY distance ASC
      LIMIT ?
    `

    const results = await executeVectorSQL(searchSQL, params)

    return results.map((row: any) => ({
      id: row.id,
      questionNumber: row.questionNumber,
      question: row.question,
      type: row.type,
      semanticSummary: row.semanticSummary,
      pageNumber: row.pageNumber,
      similarity: Math.round(row.similarity * 10000) / 10000, // Round to 4 decimals
    }))
  } catch (error) {
    console.error('Vector search failed:', error)
    throw new Error(`Search failed: ${error}`)
  }
}

/**
 * Batch insert multiple questions with vector embeddings
 * More efficient for processing large documents
 * 
 * @param questionsData - Array of question objects
 * @param fileId - ID of the source file
 * @returns Summary of insertion results
 * 
 * Processes questions in batches to avoid overwhelming the API
 */
export async function batchInsertQuestionsWithVectors(
  questionsData: Array<{
    questionNumber: string
    question: string
    type: string
    parentQuestionNumber?: string
    isMultipleChoice: boolean
    imageDescription?: string
    answer: any,
    maxMarks: number,
    pageNumber: number
    semanticSummary: string
  }>,
  fileId: string
): Promise<{
  totalProcessed: number
  successful: number
  failed: number
  questionIds: string[]
}> {
  const results = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    questionIds: [] as string[]
  }

  // Process in batches of 5 to avoid API rate limits
  const batchSize = 10
  for (let i = 0; i < questionsData.length; i += batchSize) {
    const batch = questionsData.slice(i, i + batchSize)
    
    for (const questionData of batch) {
      try {
        const result = await insertQuestionWithVector(questionData, fileId)
        results.successful++
        results.questionIds.push(result.questionId)
      } catch (error) {
        console.error(`Failed to insert question ${questionData.questionNumber}:`, error)
        results.failed++
      }
      results.totalProcessed++
    }

    // Small delay between batches to respect API limits
    if (i + batchSize < questionsData.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Insert a mark scheme with its vector embedding into TiDB
 * Similar to insertQuestionWithVector but for mark schemes
 * 
 * @param markSchemeData - Mark scheme data
 * @param fileId - ID of the source file
 * @returns Object with mark scheme ID and embedding confirmation
 */
export async function insertMarkSchemeWithVector(
  markSchemeData: {
    questionNumber: string
    parentQuestionNumber?: string | null
    markingCriteria: string
    maxMarks: number
    markBreakdown?: any
    acceptableAnswers?: string[]
    keywords?: string[]
    pageNumber: number
    semanticSummary: string
  },
  fileId: string
): Promise<{ markSchemeId: string; embeddingStored: boolean }> {
  try {
    // Step 1: Generate vector embedding from semantic summary
    const embedding = await generateEmbedding(markSchemeData.semanticSummary)
    const vectorString = vectorToString(embedding)

    // Step 2: Insert mark scheme using Prisma (without vector)
    const markScheme = await prisma.msQuestions.create({
      data: {
        questionNumber: markSchemeData.questionNumber,
        parentQuestionNumber: markSchemeData.parentQuestionNumber,
        markingCriteria: markSchemeData.markingCriteria,
        maxMarks: markSchemeData.maxMarks,
        markBreakdown: markSchemeData.markBreakdown,
        acceptableAnswers: markSchemeData.acceptableAnswers,
        keywords: markSchemeData.keywords,
        pageNumber: markSchemeData.pageNumber,
        semanticSummary: markSchemeData.semanticSummary,
        fileId: fileId,
      }
    })

    // Step 3: Update with vector embedding using raw SQL
    await executeVectorSQL(`
      UPDATE MsQuestions 
      SET vectorEmbedding = ?
      WHERE id = ?
    `, [vectorString, markScheme.id])

    return {
      markSchemeId: markScheme.id,
      embeddingStored: true
    }
  } catch (error) {
    console.error('Failed to insert mark scheme with vector:', error)
    throw new Error(`Mark scheme insertion failed: ${error}`)
  }
}

/**
 * Batch insert multiple mark schemes with vector embeddings
 * 
 * @param markSchemesData - Array of mark scheme objects
 * @param fileId - ID of the source file
 * @returns Summary of insertion results
 */
export async function batchInsertMarkSchemesWithVectors(
  markSchemesData: Array<{
    questionNumber: string
    parentQuestionNumber: string | null
    markingCriteria: string
    maxMarks: number
    markBreakdown?: any
    acceptableAnswers?: string[]
    keywords?: string[]
    pageNumber: number
    semanticSummary: string
  }>,
  fileId: string
): Promise<{
  totalProcessed: number
  successful: number
  failed: number
  markSchemeIds: string[]
}> {
  const results = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    markSchemeIds: [] as string[]
  }

  // Process in batches of 5 to avoid API rate limits
  const batchSize = 5
  for (let i = 0; i < markSchemesData.length; i += batchSize) {
    const batch = markSchemesData.slice(i, i + batchSize)
    
    for (const markSchemeData of batch) {
      try {
        const result = await insertMarkSchemeWithVector(markSchemeData, fileId)
        results.successful++
        results.markSchemeIds.push(result.markSchemeId)
      } catch (error) {
        console.error(`Failed to insert mark scheme ${markSchemeData.questionNumber}:`, error)
        results.failed++
      }
      results.totalProcessed++
    }

    // Small delay between batches to respect API limits
    if (i + batchSize < markSchemesData.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

/**
 * Automatically link mark schemes to questions using semantic similarity
 * Updated for 1-to-1 file linking - only searches within linked question paper
 * 
 * @param markSchemeId - ID of the mark scheme file
 * @param threshold - Minimum similarity score for linking (default: 0.8)
 * @returns Summary of linking results
 */
export async function linkMarkSchemesToLinkedQuestions(
  markSchemeId: string,
  threshold: number = 0.8
): Promise<{
  totalProcessed: number
  linked: number
  failed: number
  linkedPairs: Array<{ markSchemeId: string; questionId: string; similarity: number }>
}> {
  const results = {
    totalProcessed: 0,
    linked: 0,
    failed: 0,
    linkedPairs: [] as Array<{ markSchemeId: string; questionId: string; similarity: number }>
  }

  try {
    // Get the mark scheme file and its linked question paper
    const markSchemeFile = await prisma.file.findUnique({
      where: { id: markSchemeId },
      include: { linkedQuestionPaper: true }
    })

    if (!markSchemeFile) {
      return { ...results, failed: 1 }
    }

    if (!markSchemeFile.linkedQuestionPaper) {
      console.log('No linked question paper found for mark scheme:', markSchemeId)
      return results
    }

    // Get all mark schemes from this mark scheme file
    const markSchemes = await prisma.msQuestions.findMany({
      where: { fileId: markSchemeId }
    })

    for (const markScheme of markSchemes) {
      try {
        if (!markScheme.vectorEmbedding) {
          results.failed++
          continue
        }

        // Search for similar questions ONLY in the linked question paper
        const similarQuestions = await executeVectorSQL(`
          SELECT 
            id,
            questionNumber,
            (1 - vec_cosine_distance(vectorEmbedding, ?)) as similarity
          FROM Questions
          WHERE vectorEmbedding IS NOT NULL
            AND fileId = ?
            AND questionNumber = ?
            AND (1 - vec_cosine_distance(vectorEmbedding, ?)) >= ?
          ORDER BY similarity DESC
          LIMIT 1
        `, [
          markScheme.vectorEmbedding, 
          markSchemeFile.linkedQuestionPaper.id,
          markScheme.questionNumber,
          markScheme.vectorEmbedding, 
          threshold
        ])

        if (similarQuestions.length > 0) {
          const bestMatch = similarQuestions[0]
          
          // Update mark scheme with linked question
          await prisma.msQuestions.update({
            where: { id: markScheme.id },
            data: { linkedQuestionId: bestMatch.id }
          })

          results.linked++
          results.linkedPairs.push({
            markSchemeId: markScheme.id,
            questionId: bestMatch.id,
            similarity: Math.round(bestMatch.similarity * 10000) / 10000
          })
        }

        results.totalProcessed++
      } catch (error) {
        console.error(`Failed to link mark scheme ${markScheme.id}:`, error)
        results.failed++
      }
    }

    return results
  } catch (error) {
    console.error('Failed to process mark scheme linking:', error)
    return { ...results, failed: 1 }
  }
}

/**
 * Setup TiDB vector tables and indexes
 * Call this once after schema migration to add vector columns and indexes
 * 
 * IMPORTANT: This converts the TEXT columns to proper VECTOR columns in TiDB
 * Run this after your first migration to enable vector operations
 * 
 * @returns Success confirmation
 * 
 * Creates VECTOR columns and cosine distance indexes for optimal performance
 */
export async function setupTiDBVectorColumns(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('Setting up TiDB vector columns...')

    // Step 1: Drop existing TEXT columns and recreate as VECTOR
    await executeVectorSQL(`
      ALTER TABLE Questions 
      DROP COLUMN IF EXISTS vectorEmbedding
    `)

    await executeVectorSQL(`
      ALTER TABLE File 
      DROP COLUMN IF EXISTS vectorEmbedding
    `)

    // Step 2: Add proper VECTOR columns (1536 dimensions for text-embedding-3-small)
    await executeVectorSQL(`
      ALTER TABLE Questions 
      ADD COLUMN vectorEmbedding VECTOR(1536)
    `)

    await executeVectorSQL(`
      ALTER TABLE File 
      ADD COLUMN vectorEmbedding VECTOR(1536)
    `)

    // Step 3: Create vector search indexes for optimal performance
    await executeVectorSQL(`
      CREATE INDEX IF NOT EXISTS idx_questions_vector 
      ON Questions USING VECTOR(vectorEmbedding) 
      WITH (distance_metric = 'cosine')
    `)

    await executeVectorSQL(`
      CREATE INDEX IF NOT EXISTS idx_file_vector 
      ON File USING VECTOR(vectorEmbedding) 
      WITH (distance_metric = 'cosine')
    `)

    console.log('TiDB vector setup completed successfully')

    return {
      success: true,
      message: 'TiDB vector columns and indexes created successfully. VECTOR(1536) columns are now ready for use.'
    }
  } catch (error) {
    console.error('Failed to setup TiDB vector columns:', error)
    return {
      success: false,
      message: `Setup failed: ${error}`
    }
  }
}

/**
 * One-time setup function to call after running prisma db push
 * This sets up the TiDB vector infrastructure
 * 
 * Usage: Create an API route or run this once to initialize vectors
 */
export async function initializeTiDBVectors(): Promise<void> {
  console.log('🚀 Initializing TiDB Vector Support...')
  
  const result = await setupTiDBVectorColumns()
  
  if (result.success) {
    console.log('✅ TiDB Vector initialization complete!')
    console.log('📊 You can now use vector embeddings and semantic search')
  } else {
    console.error('❌ TiDB Vector initialization failed:', result.message)
    throw new Error(result.message)
  }
}

/**
 * Find mark scheme by exact question number match (1-to-1 reference)
 * 
 * @param questionNumber - The question number to match exactly
 * @param fileId - Optional: limit search to specific mark scheme file
 * @returns Mark scheme object if found, null otherwise
 */
export async function findMarkSchemeByQuestionNumber(
  questionNumber: string,
  fileId?: string
): Promise<{
  id: string
  questionNumber: string
  markingCriteria: string
  maxMarks: number
  markBreakdown: any
  acceptableAnswers: string[] | null
  keywords: string[] | null
  semanticSummary: string
} | null> {
  try {
    const markScheme = await prisma.msQuestions.findFirst({
      where: {
        questionNumber: questionNumber,
        ...(fileId && { fileId: fileId })
      }
    })

    if (!markScheme) return null

    return {
      id: markScheme.id,
      questionNumber: markScheme.questionNumber,
      markingCriteria: markScheme.markingCriteria,
      maxMarks: markScheme.maxMarks,
      markBreakdown: markScheme.markBreakdown,
      acceptableAnswers: markScheme.acceptableAnswers as string[] | null,
      keywords: markScheme.keywords as string[] | null,
      semanticSummary: markScheme.semanticSummary
    }
  } catch (error) {
    console.error('Failed to find mark scheme by question number:', error)
    return null
  }
}

/**
 * Search for mark schemes using vector similarity (fallback method)
 * 
 * @param searchQuery - Question text or semantic summary to match
 * @param fileId - Optional: limit search to specific mark scheme file
 * @param threshold - Minimum similarity score (default: 0.7)
 * @returns Array of mark schemes with similarity scores
 */
export async function searchSimilarMarkSchemes(
  searchQuery: string,
  fileId?: string,
  threshold: number = 0.7
): Promise<Array<{
  id: string
  questionNumber: string
  markingCriteria: string
  maxMarks: number
  markBreakdown: any
  acceptableAnswers: string[] | null
  keywords: string[] | null
  semanticSummary: string
  similarity: number
}>> {
  try {
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery)
    const queryVectorString = vectorToString(queryEmbedding)

    // Build SQL query with optional file filtering
    const fileFilter = fileId ? 'AND fileId = ?' : ''
    const params = [
      queryVectorString, // for distance calculation
      queryVectorString, // for similarity calculation
      ...(fileId ? [fileId] : []),
      queryVectorString, // for WHERE clause
      threshold,
      5 // limit to top 5 matches
    ]

    const searchSQL = `
      SELECT 
        id,
        questionNumber,
        markingCriteria,
        maxMarks,
        markBreakdown,
        acceptableAnswers,
        keywords,
        semanticSummary,
        vec_cosine_distance(vectorEmbedding, ?) as distance,
        (1 - vec_cosine_distance(vectorEmbedding, ?)) as similarity
      FROM MsQuestions
      WHERE vectorEmbedding IS NOT NULL
        ${fileFilter}
        AND (1 - vec_cosine_distance(vectorEmbedding, ?)) >= ?
      ORDER BY distance ASC
      LIMIT ?
    `

    const results = await executeVectorSQL(searchSQL, params)

    return results.map((row: any) => ({
      id: row.id,
      questionNumber: row.questionNumber,
      markingCriteria: row.markingCriteria,
      maxMarks: row.maxMarks,
      markBreakdown: row.markBreakdown,
      acceptableAnswers: row.acceptableAnswers ? JSON.parse(row.acceptableAnswers) : null,
      keywords: row.keywords ? JSON.parse(row.keywords) : null,
      semanticSummary: row.semanticSummary,
      similarity: Math.round(row.similarity * 10000) / 10000
    }))
  } catch (error) {
    console.error('Vector search for mark schemes failed:', error)
    return []
  }
}

/**
 * Find the best matching mark scheme using 1-to-1 reference first, then vector search
 * 
 * @param questionId - ID of the question to find mark scheme for
 * @param fallbackSearch - Whether to use vector search if no exact match found
 * @returns Best matching mark scheme or null
 */
export async function findBestMarkScheme(
  questionId: string,
  fallbackSearch: boolean = true
): Promise<{
  id: string
  questionNumber: string
  markingCriteria: string
  maxMarks: number
  markBreakdown: any
  acceptableAnswers: string[] | null
  keywords: string[] | null
  semanticSummary: string
  matchType: '1-to-1' | 'vector-search'
  similarity?: number
} | null> {
  try {
    // Get the question details
    const question = await prisma.questions.findUnique({
      where: { id: questionId },
      include: { 
        file: { 
          include: { linkedMarkScheme: true } 
        } 
      }
    })

    if (!question) {
      throw new Error('Question not found')
    }

    // Step 1: Try 1-to-1 reference match
    const markSchemeFileId = question.file?.linkedMarkScheme?.id
    if (markSchemeFileId) {
      const exactMatch = await findMarkSchemeByQuestionNumber(
        question.questionNumber,
        markSchemeFileId
      )

      if (exactMatch) {
        return {
          ...exactMatch,
          matchType: '1-to-1'
        }
      }
    }

    // Step 2: Fallback to vector search if no exact match
    if (fallbackSearch) {
      const searchQuery = `${question.question} ${question.semanticSummary}`
      const vectorMatches = await searchSimilarMarkSchemes(
        searchQuery,
        markSchemeFileId, // Prefer linked mark scheme file if available
        0.7 // 70% similarity threshold
      )

      if (vectorMatches.length > 0) {
        const bestMatch = vectorMatches[0]
        // Ensure all required fields are present
        if (bestMatch?.id && bestMatch?.questionNumber && bestMatch?.markingCriteria && typeof bestMatch?.maxMarks === 'number') {
          return {
            id: bestMatch.id,
            questionNumber: bestMatch.questionNumber,
            markingCriteria: bestMatch.markingCriteria,
            maxMarks: bestMatch.maxMarks,
            markBreakdown: bestMatch.markBreakdown || null,
            acceptableAnswers: bestMatch.acceptableAnswers || null,
            keywords: bestMatch.keywords || null,
            semanticSummary: bestMatch.semanticSummary || '',
            matchType: 'vector-search' as const,
            similarity: bestMatch.similarity
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Failed to find best mark scheme:', error)
    return null
  }
}

/**
 * Find mark scheme for a question using 1-to-1 reference match and vector search fallback
 * 
 * @param questionId - ID of the question to find mark scheme for
 * @param linkedMarkSchemeFileId - Optional: ID of linked mark scheme file for targeted search
 * @returns Best matching mark scheme with match type
 */
export async function findMarkSchemeForQuestion(
  questionId: string,
  linkedMarkSchemeFileId?: string
): Promise<any> {
  try {
    return await findBestMarkScheme(questionId, true)
  } catch (error) {
    console.error('Failed to find mark scheme for question:', error)
    return null
  }
}

/**
 * Generate model answer from mark scheme or using AI
 * 
 * @param markScheme - Mark scheme object
 * @param question - Question object
 * @returns Generated model answer
 */
export async function generateModelAnswer(
  markScheme: any,
  question: any
): Promise<string> {
  try {
    // First check if acceptable answers exist in mark scheme
    if (markScheme.acceptableAnswers && markScheme.acceptableAnswers.length > 0) {
      // Use the first acceptable answer as model answer
      return markScheme.acceptableAnswers[0]
    }

    // If no acceptable answers, generate using AI based on marking criteria
    const prompt = `
Based on this mark scheme, generate a comprehensive model answer for the question:

Question: ${question.question}
Question Type: ${question.type}
Max Marks: ${markScheme.maxMarks}

Marking Criteria: ${markScheme.markingCriteria}
Keywords: ${markScheme.keywords ? JSON.stringify(markScheme.keywords) : 'None specified'}
Mark Breakdown: ${markScheme.markBreakdown ? JSON.stringify(markScheme.markBreakdown) : 'None specified'}

Generate a complete, well-structured model answer that would achieve full marks according to the marking criteria. Include all key concepts and terminology mentioned in the keywords.
`

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "You are an expert educator generating model answers for exam questions. Create comprehensive, accurate answers that demonstrate full understanding and would achieve maximum marks."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_output_tokens: 1000,
    })

    return response as unknown as string|| "Unable to generate model answer"
  } catch (error) {
    console.error('Failed to generate model answer:', error)
    return "Error generating model answer"
  }
}

/**
 * Optimized batch assessment for parallel processing
 * Generates multiple model answers in parallel
 */
export async function generateModelAnswersBatch(
  markSchemes: any[],
  questions: any[]
): Promise<string[]> {
  try {
    if (markSchemes.length !== questions.length) {
      throw new Error('Mark schemes and questions arrays must have the same length')
    }

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5
    const results: string[] = []

    for (let i = 0; i < markSchemes.length; i += BATCH_SIZE) {
      const batch = markSchemes.slice(i, i + BATCH_SIZE)
      const questionBatch = questions.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map((markScheme, index) => 
        generateModelAnswer(markScheme, questionBatch[index])
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error('Model answer generation failed:', result.reason)
          results.push('Model answer generation failed')
        }
      }
    }

    return results
  } catch (error) {
    console.error('Batch model answer generation failed:', error)
    return markSchemes.map(() => 'Batch generation failed')
  }
}

/**
 * Optimized batch assessment for parallel processing
 * Assesses multiple user answers in parallel
 */
export async function assessUserAnswersBatch(
  userAnswers: string[],
  markSchemes: any[],
  questions: any[],
  modelAnswers: string[]
): Promise<Array<{
  marksAwarded: number,
  feedback: string,
  keywordMatches: string[],
  missingKeywords: string[]
}>> {
  try {
    if (userAnswers.length !== markSchemes.length || 
        markSchemes.length !== questions.length || 
        questions.length !== modelAnswers.length) {
      throw new Error('All arrays must have the same length for batch assessment')
    }

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 4 // Smaller batch size for AI-intensive operations
    const results: Array<{
      marksAwarded: number,
      feedback: string,
      keywordMatches: string[],
      missingKeywords: string[]
    }> = []

    for (let i = 0; i < userAnswers.length; i += BATCH_SIZE) {
      const userAnswerBatch = userAnswers.slice(i, i + BATCH_SIZE)
      const markSchemeBatch = markSchemes.slice(i, i + BATCH_SIZE)
      const questionBatch = questions.slice(i, i + BATCH_SIZE)
      const modelAnswerBatch = modelAnswers.slice(i, i + BATCH_SIZE)

      const batchPromises = userAnswerBatch.map((userAnswer, index) => 
        assessUserAnswer(
          userAnswer,
          markSchemeBatch[index],
          questionBatch[index],
          modelAnswerBatch[index] || ''
        )
      )

      const batchResults = await Promise.allSettled(batchPromises)
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error('Assessment failed:', result.reason)
          results.push({
            marksAwarded: 0,
            feedback: 'Assessment failed due to system error',
            keywordMatches: [],
            missingKeywords: []
          })
        }
      }

      // Small delay between batches to respect API rate limits
      if (i + BATCH_SIZE < userAnswers.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  } catch (error) {
    console.error('Batch assessment failed:', error)
    return userAnswers.map(() => ({
      marksAwarded: 0,
      feedback: 'Batch assessment failed',
      keywordMatches: [],
      missingKeywords: []
    }))
  }
}
export async function assessUserAnswer(
  userAnswer: string,
  markScheme: any,
  question: any,
  modelAnswer: string
): Promise<{
  marksAwarded: number,
  feedback: string,
  keywordMatches: string[],
  missingKeywords: string[]
}> {
  try {
    const prompt = `
You are an expert examiner assessing a student's answer. Provide detailed marking and feedback.

QUESTION:
${question.question}
Type: ${question.type}
Max Marks: ${markScheme.maxMarks}

MARKING CRITERIA:
${markScheme.markingCriteria}

MARK BREAKDOWN:
${markScheme.markBreakdown ? JSON.stringify(markScheme.markBreakdown) : 'Not specified'}

KEYWORDS TO LOOK FOR:
${markScheme.keywords ? JSON.stringify(markScheme.keywords) : 'None specified'}

ACCEPTABLE ANSWERS:
${markScheme.acceptableAnswers ? JSON.stringify(markScheme.acceptableAnswers) : 'See marking criteria'}

MODEL ANSWER:
${modelAnswer}

STUDENT'S ANSWER:
${userAnswer}

Please assess the student's answer and provide:
1. Marks awarded (out of ${markScheme.maxMarks})
2. Detailed feedback explaining the marking
3. Which keywords were successfully included
4. Which important concepts/keywords were missing
5. Specific suggestions for improvement

Format your response as JSON:
{
  "marksAwarded": number,
  "feedback": "detailed feedback string",
  "keywordMatches": ["keyword1", "keyword2"],
  "missingKeywords": ["missing1", "missing2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"]
}
`
const responseSchema = z.object({
      marksAwarded: z.number().min(0).max(markScheme.maxMarks),
      feedback: z.string(),
      keywordMatches: z.array(z.string()),
      missingKeywords: z.array(z.string()),
      strengths: z.array(z.string()).optional().nullable(),
      improvements: z.array(z.string()).optional().nullable()
    })

    const response = await openai.responses.parse({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal"},
      text: {verbosity: 'medium', format: zodTextFormat(responseSchema, "responseSchema")},
      input: [
        {
          role: "system",
          content: "You are a professional examiner with expertise in educational assessment. Provide fair, detailed, and constructive feedback. Be consistent with marking criteria and award partial marks appropriately."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_output_tokens: 5000,
    })

    const assessment = response.output_parsed
    
    return {
      marksAwarded: Math.min(assessment?.marksAwarded || 0, markScheme.maxMarks),
      feedback: assessment?.feedback || "Unable to provide feedback",
      keywordMatches: assessment?.keywordMatches || [],
      missingKeywords: assessment?.missingKeywords || []
    }
  } catch (error) {
    console.error('Failed to assess user answer:', error)
    return {
      marksAwarded: 0,
      feedback: "Error occurred during assessment",
      keywordMatches: [],
      missingKeywords: []
    }
  }
}
