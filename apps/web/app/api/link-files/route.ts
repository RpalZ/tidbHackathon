import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { linkMarkSchemesToLinkedQuestions } from '@/lib/tidb-vector';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { questionPaperId, markSchemeId } = await request.json();

    if (!questionPaperId || !markSchemeId) {
      return NextResponse.json({ error: 'Missing questionPaperId or markSchemeId' }, { status: 400 });
    }

    // Verify both files exist and belong to the user
    const [questionPaper, markScheme] = await Promise.all([
      prisma.file.findFirst({
        where: { 
          id: questionPaperId, 
          type: 'qsPaper',
          userId: session.user.id 
        }
      }),
      prisma.file.findFirst({
        where: { 
          id: markSchemeId, 
          type: 'markScheme',
          userId: session.user.id 
        }
      })
    ]);

    if (!questionPaper) {
      return NextResponse.json({ error: 'Question paper not found' }, { status: 404 });
    }

    if (!markScheme) {
      return NextResponse.json({ error: 'Mark scheme not found' }, { status: 404 });
    }

    // Create the 1-to-1 link
    const updatedQuestionPaper = await prisma.file.update({
      where: { id: questionPaperId },
      data: { linkedMarkSchemeId: markSchemeId },
      include: { linkedMarkScheme: true }
    });

    // Perform semantic linking between the now-linked documents
    const linkingResults = await linkMarkSchemesToLinkedQuestions(markSchemeId);

    return NextResponse.json({
      success: true,
      linkedFiles: {
        questionPaper: updatedQuestionPaper,
        markScheme: markScheme
      },
      semanticLinkingResults: linkingResults,
      message: `Successfully linked ${questionPaper.name} to ${markScheme.name}`
    });

  } catch (error) {
    console.error('Error linking files:', error);
    return NextResponse.json({ error: 'Failed to link files' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { questionPaperId } = await request.json();

    if (!questionPaperId) {
      return NextResponse.json({ error: 'Missing questionPaperId' }, { status: 400 });
    }

    // Remove the link
    const updatedQuestionPaper = await prisma.file.update({
      where: { id: questionPaperId },
      data: { linkedMarkSchemeId: null }
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully unlinked files',
      updatedFile: updatedQuestionPaper
    });

  } catch (error) {
    console.error('Error unlinking files:', error);
    return NextResponse.json({ error: 'Failed to unlink files' }, { status: 500 });
  }
}

// Get linked files information
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
  }

  try {
    const file = await prisma.file.findFirst({
      where: { 
        id: fileId,
        userId: session.user.id 
      },
      include: {
        linkedMarkScheme: true,
        linkedQuestionPaper: true
      }
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({
      file,
      linkedFile: file.type === 'qsPaper' ? file.linkedMarkScheme : file.linkedQuestionPaper,
      linkExists: !!(file.linkedMarkSchemeId || file.linkedQuestionPaper)
    });

  } catch (error) {
    console.error('Error fetching file links:', error);
    return NextResponse.json({ error: 'Failed to fetch file links' }, { status: 500 });
  }
}
