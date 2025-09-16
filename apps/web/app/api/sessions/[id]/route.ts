import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { File } from "@prisma/client"

interface Context {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id: sessionId } = await params

    // Get the authenticated user
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify that the session exists and belongs to this user
    const processorSession = await prisma.processorSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      }
    })

    if (!processorSession) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 })
    }

    // Get files that belong to this user and session
    const files: File[] = await prisma.file.findMany({
      where: {
        userId: user.id,
        processorSessionId: sessionId, // Files must belong to this specific session
      },
      orderBy: { createdAt: 'desc' }
    })

    // Count questions for each file
    const filesWithStats = await Promise.all(
      files.map(async (file) => {
        let totalQuestions = 0
        let solvedQuestions = 0

        if (file.type === 'qsPaper') {
          const questions = await prisma.questions.findMany({
            where: { fileId: file.id }
          })
          totalQuestions = questions.length
          solvedQuestions = questions.filter(q => q.answer).length
        } else if (file.type === 'markScheme') {
          const markSchemeQuestions = await prisma.msQuestions.findMany({
            where: { fileId: file.id }
          })
          totalQuestions = markSchemeQuestions.length
          solvedQuestions = markSchemeQuestions.length // All mark scheme entries are "solved"
        }

        return {
          id: file.id,
          filename: file.name,
          examBoard: 'Unknown', // We don't have these fields in the current schema
          subject: 'Unknown',
          year: new Date().getFullYear(),
          status: totalQuestions > 0 ? 'solved' : 'processing',
          uploadedAt: file.createdAt,
          totalQuestions,
          solvedQuestions,
          accuracy: totalQuestions > 0 ? (solvedQuestions / totalQuestions) * 100 : 0,
          // processingTime: '1m 30s', // Mock processing time for now
          documentType: file.type,
          linkedMarkSchemeId: file.linkedMarkSchemeId
        }
      })
    )

    // Calculate overall session stats
    const totalQuestions = filesWithStats.reduce((sum, file) => sum + file.totalQuestions, 0)
    const totalSolved = filesWithStats.reduce((sum, file) => sum + file.solvedQuestions, 0)
    const avgAccuracy = totalQuestions > 0 ? (totalSolved / totalQuestions) * 100 : 0

    const sessionData = {
      id: sessionId,
      name: `Session ${sessionId.slice(-8)}`,
      examBoard: 'Mixed', // These fields don't exist in current schema
      subject: 'Mixed',
      year: new Date().getFullYear(),
      createdAt: files[0]?.createdAt || new Date(),
      status: files.length > 0 ? 'active' : 'draft',
      totalQuestions,
      solvedQuestions: totalSolved,
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      totalProcessingTime: `${Math.floor(files.length * 1.5)}m`,
      papers: filesWithStats
    }

    return NextResponse.json(sessionData)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    )
  }
}
