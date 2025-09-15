import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Get the file to check its type
    const file = await prisma.file.findUnique({
      where: { id: fileId }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    let questions: any[] = []

    if (file.type === 'qsPaper') {
      // Get questions for question papers
      const dbQuestions = await prisma.questions.findMany({
        where: { fileId },
        orderBy: { questionNumber: 'asc' }
      })

      questions = dbQuestions.map(q => ({
        id: q.id,
        questionNumber: q.questionNumber,
        text: q.question,
        marks: q.maxMarks, // Default marks - you might want to add this to schema
        type: q.type, // "main", "subquestion", "subpart"
        parentQuestionNumber: q.parentQuestionNumber,
        isMultipleChoice: q.isMultipleChoice,
        imageDescription: q.imageDescription,
        pageNumber: q.pageNumber,
        
        // Assessment fields
        marked: q.marked,
        modelAnswer: q.modelAnswer,
        marksAwarded: q.marksAwarded,
        feedback: q.feedback,
        
        // Parse the JSON answer field according to the Zod structure
        detectedAnswer: q.answer ? (
          q.isMultipleChoice ? {
            type: 'mcq',
            choices: (q.answer as any)?.choices || [],
            answer: (q.answer as any)?.answer || null
          } : {
            type: 'text', 
            answer: (q.answer as any)?.answer || null
          }
        ) : null,
        // Keep the old solution field for backward compatibility
        solution: q.answer ? {
          steps: Array.isArray(q.answer) ? q.answer : [String((q.answer as any)?.answer || q.answer)],
          finalAnswer: String((q.answer as any)?.answer || q.answer),
          confidence: 90
        } : undefined,
        status: q.answer ? 'solved' : 'pending'
      }))
    } else if (file.type === 'markScheme') {
      // Get mark scheme questions
      const dbMsQuestions = await prisma.msQuestions.findMany({
        where: { fileId },
        orderBy: { questionNumber: 'asc' }
      })

      questions = dbMsQuestions.map(ms => ({
        id: ms.id,
        questionNumber: ms.questionNumber,
        text: ms.markingCriteria,
        marks: ms.maxMarks,
        solution: {
          steps: ['Mark scheme criteria provided'],
          finalAnswer: ms.markingCriteria,
          confidence: 100
        },
        status: 'solved'
      }))
    }

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

// Update question answer
export async function PUT(request: NextRequest) {
  try {
    const { questionId, answer } = await request.json()

    if (!questionId || !answer) {
      return NextResponse.json(
        { error: 'Question ID and answer are required' },
        { status: 400 }
      )
    }

    // Update the question's answer in the database
    const updatedQuestion = await prisma.questions.update({
      where: { id: questionId },
      data: { 
        answer: answer // Store the full answer object (text or mcq format)
      }
    })

    return NextResponse.json({ 
      success: true, 
      question: updatedQuestion 
    })
  } catch (error) {
    console.error('Error updating question answer:', error)
    return NextResponse.json(
      { error: 'Failed to update answer' },
      { status: 500 }
    )
  }
}
