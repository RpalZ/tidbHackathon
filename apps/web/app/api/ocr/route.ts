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
    const { image, filename } = await req.json();
    
    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }
    
    console.log(`Processing file: ${filename}`);
    
    // Extract base64 data (remove data:image/...;base64, prefix)
    const base64Data = image.split(',')[1];
    
    // Process with Google Document AI
    const name = client.processorPath(
      documentAIProjectId,
      documentAILocation,
      documentAIProcessorId
    );

    const request = {
      name,
      rawDocument: {
        content: base64Data,
        mimeType: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      },
      processOptions: {
        ocrConfig: {
          premiumFeatures: {
            enableMathOcr: true
          }
        }
      }
    };

    console.log('Sending request to Document AI...');
    const [result] = await client.processDocument(request);
    const { document } = result;
    
    console.log('Document processed successfully');
    console.log(`Total pages processed: ${document?.pages?.length || 0}`);
    
    // Extract page-by-page information
    const pages = document?.pages?.map((page, index) => ({
      pageNumber: index + 1,
      text: page.paragraphs?.map(p => p.layout?.textAnchor?.content || '').join('\n') || '',
      width: page.dimension?.width || 0,
      height: page.dimension?.height || 0
    })) || [];
    
    return NextResponse.json({ 
      success: true, 
      result: document?.text, // Full document text
      pages: pages, // Individual page data
      totalPages: document?.pages?.length || 0,
      filename: filename 
    });
    
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
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