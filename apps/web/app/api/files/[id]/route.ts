import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

interface Context {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id: fileId } = await params

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

    // Get file and verify ownership
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 })
    }

    // Return file content
    if (!file.content) {
      return NextResponse.json({ error: 'File content not found' }, { status: 404 })
    }

    // file.content is a Buffer (Bytes in Prisma), convert to base64
    const base64Content = Buffer.from(file.content).toString('base64')

    return NextResponse.json({
      id: file.id,
      name: file.name,
      type: file.type,
      mimetype: file.mimetype,
      content: base64Content,
      size: file.size,
      createdAt: file.createdAt
    })

  } catch (error) {
    console.error('Error fetching file:', error)
    return NextResponse.json(
      { error: 'Failed to fetch file' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { id: fileId } = await params

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

    // Verify file ownership before deletion
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: user.id
      }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 })
    }

    // Delete related questions first (cascade)
    await prisma.questions.deleteMany({
      where: { fileId: fileId }
    })

    // Delete related mark schemes
    await prisma.msQuestions.deleteMany({
      where: { fileId: fileId }
    })

    // Delete the file
    await prisma.file.delete({
      where: { id: fileId }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'File and related data deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
