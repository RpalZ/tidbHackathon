import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  findMarkSchemeForQuestion, 
  generateModelAnswer,
  assessUserAnswer 
} from '@/lib/tidb-vector'

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { questionId, userAnswer } = await request.json();

    if (!questionId || !userAnswer) {
      return NextResponse.json({ 
        error: 'Missing required fields: questionId and userAnswer' 
      }, { status: 400 });
    }

    // Get the question details
    const question = await prisma.questions.findUnique({
      where: { id: questionId },
      include: { 
        file: {
          include: {
            linkedMarkScheme: true // Get linked mark scheme file if available
          }
        }
      }
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    console.log(`Assessing question ${question.questionNumber} for user ${session.user.email}`);

    // Step 1: Find mark scheme using 1-to-1 match or vector search
    const markScheme = await findMarkSchemeForQuestion(questionId, question.questionNumber);

    if (!markScheme) {
      return NextResponse.json({ 
        error: 'No mark scheme found for this question. Please ensure a mark scheme is uploaded and linked.' 
      }, { status: 404 });
    }

    console.log(`Found mark scheme for question ${question.questionNumber}`);

    // Step 2: Generate model answer
    const modelAnswer = await generateModelAnswer(markScheme, question);
    console.log('Generated model answer');

    // Step 3: Assess user's answer using AI
    const assessment = await assessUserAnswer(userAnswer, markScheme, question, modelAnswer);

    console.log(`Assessment complete: ${assessment.marksAwarded}/${markScheme.maxMarks} marks`);

    // Step 4: Update question with assessment results
    const updatedQuestion = await prisma.questions.update({
      where: { id: questionId },
      data: {
        answer: userAnswer, // Store user's answer
        marked: true,
        modelAnswer: modelAnswer,
        marksAwarded: assessment.marksAwarded,
        feedback: assessment.feedback
      }
    });

    // Step 5: Return comprehensive assessment results
    return NextResponse.json({
      success: true,
      assessment: {
        questionId: questionId,
        questionNumber: question.questionNumber,
        userAnswer: userAnswer,
        modelAnswer: modelAnswer,
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
      }
    });

  } catch (error) {
    console.error('Error assessing question:', error);
    return NextResponse.json({ 
      error: 'Failed to assess question. Please try again.' 
    }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve assessment for an already marked question
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json({ 
        error: 'Missing questionId parameter' 
      }, { status: 400 });
    }

    const question = await prisma.questions.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        questionNumber: true,
        question: true,
        answer: true,
        marked: true,
        modelAnswer: true,
        marksAwarded: true,
        maxMarks: true,
        feedback: true
      }
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (!question.marked) {
      return NextResponse.json({ 
        error: 'Question has not been assessed yet' 
      }, { status: 400 });
    }

    return NextResponse.json({
      assessment: {
        questionId: question.id,
        questionNumber: question.questionNumber,
        userAnswer: question.answer,
        modelAnswer: question.modelAnswer,
        marksAwarded: question.marksAwarded,
        maxMarks: question.maxMarks,
        percentage: question.maxMarks ? Math.round((question.marksAwarded || 0) / question.maxMarks * 100) : 0,
        feedback: question.feedback
      }
    });

  } catch (error) {
    console.error('Error retrieving assessment:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve assessment' 
    }, { status: 500 });
  }
}
