import {NextResponse, NextRequest} from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import {zodTextFormat} from "openai/helpers/zod"
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';
import { 
  batchInsertMarkSchemesWithVectors,
  linkMarkSchemesToLinkedQuestions
} from '@/lib/tidb-vector';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function PDFDocumentsToMarkScheme(pdf: string, filename: string): Promise<any> {
  // Zod schema for mark scheme extraction
  const markSchemeSchema = z.object({
    questionNumber: z.string().describe("The unique identifier for the question, such as FOR EXAMPLE '1', OR '2(a)', OR '3b(i)', etc."),
    parentQuestionNumber: z.number().int().nullable().describe("The parent question number if applicable, EXAMPLE 1 OR 2. Use this if the question number is a subpart like 1(a)(i)."),
    markingCriteria: z.string().describe("Detailed marking criteria and rubric for this ONE QUESTION. DO NOT INCLUDE OTHER QUESTIONS. "),
    maxMarks: z.number().describe("Total marks available for this question"),
    markBreakdown: z.record(z.union([z.string(), z.number()])).optional().nullable().describe("Simple mark allocation breakdown as key-value pairs (e.g., {\"method\": 2, \"accuracy\": 3})"),
    acceptableAnswers: z.array(z.string()).optional().nullable().describe("Array of acceptable answer variations"),
    keywords: z.array(z.string()).optional().nullable().describe("Key terms/concepts that should be present in answers"),
    pageNumber: z.number().describe("Page number where this mark scheme appears"),
    semanticSummary: z.string().describe("A concise one-line summary of the marking criteria for semantic search. INCLUDE question number EXAMPLE: Question 4(a)(i) {semantic summary here}")
  });

  const GPTMarkSchemeSchema = z.object({
    markSchemes: z.array(markSchemeSchema).min(1).max(50),
    totalMarks: z.number().describe("Total marks for the entire exam"),
    totalQuestions: z.number().describe("Total number of questions in the mark scheme"),
    examLevel: z.string().optional().nullable().describe("Educational level (e.g., A-Level, GCSE, etc.)")
  });

  const responsePayload = {
    model: "gpt-5-mini",
    reasoning: {effort: "minimal"},
    text: {verbosity: "low", format: zodTextFormat(GPTMarkSchemeSchema, 'MarkSchemeSchema')},
    input: [
      { 
        role: "system", 
        content: "You are an expert educator that extracts marking schemes from educational documents. Extract detailed marking criteria, point allocations, acceptable answers, and key concepts for each question. Focus on how marks are awarded and what examiners look for. Be precise about mark breakdowns and specific requirements."
      },
      { 
        role: "user", 
        content: [
          {type: "input_text", text: `Extract the mark scheme details from the provided PDF document using the schema. Focus on marking criteria, point allocations, and acceptable answers.`},
          {type: "input_file", file_data: pdf, filename}
        ]
      }
    ],
  };

  console.log("sending mark scheme to GPT-5-mini for processing")

  // @ts-ignore - GPT-5-mini API format is correct according to OpenAI docs
  const response = await client.responses.parse({
    ...responsePayload,
    max_output_tokens: 30000,
  });

  const output = response.output_parsed
  return output
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { file, filename, sessionId } = await request.json();
  
    const fileExtension = filename.split('.').pop()?.toLowerCase();

    if (fileExtension !== 'pdf') {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF file.' }, { status: 400 });
    }

    const user: User = await prisma.user.findUnique({
      where: { email: session.user.email! },
    }) as unknown as User;

    // Verify that the session belongs to this user (if sessionId is provided)
    if (sessionId) {
      const processorSession = await prisma.processorSession.findFirst({
        where: {
          id: sessionId,
          userId: user.id
        }
      });

      if (!processorSession) {
        return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
      }
    }

    // Save file before processing with markScheme type
    // Extract base64 content from data URL (remove "data:application/pdf;base64," prefix)
    const base64Content = file.includes(',') ? file.split(',')[1] : file;
    
    const savedFile = await prisma.file.create({
      data: {
        userId: user.id,
        name: filename,
        size: Buffer.from(base64Content, 'base64').length,
        type: 'markScheme', // Distinguish from question papers
        mimetype: 'application/pdf',
        content: Buffer.from(base64Content, 'base64'),
        processorSessionId: sessionId || null // Associate with session if provided
      }
    });

    console.log("Processing mark scheme PDF with GPT-5-mini...")

    // Extract mark scheme data using GPT-5-mini
    const markSchemeData = await PDFDocumentsToMarkScheme(file, filename);

    console.log(`Extracted ${markSchemeData.markSchemes.length} mark scheme entries`)

    // Store mark schemes in database with vector embeddings
    const insertResults = await batchInsertMarkSchemesWithVectors(
      markSchemeData.markSchemes.map((ms: any) => ({
        questionNumber: ms.questionNumber,
        parentQuestionNumber: ms.parentQuestionNumber?.toString(),
        markingCriteria: ms.markingCriteria,
        maxMarks: ms.maxMarks,
        markBreakdown: ms.markBreakdown,
        acceptableAnswers: ms.acceptableAnswers,
        keywords: ms.keywords,
        pageNumber: ms.pageNumber,
        semanticSummary: ms.semanticSummary,
      })),
      savedFile.id
    );

    console.log(`Successfully inserted ${insertResults.successful} mark schemes`)

    // Only attempt automatic linking if this mark scheme file has a linked question paper
    const markSchemeFile = await prisma.file.findUnique({
      where: { id: savedFile.id },
      include: { linkedQuestionPaper: true }
    });

    let linkingResults;
    if (markSchemeFile?.linkedQuestionPaper) {
      // Automatically link mark schemes to questions using semantic similarity within linked pair
      linkingResults = await linkMarkSchemesToLinkedQuestions(
        savedFile.id,
        0.8 // 80% similarity threshold
      );
      console.log(`Linked ${linkingResults.linked} mark schemes to existing questions`)
    } else {
      linkingResults = {
        message: "No linked question paper found. Link files manually to enable automatic question matching."
      }
      console.log("No linked question paper found for automatic linking")
    }

    return NextResponse.json({ 
      markSchemeData,
      insertResults,
      linkingResults,
      message: `Successfully processed ${insertResults.successful} mark schemes and linked ${linkingResults.linked} to existing questions`
    });
    
  } catch (error) {
    console.error("Error processing mark scheme:", error);
    return NextResponse.json({ error: 'Failed to process mark scheme document.' }, { status: 500 });
  }
}
