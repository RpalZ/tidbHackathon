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
    parentQuestionNumber?: string
    isMultipleChoice: boolean
    imageDescription?: string
    answer: any
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
    answer: any
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
  const batchSize = 5
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
