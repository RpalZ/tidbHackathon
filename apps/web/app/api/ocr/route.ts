import {NextResponse, NextRequest} from 'next/server';
import OpenAI from 'openai';
import { DataService } from '@/lib/dataService';
import { z } from 'zod';
import {zodTextFormat} from "openai/helpers/zod"
import fs from 'fs';
import { prisma } from '@/lib/prisma';

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
    answer: z.string().describe("The text answer provided for the question").nullable(),
  })

  const mcqAnswer = z.object({
    type: z.literal("mcq"),
    choices: z.array(z.string()).describe("The list of choices available for the multiple-choice question including text of each choice"),
    answer: z.string().describe("The choice that is selected").nullable(),
  })
  const answerSchema = z.union([textAnswer, mcqAnswer]).nullable();

  const questionAndAnswerSchema = z.object({
    questionNumber: z.string().describe("The unique identifier for the question, such as '1', '2(a)', '3b(i)', etc."),
    question: z.string().describe("The text of the actual question"),
    type: z.enum(["main","subquestion","subpart"]).describe("main could be 1,2,3 etc. subquestion could be 1(a),1(b),2(a),2(b) etc. subpart could be 1(a)(i), 1(a)(ii), 1(b)(i), 1(b)(ii) etc."),
    parentQuestionNumber: z.string().nullable().describe("It can be 1,2,3 etc. for subquestions and subparts it can be 1(a),1(b),2(a),2(b) etc."),
    isMultipleChoice: z.boolean().default(false),
    imageDescription: z.string().nullable().describe("A brief description of any images associated with the question, if applicable. Be sure it is detailed enough to be useful to someone who cannot see the image."),
    answer: answerSchema,
    pageNumber: z.number(),
    semanticSummary: z.string().describe("A concise one-line summary of the question and answer for semantic and vector search purposes"),
  })


  const GPTschema = z.object({
    QnAs: z.array(questionAndAnswerSchema).min(1).max(50),
    lastParentQsProcessed: z.string(),
    totalPages: z.number()
  })

    const responsePayload = {
    model: "gpt-5-mini",
    reasoning: {effort: "medium"},
    text: {verbosity: "low", format: zodTextFormat(GPTschema, 'QnASchema')},
    input: [
      { role: "system", content: "You are a helpful assistant that extracts structured data from educational documents. You will be provided with a document. Your task is to analyze the content of the document and extract all relevant questions and answers, including multiple-choice questions, true/false questions, and written answer questions. The extracted data should be structured in a JSON format according to the provided schema. Imagine yourself as an intelligent OCR." },
      { role: "user", content: [
        {type: "input_text", text: `Extract the questions and answers from pdf provided in order using the schema provided`},
        {type: "input_file", file_data: pdf, filename}
      ]}
    ],
  } // Type assertion - correct according to OpenAI GPT-5-mini docs

    console.log("sending chunk to gpt 5 mini")

    // @ts-ignore - GPT-5-mini API format is correct according to OpenAI docs
    const response = await client.responses.parse({
      ...responsePayload,
      max_output_tokens: 10000,
    });

    const output = response.output_parsed
    return output
}

export async function POST(request: NextRequest) {
  // use chat gpt 5 mini to convert documents and then input to database.

  try {
      const { file, filename } = await request.json();
  
  const fileExtension = filename.split('.').pop()?.toLowerCase();

  if (fileExtension !== 'pdf') {
    return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF file.' }, { status: 400 });
  }


  const qna = await PDFDocumentsToQnA(file, filename);
  const qnaParsed = JSON.parse(JSON.stringify(qna));

  for (let qnas of qna.QnAs) {
    const semanticText = qnas.semanticSummary;

    // convert to embedding
    const embeddingResponse = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: semanticText,
    });

    //input to tidb db
  }



  //inputting to db 



  console.log(qna)

  //write to file
  const dir = 'C:\\Users\\rayap\\OneDrive\\Desktop\\tidbHackathon\\apps\\backend\\output\\json';
  fs.writeFileSync(`${dir}\\${filename.replace('.pdf', '.json')}`, JSON.stringify(qna, null, 2));





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
