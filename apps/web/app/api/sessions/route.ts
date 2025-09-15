import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { User } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user : User = await prisma.user.findUnique({
      where: { email: session.user.email! },
    }) as unknown as User;

    // Get all processor sessions for the user
    const processorSessions = await prisma.processorSession.findMany({
      where: { userId: user.id },
      include: {
        files: {
          select: {
            id: true,
            name: true,
            type: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform to dashboard session format
    const dashboardSessions = processorSessions.map(ps => ({
      id: ps.id,
      name: `Session ${ps.id.slice(-8)}`,
      status: ps.status as 'active' | 'paused' | 'stopped',
      createdAt: ps.createdAt,
      fileCount: ps.files.length,
      duration: calculateDuration(ps.createdAt, ps.updatedAt)
    }))

    return NextResponse.json({ sessions: dashboardSessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user : User = await prisma.user.findUnique({
      where: { email: session.user.email! },
    }) as unknown as User;

    const body = await request.json()
    const { name } = body

    // Create new processor session
    const newSession = await prisma.processorSession.create({
      data: {
        userId: user.id,
        status: 'stopped',
        result: null
      }
    })

    return NextResponse.json({
      id: newSession.id,
      name: name || `Session ${newSession.id.slice(-8)}`,
      status: 'stopped' as const,
      createdAt: newSession.createdAt,
      fileCount: 0,
      duration: '0m'
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    const user : User = await prisma.user.findUnique({
      where: { email: session.user.email! },
    }) as unknown as User;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const processorSession = await prisma.processorSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id
      }
    })

    if (!processorSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Perform cascade deletion in correct order using transaction
    await prisma.$transaction(async (tx) => {
      console.log(`Starting cascade deletion for session: ${sessionId}`)

      // 1. Delete all questions related to files in this session
      const deletedQuestions = await tx.questions.deleteMany({
        where: {
          file: {
            processorSessionId: sessionId
          }
        }
      })
      console.log(`Deleted ${deletedQuestions.count} questions`)

      // 2. Delete all mark scheme questions related to files in this session  
      const deletedMsQuestions = await tx.msQuestions.deleteMany({
        where: {
          file: {
            processorSessionId: sessionId
          }
        }
      })
      console.log(`Deleted ${deletedMsQuestions.count} mark scheme questions`)

      // 3. Delete all files in this session (including their content/blobs)
      const deletedFiles = await tx.file.deleteMany({
        where: {
          processorSessionId: sessionId
        }
      })
      console.log(`Deleted ${deletedFiles.count} files`)

      // 4. Finally delete the session itself
      await tx.processorSession.delete({
        where: { id: sessionId }
      })
      console.log(`Deleted session: ${sessionId}`)
    })

    return NextResponse.json({ 
      success: true,
      message: 'Session and all related data deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}

function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  
  if (diffMins < 60) {
    return `${diffMins}m`
  } else {
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }
}
