import {NextResponse, NextRequest} from 'next/server';
import OpenAI from 'openai';
import { DataService } from '@/lib/dataService';
import { z } from 'zod';
import {zodTextFormat} from "openai/helpers/zod"
import fs from 'fs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';
import { 
  batchInsertQuestionsWithVectors, 
  generateEmbedding, 
  vectorToString, 
  executeVectorSQL 
} from '@/lib/tidb-vector';




const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const dataService = new DataService();

function chunkArray (array: any[], size: number): any[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function PDFDocumentsToQnA(pdf: string, filename: string): Promise<any> {
  // zod schema q an a parent id style


  const textAnswer = z.object({
    type: z.literal("text"),
    answer: z.string().describe("The text answer provided for the question. DO NOT INCLUDE QUESTION NUMBERS BEFORE THE ANSWER").nullable(),
  })

  const mcqAnswer = z.object({
    type: z.literal("mcq"),
    choices: z.array(z.string()).describe("The list of choices available for the multiple-choice question including text of each choice. PUT IN ORDER OF A, B, C, D AND ETC. EXAMPLE: A: {TEXT OF CHOICE}").nullable(),
    answer: z.string().describe("The choice that is selected").nullable(),
  })
  const answerSchema = z.union([textAnswer, mcqAnswer]).nullable();

  const questionAndAnswerSchema = z.object({
    questionNumber: z.string().describe("The unique identifier for the question, such as for EXAMPLE: '1',  OR '2(a)',  OR '3b(i)', etc. Can only have one of these per question. IMPORTANT"),
    question: z.string().describe("The text of the actual question BEING SPECIFIED. DO NOT INCLUDE MULTIPLE QUESTIONS IN THIS FIELD"),
    type: z.enum(["main","subquestion","subpart"]).describe("main = 1,2,3 etc. subquestion = 1(a),1(b),2(a),2(b) etc. subpart = 1(a)(i), 1(a)(ii), 1(b)(i), 1(b)(ii) etc. IMPORTANT"),
    parentQuestionNumber: z.number().int().nullable().describe("the parent question number like 1, 2, 3 etc if the question is a child of it. IMPORTANT"),
    isMultipleChoice: z.boolean().default(false),
    imageDescription: z.string().nullable().describe("A brief description of any images associated with the question, if applicable. Be sure it is detailed enough to be useful to someone who cannot see the image."),
    answer: answerSchema,
    maxMarks: z.number().int().nullable().describe("Total marks available for this question"),
    pageNumber: z.number(),
    semanticSummary: z.string().describe("A concise one-line summary of the question and answer for semantic and vector search purposes. INCLUDE QUESTION NUMBER"),
  })


  const GPTschema = z.object({
    QnAs: z.array(questionAndAnswerSchema).min(1).max(75),
    lastParentQsProcessed: z.string(),
    totalPages: z.number()
  })

    const responsePayload = {
    model: "gpt-5-mini",
    reasoning: {effort: "medium"},
    text: {verbosity: "medium", format: zodTextFormat(GPTschema, 'QnASchema')},
    input: [
      { role: "system", content: "You are a helpful assistant that extracts structured data from educational documents. You will be provided with a document. Your task is to analyze the content of the document and extract all relevant questions and answers, including multiple-choice questions, true/false questions, and written answer questions. The extracted data should be structured in a JSON format according to the provided schema. Imagine yourself as an intelligent OCR. Conform Strictly to the provided schema and their descriptive fields." },
      { role: "user", content: [
        {type: "input_text", text: `Extract the questions and answers from pdf provided in order using the schema provided. Mathematical expressions will be displayed as LaTeX syntax. Example Output for one question: {questionNumber:"16(a)(i)",question:"Electric vehicles ...",type:"main",parentQuestionNumber:16,isMultipleChoice:false,imageDescription:"Schematic of simple ...",answer:{type:"text",answer:"Current flows in the ..."},pageNumber:16,semanticSummary:"Question 16(a)(i) Explain motor torque ..."}`},
        {type: "input_file", file_data: pdf, filename}
      ]}
    ],
  } // Type assertion - correct according to OpenAI GPT-5-mini docs

    console.log("sending chunk to gpt 5 mini")

    // @ts-ignore - GPT-5-mini API format is correct according to OpenAI docs
    const response = await client.responses.parse({
      ...responsePayload,
      max_output_tokens: 30000,
    });

    const output = response.output_parsed
    return output
}

export async function POST(request: NextRequest) {
  // use chat gpt 5 mini to convert documents and then input to database.

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

  //safe file before processing

  // Extract base64 content from data URL (remove "data:application/pdf;base64," prefix)
  const base64Content = file.includes(',') ? file.split(',')[1] : file;

  const savedFile = await prisma.file.create({
    data: {
      userId: user.id, // You'll want to get this from auth session
      name: filename,
      size: Buffer.from(base64Content, 'base64').length, // Set appropriate size if available
      type: 'qsPaper', // or determine from filename/content
      mimetype: 'application/pdf',
      // content: can be added if you have the file buffer
      content: Buffer.from(base64Content, 'base64'),
      processorSessionId: sessionId || null // Associate with session if provided
    }
  });

  const qna = await PDFDocumentsToQnA(file, filename);
  // const qnaParsed = JSON.parse(JSON.stringify(qna));


  // Use our batch insert utility to store all questions with vectors
  const insertResults = await batchInsertQuestionsWithVectors(
    qna.QnAs.map((q: any) => ({
      questionNumber: q.questionNumber,
      question: q.question,
      type: q.type,
      parentQuestionNumber: q.parentQuestionNumber?.toString(),
      isMultipleChoice: q.isMultipleChoice,
      imageDescription: q.imageDescription,
      answer: q.answer,
      maxMarks: q.maxMarks,
      pageNumber: q.pageNumber,
      semanticSummary: q.semanticSummary,
    })),
    savedFile.id
  );

  // console.log('Batch insert results:', insertResults);  //inputting to db 



  console.log(qna, qna.answer)

  // //write to file
  // const dir = 'C:\\Users\\rayap\\OneDrive\\Desktop\\tidbHackathon\\apps\\backend\\output\\json';
  // fs.writeFileSync(`${dir}\\${filename.replace('.pdf', '.json')}`, JSON.stringify(qna, null, 2));





  return NextResponse.json({ qna });
  } catch (error) {
    console.error("Error processing document:", error);
    return NextResponse.json({ error: 'Failed to process document.' }, { status: 500 });
  }



  //step1: get image base64 and turn into inputable format for open ai api (done)
  //step2: create the json schema for structured output using zod (done)
  //step3: call open ai api with the image and the schema (done)


  //step4: get response and structure it to input database
  //step5: turn a copy of the response object into a one line semantic summary and turn it into a vector embedding
  //step6: input the structured data into the database along with the embedding






}
