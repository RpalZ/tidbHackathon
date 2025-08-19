import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';


// console.log(process.env.GOOGLE_CLOUD_CREDENTIALS, 'here are the credentials');
const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}');

const client = new DocumentProcessorServiceClient({
  credentials,
  // apiEndpoint: process.env.DOCUMENT_AI_API_ENDPOINT
});

const documentAILocation = process.env.DOCUMENT_AI_LOCATION as string;
const documentAIProjectId = process.env.DOCUMENT_AI_PROJECT_ID || 'your-project-id';
const documentAIProcessorId = process.env.DOCUMENT_AI_PROCESSOR_ID || 'your-processor-id';

const quickstart = async (filePath: string) => {
  const name = client.processorPath(
    documentAIProjectId,
    documentAILocation,
    documentAIProcessorId
  );
// console.log(`Processor name: ${name}`);
  const fs = require('fs');
  const file =  fs.readFileSync(filePath);
 
  const request = {
    name,
    rawDocument: {
      content: Buffer.from(file).toString('base64'),
      mimeType: 'application/pdf',
    },
    processOptions: {
      ocrConfig: {
        premiumFeatures: {
          enableMathOcr: true
        }
      }
    }
  };

  // console.log(`Request to process document: ${JSON.stringify(request)}`);
  try {

 
  console.log('request sent!')
  const [result] = await client.processDocument(request);
  const {document} = result;
  console.log(`Document processed successfully: ${result}`);
  return document;
   } catch (error) { 
    console.error('Error reading file:', error);
    throw new Error(`Failed to read file at ${filePath}`);
  }
  
}

// apps/web/app/api/ocr/route.ts
// This file handles OCR-related API requests
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // TODO: Add OCR processing logic here


    // request ocr api 
    const response = await axios.post('http://localhost:8000', data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }         
}


export async function GET(req: NextRequest) {
    // console.log("GET request received for OCR");
    // const {data} = await axios.get('http://localhost:8000/test');
    //testing round
    const file = "C:/Users/rayap/OneDrive/Desktop/TiDBHackathon/apps/backend/test.pdf"

    try {
        // console.log("Calling quickstart function with file:", file);
        // Call the quickstart function to process the document
        const document = await quickstart(file);
        // console.log("Document processed successfully:", document);
        return NextResponse.json({result: document?.text});
    } catch (error: any) {
        console.error("Error processing document:", error);
    }
    // const document = await quickstart(file);

}