import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import fs from 'fs';
import { Interface } from 'readline';
import path from 'path';
import sharp from 'sharp';
import { fromBase64 } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';

// Remove problematic canvas and pdfjs imports - we'll use pdf2pic instead


// console.log(process.env.GOOGLE_CLOUD_CREDENTIALS, 'here are the credentials');
const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}');

const client = new DocumentProcessorServiceClient({
  credentials,
  // apiEndpoint: process.env.DOCUMENT_AI_API_ENDPOINT
});

const documentAILocation = process.env.DOCUMENT_AI_LOCATION as string;
const documentAIProjectId = process.env.DOCUMENT_AI_PROJECT_ID || 'your-project-id';
const documentAIProcessorId = process.env.DOCUMENT_AI_PROCESSOR_ID || 'your-processor-id';

//to be used later for stage 2 processing
const premiumProcessorId = process.env.DOCUMENT_AI_PREMIUM_PROCESSOR_ID || 'your-premium-processor-id';

interface BoundingBox {
  content: string;
  page: number;
  boundingPoly: any;
}

const getBoundingBox = (entity: any): BoundingBox[] => {
  const pageRefs = entity.pageAnchor.pageRefs;
  return pageRefs.map((pageRef: any) => {
    return {
      content: entity.mentionText,
      page: pageRef.page,
      boundingPoly: pageRef.boundingPoly.normalizedVertices
    };
  });
};

// Helper function to convert PDF base64 to individual page images as base64
export async function convertPdfToImages(base64Data: string): Promise<string[]> {
  try {
    console.log('🚀 Starting PDF to images conversion using pdf2pic...');
    console.log(`📄 PDF base64 data length: ${base64Data.length} characters`);
    
    // Convert base64 to buffer for validation
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    console.log(`📦 PDF buffer size: ${pdfBuffer.length} bytes`);
    
    // Validate PDF header
    const pdfHeader = pdfBuffer.subarray(0, 5).toString();
    console.log(`📋 PDF header: "${pdfHeader}"`);
    if (!pdfHeader.startsWith('%PDF')) {
      throw new Error(`Invalid PDF header: ${pdfHeader}. Expected "%PDF"`);
    }
    
    // Configure pdf2pic with high quality settings
    console.log('⚙️ Configuring pdf2pic converter...');
    const convert = fromBase64(base64Data, {
      density: 200,           // DPI for high quality
      saveFilename: "page",   // Base filename
      savePath: "./temp",     // Temp directory (we won't actually save files)
      format: "png",          // Output format
      width: 2000,           // Max width for quality
      height: 2000,          // Max height for quality
      quality: 100           // PNG quality
    });
    
    console.log('🔄 Starting bulk conversion (all pages)...');
    console.time('PDF conversion time');
    
    // Get all pages as buffers
    const results = await convert.bulk(-1, { responseType: "buffer" });
    
    console.timeEnd('PDF conversion time');
    console.log(`📊 Conversion completed! Got ${results.length} results from pdf2pic`);
    
    const base64Images: string[] = [];
    
    // Convert each page buffer to base64
    for (let i = 0; i < results.length; i++) {
      try {
        console.log(`🔍 Processing result ${i + 1}/${results.length}...`);
        const result = results[i];
        
        if (!result) {
          console.error(`❌ Result ${i + 1} is null/undefined`);
          continue;
        }
        
        console.log(`📝 Result ${i + 1} properties:`, Object.keys(result));
        
        if (result.buffer) {
          console.log(`📏 Page ${i + 1} buffer size: ${result.buffer.length} bytes`);
          
          // Convert buffer directly to base64
          const base64Image = result.buffer.toString('base64');
          console.log(`🔄 Page ${i + 1} converted to base64, length: ${base64Image.length} chars`);
          
          base64Images.push(base64Image);
          console.log(`✅ Generated page ${i + 1}/${results.length} image successfully`);
        } else {
          console.warn(`⚠️ No buffer for page ${i + 1}. Result:`, result);
        }
      } catch (pageError) {
        console.error(`❌ Error processing page ${i + 1}:`, pageError);
        console.error(`❌ Page error stack:`, (pageError as Error).stack);
        // Continue with next page
      }
    }
    
    console.log(`🎉 Successfully generated ${base64Images.length} REAL page images with pdf2pic!`);
    console.log(`📈 Success rate: ${base64Images.length}/${results.length} pages (${Math.round(base64Images.length/results.length*100)}%)`);
    
    return base64Images;
  } catch (error) {
    console.error('❌ CRITICAL ERROR in convertPdfToImages:', error);
    console.error('❌ Error name:', (error as Error).name);
    console.error('❌ Error message:', (error as Error).message);
    console.error('❌ Error stack:', (error as Error).stack);
    
    // Check if it's the EOF error specifically
    if ((error as any).code === 'EOF') {
      console.error('🔥 EOF Error detected - this usually means the pdf2pic process was terminated');
      console.error('🔍 This could be due to:');
      console.error('   - Missing GraphicsMagick/ImageMagick installation');
      console.error('   - Insufficient memory');
      console.error('   - PDF file corruption');
      console.error('   - Process timeout');
    }
    
    throw new Error(`PDF to image conversion failed: ${(error as Error).message}`);
  }
};

/**
 * STAGE 1 → STAGE 2 PDF COMPILATION FUNCTION (COST-OPTIMIZED)
 *
 * This function takes cropped Q&A entities from Stage 1 and compiles them 
 * into a single PDF with **4 Q&A PAIRS PER PAGE** for cost optimization.
 * 
 * FLOW:
 * 1. Stage 1 produces: croppedQAImages[] = [{entityType, pageNumber, content, imageBase64}]
 * 2. This function creates: compiledPDF (base64) with 4 Q&A entities per page in vertical stack
 * 3. Stage 2 consumes: compiledPDF → enhanced math OCR → improved Q&A text
 * 
 * LAYOUT:
 * - Vertical reading flow: Question 1 → Answer 1 → Question 2 → Answer 2
 * - Each page: 4 entities stacked vertically (4x1 column layout)
 * - Natural Q&A pairing and reading order maintained
 * 
 * COST OPTIMIZATION:
 * - 16 Q&A entities → 4 PDF pages (instead of 16 pages)
 * - ~75% reduction in Document AI API costs
 * - Maintains readability with vertical Q→A→Q→A flow
 * 
 * @param croppedQAEntities Array of Q&A entities with base64 images (Stage 1 output)
 * @returns PDF as base64 string ready for Stage 2 OCR processing
 */
const compileQAEntitiesToPDF = async (croppedQAEntities: Array<{
  entityType: string;
  pageNumber: number;
  content: string;
  imageBase64: string;
  confidence?: number;
  originalEntityIndex?: number; // Track original position for mapping back
}>): Promise<string> => {
  try {
    console.log('\n📚 === STAGE 1 → STAGE 2 PDF COMPILATION (COST-OPTIMIZED) ===');
    console.log(`📊 Compiling ${croppedQAEntities.length} Q&A entities into PDF with 4 pairs per page`);
    
    const pdfDoc = await PDFDocument.create();
    const entitiesPerPage = 4; // 4 Q&A pairs per page for cost optimization
    const totalPages = Math.ceil(croppedQAEntities.length / entitiesPerPage);
    
    console.log(`📄 Will create ${totalPages} pages (${entitiesPerPage} entities per page)`);
    console.log(`💰 Cost savings: ${croppedQAEntities.length - totalPages} fewer API calls vs 1-per-page`);
    
    // Process entities in groups of 4
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIdx = pageIndex * entitiesPerPage;
      const endIdx = Math.min(startIdx + entitiesPerPage, croppedQAEntities.length);
      const entitiesForThisPage = croppedQAEntities.slice(startIdx, endIdx);
      
      console.log(`\n📄 Creating PDF page ${pageIndex + 1}/${totalPages}:`);
      console.log(`   - Entities ${startIdx + 1}-${endIdx}: ${entitiesForThisPage.length} Q&A pairs`);
      
      // Standard page size (Letter: 612x792 points)
      const pageWidth = 612;
      const pageHeight = 792;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const padding = 15; // Padding between vertical entities
      
      // 4x1 vertical layout for Q→A→Q→A readability
      const cols = 1; // Single column
      const rows = 4; // 4 rows vertically
      const cellWidth = pageWidth - (2 * padding); // Full width minus padding
      const cellHeight = (pageHeight - (5 * padding)) / rows; // Divide height by 4 rows + padding
      
      console.log(`   - Page layout: ${cols}x${rows} vertical stack, ${cellWidth}x${cellHeight} per cell`);
      console.log(`   - Reading flow: Q1 → A1 → Q2 → A2 (top to bottom)`);
      
      // Place each entity vertically
      for (let entityIdx = 0; entityIdx < entitiesForThisPage.length; entityIdx++) {
        const entity = entitiesForThisPage[entityIdx];
        
        if (!entity) {
          console.warn(`      ⚠️ Skipping undefined entity at position ${entityIdx}`);
          continue;
        }
        
        try {
          console.log(`      📝 Processing entity ${entityIdx + 1}/4: ${entity.entityType}`);
          
          // Calculate vertical position (0 = top, 3 = bottom)
          const row = entityIdx; // Simple: entity 0→row 0, entity 1→row 1, etc.
          
          // Calculate cell position on page
          const cellX = padding;
          const cellY = pageHeight - (row + 1) * cellHeight - (row * padding); // PDF coordinates from bottom
          const availableWidth = cellWidth;
          const availableHeight = cellHeight - padding;
          
          console.log(`      📍 Vertical position: row=${row} (${entity.entityType})`);
          console.log(`      📐 Cell bounds: x=${cellX}, y=${cellY}, w=${availableWidth}, h=${availableHeight}`);
          
          // Convert base64 to buffer and embed image
          const imgBuffer = Buffer.from(entity.imageBase64, 'base64');
          
          // Auto-detect format and embed
          const isPng = imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4E;
          const isJpeg = imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8 && imgBuffer[2] === 0xFF;
          
          let embeddedImage: any;
          if (isPng) {
            embeddedImage = await pdfDoc.embedPng(imgBuffer);
          } else if (isJpeg) {
            embeddedImage = await pdfDoc.embedJpg(imgBuffer);
          } else {
            embeddedImage = await pdfDoc.embedPng(imgBuffer); // Fallback
          }
          
          // Scale image to fit within cell while preserving aspect ratio
          const { width: imgWidth, height: imgHeight } = embeddedImage.size();
          const scaleX = availableWidth / imgWidth;
          const scaleY = availableHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY); // Preserve aspect ratio
          
          const scaledWidth = imgWidth * scale;
          const scaledHeight = imgHeight * scale;
          
          // Center image within cell
          const imageX = cellX + (availableWidth - scaledWidth) / 2;
          const imageY = cellY + (availableHeight - scaledHeight) / 2;
          
          console.log(`      🖼️ Image: ${imgWidth}x${imgHeight} → ${Math.round(scaledWidth)}x${Math.round(scaledHeight)} (scale: ${scale.toFixed(2)})`);
          
          // Draw the scaled image in the cell
          page.drawImage(embeddedImage, {
            x: imageX,
            y: imageY,
            width: scaledWidth,
            height: scaledHeight,
          });
          
          console.log(`      ✅ Placed ${entity.entityType} in vertical row ${row}`);
          
        } catch (entityError) {
          console.error(`      ❌ Error processing entity ${entityIdx + 1}:`, entityError);
          // Continue with next entity - don't fail entire page
        }
      }
      
      console.log(`   ✅ PDF page ${pageIndex + 1} completed with ${entitiesForThisPage.length} entities`);
    }
    
    console.log(`\n📈 Compilation Summary:`);
    console.log(`   - Input Q&A entities: ${croppedQAEntities.length}`);
    console.log(`   - Output PDF pages: ${totalPages}`);
    console.log(`   - Entities per page: ${entitiesPerPage}`);
    console.log(`   - Cost reduction: ${Math.round((1 - totalPages/croppedQAEntities.length) * 100)}% fewer API calls`);
    
    // Generate final PDF bytes
    console.log(`💾 Generating compiled PDF bytes...`);
    console.time('PDF generation time');
    
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    
    console.timeEnd('PDF generation time');
    
    console.log(`\n🎉 STAGE 1 → STAGE 2 PDF COMPILATION COMPLETE!`);
    console.log(`📊 Final PDF stats:`);
    console.log(`   - Total pages: ${totalPages} (${entitiesPerPage} Q&A entities per page)`);
    console.log(`   - PDF size: ${pdfBytes.length} bytes`);
    console.log(`   - Base64 size: ${pdfBase64.length} chars`);
    console.log(`   - Ready for cost-optimized Stage 2 Math OCR processing`);
    
    return pdfBase64;
    
  } catch (error) {
    console.error('\n❌ CRITICAL ERROR in Stage 1 → Stage 2 PDF compilation:', error);
    console.error('❌ This breaks the two-stage pipeline - Stage 2 cannot proceed');
    throw new Error(`PDF compilation failed: ${(error as Error).message}`);
  }
};

/**
 * TWO-STAGE OCR PIPELINE - STAGE 2 ENHANCED MATH OCR PROCESSOR (COST-OPTIMIZED)
 * 
 * This function takes the compiled Q&A PDF from Stage 1 and processes it with
 * Document AI's premium Math OCR features. Now optimized with 4 Q&A pairs per page.
 * 
 * FLOW:
 * 1. Receives: compiledPDF (base64) containing Q&A entities in vertical stacks (4 per page)
 * 2. Processes: Document AI with Math OCR premium features enabled
 * 3. Returns: Enhanced OCR results with improved math/formula recognition
 * 
 * LAYOUT OPTIMIZATION:
 * - Vertical reading flow: Q1 → A1 → Q2 → A2 (natural Q&A pairing)
 * - 16 Q&A entities → 4 PDF pages → 4 API calls (vs 16 with 1-per-page)
 * - ~75% reduction in Document AI processing costs
 * - Vertical layout maintains entity separation for OCR accuracy
 * 
 * @param compiledPdfBase64 Cost-optimized PDF from Stage 1 (4 Q&A pairs per page)
 * @param stage1Entities Original entities for enhanced result mapping
 * @returns Enhanced OCR results with improved math recognition
 */
const processStage2MathOCR = async (
  compiledPdfBase64: string,
  stage1Entities: Array<{
    entityType: string;
    pageNumber: number;
    content: string;
    imageBase64: string;
    confidence?: number;
  }>
) => {
  try {
    console.log('\n🧮 === STAGE 2 ENHANCED MATH OCR PROCESSING ===');
    console.log(`📊 Processing compiled PDF with ${stage1Entities.length} Q&A entities`);
    console.log(`📋 Compiled PDF size: ${compiledPdfBase64.length} base64 chars`);
    
    // Configure Document AI processor for Stage 2 with PREMIUM MATH OCR features
    const name = client.processorPath(
      documentAIProjectId,
      documentAILocation,
      // Use premium processor for Stage 2 math processing
      premiumProcessorId
    );

    console.log(`🎯 Using processor: ${name}`);
    console.log(`🧮 Math OCR enabled: Premium features for mathematical content`);

    // Stage 2 processing request with ENHANCED MATH OCR
    const stage2Request = {
      name,
      rawDocument: {
        content: compiledPdfBase64,
        mimeType: 'application/pdf',
      },
      processOptions: {
        // PREMIUM OCR CONFIG - Focus on math and quality
        ocrConfig: {
          enableNativePdfParsing: true,
          enableImageQualityScores: true,
          enableSymbol: true,
          computeStyleInfo: true,
          // 🧮 CRITICAL: Enable Math OCR for Stage 2 processing
          premiumFeatures: {
            enableMathOcr: true,           // Enhanced mathematical formula recognition
            enableSelectionMarkDetection: true, // Better checkbox/selection detection
            computeStyleInfo: true         // Enhanced formatting recognition
          }
        },
        // Enhanced layout processing for Q&A structure
        layoutConfig: {
          chunkingConfig: {
            chunkSize: 1000,              // Larger chunks for complete Q&A pairs
            includeAncestorHeadings: true // Maintain question-answer relationships
          }
        }
      }
    };

    console.log('📤 Sending Stage 2 request to Document AI with Math OCR...');
    console.time('Stage 2 Math OCR processing time');

    let stage2Document: any;
    let processorType = 'premium-math';
    
    try {
      // Attempt premium Math OCR processing
      const [stage2Result] = await client.processDocument(stage2Request);
      stage2Document = stage2Result.document;
      console.log('✅ Stage 2 Math OCR processing completed successfully');
      
    } catch (mathOcrError) {
      console.warn('⚠️ Premium Math OCR failed, attempting fallback...', mathOcrError);
      
      // Fallback: Use basic OCR if Math OCR fails
      const fallbackRequest = {
        name: client.processorPath(documentAIProjectId, documentAILocation, documentAIProcessorId),
        rawDocument: {
          content: compiledPdfBase64,
          mimeType: 'application/pdf',
        }
      };
      
      const [fallbackResult] = await client.processDocument(fallbackRequest);
      stage2Document = fallbackResult.document;
      processorType = 'basic-fallback';
      console.log('✅ Stage 2 processing completed with basic OCR fallback');
    }

    console.timeEnd('Stage 2 Math OCR processing time');

    // STAGE 2 RESULTS ANALYSIS
    const stage2Pages = stage2Document?.pages || [];
    const stage2Text = stage2Document?.text || '';
    const stage2Entities = stage2Document?.entities || [];

    console.log(`\n📊 Stage 2 Results Analysis:`);
    console.log(`   - Pages processed: ${stage2Pages.length}`);
    console.log(`   - Total text length: ${stage2Text.length} chars`);
    console.log(`   - Entities detected: ${stage2Entities.length}`);
    console.log(`   - Processor used: ${processorType}`);

    // MAP STAGE 2 RESULTS BACK TO STAGE 1 ENTITIES
    // CRITICAL: Stage 2 pages should correspond 1:1 with Stage 1 entities
    const enhancedEntities = [];
    
    console.log(`\n🔗 === STAGE 1 ↔ STAGE 2 ENTITY MAPPING ===`);
    
    for (let pageIndex = 0; pageIndex < stage2Pages.length; pageIndex++) {
      const stage2Page = stage2Pages[pageIndex];
      const correspondingStage1Entity = stage1Entities[pageIndex];
      
      if (!correspondingStage1Entity) {
        console.warn(`⚠️ No Stage 1 entity for Stage 2 page ${pageIndex + 1}`);
        continue;
      }
      
      // Extract enhanced text from Stage 2 page
      const enhancedText = stage2Page.paragraphs?.map((p: any) => 
        p.layout?.textAnchor?.content || ''
      ).join('\n') || '';
      
      console.log(`\n📋 Entity ${pageIndex + 1} mapping:`);
      console.log(`   - Stage 1 type: ${correspondingStage1Entity.entityType}`);
      console.log(`   - Stage 1 text length: ${correspondingStage1Entity.content.length} chars`);
      console.log(`   - Stage 2 text length: ${enhancedText.length} chars`);
      console.log(`   - Enhancement: ${enhancedText.length > correspondingStage1Entity.content.length ? 'IMPROVED' : 'SIMILAR'}`);
      
      // Create enhanced entity with Stage 2 improvements
      enhancedEntities.push({
        // Preserve Stage 1 metadata
        originalEntityType: correspondingStage1Entity.entityType,
        originalPageNumber: correspondingStage1Entity.pageNumber,
        originalConfidence: correspondingStage1Entity.confidence,
        originalImageBase64: correspondingStage1Entity.imageBase64,
        
        // Enhanced Stage 2 content
        enhancedText: enhancedText,
        stage2PageNumber: pageIndex + 1,
        stage2Confidence: stage2Page.quality?.qualityScore || 0,
        
        // Improvement metrics
        textLengthImprovement: enhancedText.length - correspondingStage1Entity.content.length,
        processingStage: 'stage2-enhanced',
        mathOcrApplied: processorType.includes('math')
      });
    }
    
    console.log(`\n🎉 STAGE 2 MATH OCR PROCESSING COMPLETE!`);
    console.log(`📈 Final mapping results:`);
    console.log(`   - Stage 1 entities: ${stage1Entities.length}`);
    console.log(`   - Stage 2 pages: ${stage2Pages.length}`);
    console.log(`   - Successfully mapped: ${enhancedEntities.length}`);
    console.log(`   - Mapping success rate: ${Math.round(enhancedEntities.length / stage1Entities.length * 100)}%`);

    return {
      success: true,
      stage2Document,
      enhancedEntities,
      processorType,
      stage1Count: stage1Entities.length,
      stage2Count: stage2Pages.length,
      mappedCount: enhancedEntities.length,
      totalEnhancedText: stage2Text,
      mathOcrEnabled: processorType.includes('math')
    };

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR in Stage 2 Math OCR processing:', error);
    console.error('❌ Stage 2 processing failed - pipeline incomplete');
    throw new Error(`Stage 2 Math OCR failed: ${(error as Error).message}`);
  }
};

// Helper function to crop ACTUAL images by bounding box
const cropImageByBoundingBox = async (
  imageBase64: string, 
  bbox: any[], 
  pageWidth: number, 
  pageHeight: number
): Promise<string> => {
  try {
    console.log(`✂️ Starting image crop operation...`);
    console.log(`📏 Page dimensions: ${pageWidth}x${pageHeight}`);
    console.log(`📍 Bounding box vertices:`, bbox);
    
    // Convert normalized vertices to pixel coordinates
    const xs = bbox.map((v: any) => v.x * pageWidth);
    const ys = bbox.map((v: any) => v.y * pageHeight);
    
    console.log(`🔢 Pixel coordinates - X values:`, xs);
    console.log(`🔢 Pixel coordinates - Y values:`, ys);
    
    const left = Math.max(0, Math.min(...xs));
    const top = Math.max(0, Math.min(...ys));
    const right = Math.min(pageWidth, Math.max(...xs));
    const bottom = Math.min(pageHeight, Math.max(...ys));
    
    const width = right - left;
    const height = bottom - top;
    
    console.log(`📐 Crop rectangle: left=${left}, top=${top}, width=${width}, height=${height}`);
    
    if (width <= 0 || height <= 0) {
      console.error(`❌ Invalid bounding box dimensions: width=${width}, height=${height}`);
      throw new Error('Invalid bounding box dimensions');
    }
    
    console.log(`📸 Input image base64 length: ${imageBase64.length} chars`);
    
    // Convert base64 to buffer and ACTUALLY crop the image using Sharp
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log(`📦 Image buffer size: ${imageBuffer.length} bytes`);
    
    console.log(`🔧 Applying Sharp crop operation...`);
    console.time('Sharp crop operation');
    
    const croppedBuffer = await sharp(imageBuffer)
      .extract({ 
        left: Math.round(left), 
        top: Math.round(top), 
        width: Math.round(width), 
        height: Math.round(height) 
      })
      .png()
      .toBuffer();
    
    console.timeEnd('Sharp crop operation');
    console.log(`📦 Cropped buffer size: ${croppedBuffer.length} bytes`);
    
    const croppedBase64 = croppedBuffer.toString('base64');
    console.log(`🎉 Cropped base64 length: ${croppedBase64.length} chars`);
    console.log(`✂️ Successfully cropped REAL image: ${Math.round(width)}x${Math.round(height)} pixels`);
    
    return croppedBase64;
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in cropImageByBoundingBox:', error);
    console.error('❌ Crop error name:', (error as Error).name);
    console.error('❌ Crop error message:', (error as Error).message);
    console.error('❌ Crop error stack:', (error as Error).stack);
    throw error;
  }
};

// NEW: Master crop function that finds overall boundaries of Q&A entities ONLY (excludes images)
const cropMasterRegionFromAllEntities = async (
  imageBase64: string,
  allEntities: any[],
  pageWidth: number,
  pageHeight: number
): Promise<string> => {
  try {
    console.log(`🎯 Starting master crop for ${allEntities.length} entities`);
    
    // FILTER: Only process Q&A entities for crop bounds (exclude Images)
    const qaOnlyEntities = allEntities.filter((entity: any) => 
      entity.entityType === "Question" || entity.entityType === "Answer"
    );
    
    console.log(`📋 Filtering entities for crop bounds:`);
    console.log(`   - Total entities: ${allEntities.length}`);
    console.log(`   - Q&A entities (for cropping): ${qaOnlyEntities.length}`);
    console.log(`   - Images (excluded from crop): ${allEntities.length - qaOnlyEntities.length}`);
    
    if (qaOnlyEntities.length === 0) {
      throw new Error('No Q&A entities found for master crop');
    }
    
    // Find global min/max coordinates across Q&A entities ONLY
    let globalMinX = Infinity, globalMinY = Infinity;
    let globalMaxX = -Infinity, globalMaxY = -Infinity;
    let entitiesProcessed = 0;
    
    for (const entity of qaOnlyEntities) {
      const boundingBoxData = getBoundingBox(entity);
      
      if (boundingBoxData && boundingBoxData.length > 0) {
        const boundingBoxItem = boundingBoxData[0];
        const bbox = boundingBoxItem ? boundingBoxItem.boundingPoly : null;
        
        if (bbox && bbox.length > 0) {
          for (const vertex of bbox) {
            const x = vertex.x * pageWidth;
            const y = vertex.y * pageHeight;
            globalMinX = Math.min(globalMinX, x);
            globalMinY = Math.min(globalMinY, y);
            globalMaxX = Math.max(globalMaxX, x);
            globalMaxY = Math.max(globalMaxY, y);
          }
          entitiesProcessed++;
        }
      }
    }
    
    if (entitiesProcessed === 0) {
      throw new Error('No valid Q&A bounding boxes found for master crop');
    }
    
    console.log(`📊 Processed ${entitiesProcessed} Q&A entities with valid bounding boxes`);
    console.log(`📐 Q&A-only crop bounds: minX=${globalMinX}, minY=${globalMinY}, maxX=${globalMaxX}, maxY=${globalMaxY}`);
    console.log(`🚫 Images excluded from physical crop region (prevents OCR detection of image text)`);
    
    // Add padding around the master region
    const padding = 20;
    const left = Math.max(0, Math.floor(globalMinX - padding));
    const top = Math.max(0, Math.floor(globalMinY - padding));
    const right = Math.min(pageWidth, Math.ceil(globalMaxX + padding));
    const bottom = Math.min(pageHeight, Math.ceil(globalMaxY + padding));
    
    const width = right - left;
    const height = bottom - top;
    
    console.log(`📐 Master Q&A crop region: left=${left}, top=${top}, width=${width}, height=${height}`);
    
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid master crop dimensions: width=${width}, height=${height}`);
    }
    
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log(`🔧 Applying master Q&A crop operation (images excluded)...`);
    
    // Perform the master crop
    const masterCroppedBuffer = await sharp(imageBuffer)
      .extract({ 
        left: Math.round(left), 
        top: Math.round(top), 
        width: Math.round(width), 
        height: Math.round(height) 
      })
      .png()
      .toBuffer();
    
    const masterCroppedBase64 = masterCroppedBuffer.toString('base64');
    console.log(`✅ Master Q&A crop complete: ${masterCroppedBase64.length} base64 chars`);
    console.log(`🎯 Master region encompasses ${entitiesProcessed} Q&A entities ONLY (no images)`);
    
    return masterCroppedBase64;
  } catch (error) {
    console.error('❌ Error creating master crop:', error);
    throw new Error(`Failed to create master crop: ${error}`);
  }
};

// Helper function to process PDF base64 and return cropped images with Document AI results
// THIS IS THE MAIN TWO-STAGE OCR PIPELINE ORCHESTRATOR
const processPdfWithCropping = async (base64Data: string, filename: string) => {
  console.log('\n🚀 === TWO-STAGE OCR PIPELINE STARTED ===');
  console.log(`📄 Processing file: ${filename}`);
  console.log(`📊 Input PDF size: ${base64Data.length} base64 chars`);
  
  // ========================================
  // STAGE 1: INITIAL OCR + ENTITY DETECTION + IMAGE CROPPING
  // ========================================
  console.log('\n📋 === STAGE 1: INITIAL OCR & ENTITY DETECTION ===');
  
  // Process with Google Document AI (Stage 1 - Entity Detection)
  const name = client.processorPath(
    documentAIProjectId,
    documentAILocation,
    documentAIProcessorId
  );

  const stage1Request = {
    name,
    rawDocument: {
      content: base64Data,
      mimeType: 'application/pdf',
    },
    processOptions: {
      ocrConfig: {
        enableNativePdfParsing: true,
        enableImageQualityScores: true,
        enableSymbol: true,
        computeStyleInfo: true,
        // Basic OCR for Stage 1 - focus on entity detection, not math processing
        premiumFeatures: {
          enableMathOcr: false,  // Save math OCR for Stage 2
          enableSelectionMarkDetection: true
        }
      },
      layoutConfig: {
        chunkingConfig: {
          chunkSize: 500,
          includeAncestorHeadings: true
        }
      }
    }
  };

  console.log('📤 Sending Stage 1 request to Document AI...');
  console.time('Stage 1 OCR processing time');
  
  let stage1Document: any;
  let stage1ProcessorType = 'stage1-basic';
  
  try {
    const [stage1Result] = await client.processDocument(stage1Request);
    stage1Document = stage1Result.document;
    console.log('✅ Stage 1 OCR processing completed successfully');
  } catch (stage1Error) {
    console.warn('⚠️ Stage 1 premium features failed, falling back to basic OCR:', stage1Error);
    
    const fallbackRequest = {
      name,
      rawDocument: {
        content: base64Data,
        mimeType: 'application/pdf',
      }
    };
    
    const [fallbackResult] = await client.processDocument(fallbackRequest);
    stage1Document = fallbackResult.document;
    stage1ProcessorType = 'stage1-fallback';
    console.log('✅ Stage 1 processing completed with basic OCR fallback');
  }

  console.timeEnd('Stage 1 OCR processing time');

  // STAGE 1 ENTITY ANALYSIS & FILTERING
  const allEntities = stage1Document?.entities || [];
  const allPages = stage1Document?.pages || [];
  
  console.log(`\n📊 Stage 1 Results Analysis:`);
  console.log(`   - Total entities detected: ${allEntities.length}`);
  console.log(`   - Total pages: ${allPages.length}`);
  
  // CRITICAL FILTER: Process ONLY Question and Answer entities (exclude Images for cost optimization)
  const qaEntities = allEntities.filter((entity: any) => {
    const entityType = entity.type?.toLowerCase() || '';
    const isQA = entityType.includes('question') || entityType.includes('answer');
    console.log(`   - Entity "${entity.type}": ${isQA ? 'INCLUDED' : 'EXCLUDED'} (${entity.mentionText?.substring(0, 30)}...)`);
    return isQA;
  });
  
  console.log(`\n🎯 Q&A Entity Filtering Results (Cost-Optimized):`);
  console.log(`   - Total entities: ${allEntities.length}`);
  console.log(`   - Q&A entities: ${qaEntities.length}`);
  console.log(`   - Images excluded: ${allEntities.length - qaEntities.length} (saved for later)`);

  // Convert PDF to page images and crop Q&A entities only
  const stage1CroppedQAImages: Array<{
    entityType: string;
    pageNumber: number;
    content: string;
    imageBase64: string;
    confidence?: number;
  }> = [];
  
  let pageImages: string[] = [];
  
  try {
    // Convert original PDF to page images for cropping
    pageImages = await convertPdfToImages(base64Data);
    console.log(`🖼️ Stage 1: Generated ${pageImages.length} page images for entity cropping`);
    
    if (qaEntities.length > 0 && pageImages.length > 0) {
      console.log(`\n✂️ === STAGE 1 Q&A ENTITY CROPPING (Cost-Optimized) ===`);
      console.log(`🎯 Processing ${qaEntities.length} Q&A entities for cropping`);
      
      // Process each Q&A entity and crop its image
      for (let entityIdx = 0; entityIdx < qaEntities.length; entityIdx++) {
        const entity = qaEntities[entityIdx];
        console.log(`\n🏷️ Processing Q&A entity ${entityIdx + 1}/${qaEntities.length}:`);
        console.log(`   - Type: ${entity.type}`);
        console.log(`   - Text: "${entity.mentionText?.substring(0, 50)}..."`);
        console.log(`   - Confidence: ${entity.confidence || 'N/A'}`);
        
        try {
          const boundingBoxes = getBoundingBox(entity);
          console.log(`   - Bounding boxes found: ${boundingBoxes.length}`);
          
          for (let bboxIdx = 0; bboxIdx < boundingBoxes.length; bboxIdx++) {
            const box = boundingBoxes[bboxIdx];
            if (!box) {
              console.warn(`      ⚠️ Bounding box ${bboxIdx + 1} is null/undefined`);
              continue;
            }
            
            console.log(`\n   📦 Processing bounding box ${bboxIdx + 1}/${boundingBoxes.length}:`);
            console.log(`      - Page: ${box.page + 1}`);
            console.log(`      - Content: "${box.content?.substring(0, 30)}..."`);
            
            const pageIdx = box.page;
            
            if (pageIdx < pageImages.length && pageIdx < allPages.length) {
              const imageBase64 = pageImages[pageIdx];
              const page = allPages[pageIdx];
              
              if (imageBase64 && page?.dimension) {
                const entityType = entity.type || 'unknown';
                
                console.log(`      - Cropping ${entityType} from page ${pageIdx + 1}...`);
                
                // Crop the Q&A entity image
                const croppedImageBase64 = await cropImageByBoundingBox(
                  imageBase64, 
                  box.boundingPoly, 
                  page.dimension.width || 1, 
                  page.dimension.height || 1
                );
                
                stage1CroppedQAImages.push({
                  entityType,
                  pageNumber: pageIdx + 1,
                  content: entity.mentionText || '',
                  imageBase64: croppedImageBase64,
                  confidence: entity.confidence
                });
                
                console.log(`      ✅ Successfully cropped ${entityType}`);
              } else {
                console.warn(`      ⚠️ Missing image or dimensions for page ${pageIdx + 1}`);
              }
            } else {
              console.warn(`      ⚠️ Page index ${pageIdx} out of bounds`);
            }
          }
        } catch (entityError) {
          console.error(`      ❌ Error processing entity ${entity.type}:`, entityError);
        }
      }
    } else if (qaEntities.length === 0) {
      console.warn('⚠️ No Q&A entities found for Stage 2 processing');
    } else if (pageImages.length === 0) {
      console.warn('⚠️ No page images generated - Stage 2 cannot proceed');
    }
    
  } catch (conversionError) {
    console.error('❌ Error in Stage 1 PDF processing:', conversionError);
    throw conversionError;
  }

  console.log(`\n📈 Stage 1 Completion Summary:`);
  console.log(`   - Q&A entities detected: ${qaEntities.length}`);
  console.log(`   - Successfully cropped: ${stage1CroppedQAImages.length}`);
  console.log(`   - Stage 1 success rate: ${qaEntities.length ? Math.round(stage1CroppedQAImages.length / qaEntities.length * 100) : 0}%`);

  // ========================================
  // STAGE 2: COMPILE Q&A PDF + ENHANCED MATH OCR (4 Q&A pairs per page)
  // ========================================
  let stage2Results = null;
  
  if (stage1CroppedQAImages.length > 0) {
    console.log('\n🧮 === STAGE 2: COMPILED PDF + ENHANCED MATH OCR ===');
    
    try {
      // Step 1: Compile Q&A entities into PDF with 4 pairs per page for cost optimization
      console.log('📚 Compiling Q&A entities into PDF (4 pairs per page)...');
      const compiledPdf = await compileQAEntitiesToPDF(stage1CroppedQAImages);
      
      // Step 2: Process compiled PDF with enhanced Math OCR
      console.log('🧮 Processing compiled PDF with Math OCR...');
      stage2Results = await processStage2MathOCR(compiledPdf, stage1CroppedQAImages);
      
      console.log('✅ Two-stage OCR pipeline completed successfully!');
      
    } catch (stage2Error) {
      console.error('❌ Stage 2 processing failed:', stage2Error);
      console.log('⚠️ Continuing with Stage 1 results only...');
      // Continue with Stage 1 results - don't fail entire pipeline
    }
  } else {
    console.log('\n⚠️ Skipping Stage 2: No Q&A entities available for Math OCR processing');
  }

  // ========================================
  // FINAL RESULTS COMPILATION
  // ========================================
  console.log('\n📋 === FINAL PIPELINE RESULTS ===');

  // Extract page-by-page information from Stage 1
  const pages = allPages.map((page: any, index: number) => ({
    pageNumber: index + 1,
    text: page.paragraphs?.map((p: any) => p.layout?.textAnchor?.content || '').join('\n') || '',
    width: page.dimension?.width || 0,
    height: page.dimension?.height || 0
  }));

  const finalResults = {
    success: true,
    
    // Stage 1 Results
    stage1: {
      result: stage1Document?.text,
      pages: pages,
      totalPages: allPages.length,
      allEntities: allEntities.length,
      qaEntities: qaEntities.length,
      croppedQAImages: stage1CroppedQAImages,
      processorType: stage1ProcessorType
    },
    
    // Stage 2 Results (if available)
    stage2: stage2Results || {
      success: false,
      message: 'Stage 2 not executed - no Q&A entities or processing failed'
    },
    
    // Pipeline Summary
    pipeline: {
      twoStageEnabled: !!stage2Results,
      mathOcrApplied: stage2Results?.mathOcrEnabled || false,
      totalQAEntities: stage1CroppedQAImages.length,
      enhancedEntities: stage2Results?.enhancedEntities?.length || 0,
      imageGenerationMode: 'real-images',
      filename: filename
    }
  };

  console.log(`\n🎉 === TWO-STAGE OCR PIPELINE COMPLETE ===`);
  console.log(`📊 Final Statistics:`);
  console.log(`   - Stage 1 Q&A entities: ${finalResults.stage1.qaEntities}`);
  console.log(`   - Stage 1 cropped images: ${finalResults.stage1.croppedQAImages.length}`);
  console.log(`   - Stage 2 enhanced entities: ${(finalResults.stage2 as any).enhancedEntities?.length || 0}`);
  console.log(`   - Math OCR applied: ${finalResults.pipeline.mathOcrApplied ? 'YES' : 'NO'}`);
  console.log(`   - Pipeline success: ${finalResults.pipeline.twoStageEnabled ? 'COMPLETE' : 'PARTIAL'}`);

  return finalResults;
};

// apps/web/app/api/ocr/route.ts
// This file handles OCR-related API requests with TWO-STAGE OCR PIPELINE
export async function POST(req: NextRequest) {
  try {
    const { image, filename } = await req.json();
    
    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }
    
    console.log(`\n📋 === POST REQUEST: TWO-STAGE OCR API ===`);
    console.log(`📄 Processing uploaded file: ${filename}`);
    
    // Extract base64 data (remove data:application/pdf;base64, prefix)
    const base64Data = image.split(',')[1];
    
    // Check if it's a PDF to enable two-stage pipeline
    if (filename.toLowerCase().endsWith('.pdf')) {
      console.log('🎯 PDF detected - running TWO-STAGE OCR PIPELINE');
      const result = await processPdfWithCropping(base64Data, filename);
      return NextResponse.json(result);
    }
    
    // For non-PDF files, use single-stage processing (existing logic)
    console.log('📷 Image file detected - using single-stage OCR');
    const name = client.processorPath(
      documentAIProjectId,
      documentAILocation,
      documentAIProcessorId
    );

    const request = {
      name,
      rawDocument: {
        content: base64Data,
        mimeType: 'image/jpeg',
      },
      processOptions: {
        ocrConfig: {
          enableNativePdfParsing: true,
          enableImageQualityScores: true,
          enableSymbol: true,
          computeStyleInfo: true,
          premiumFeatures: {
            enableMathOcr: true,
            enableSelectionMarkDetection: true
          }
        },
        layoutConfig: {
          chunkingConfig: {
            chunkSize: 500,
            includeAncestorHeadings: true
          }
        }
      }
    };

    console.log('📤 Sending request to Document AI...');
    
    try {
      const [result] = await client.processDocument(request);
      const { document } = result;
      
      console.log('✅ Document processed successfully with premium features');
      
      const pages = document?.pages?.map((page: any, index: number) => ({
        pageNumber: index + 1,
        text: page.paragraphs?.map((p: any) => p.layout?.textAnchor?.content || '').join('\n') || '',
        width: page.dimension?.width || 0,
        height: page.dimension?.height || 0
      })) || [];
      
      return NextResponse.json({ 
        success: true, 
        result: document?.text,
        pages: pages,
        totalPages: document?.pages?.length || 0,
        filename: filename,
        processorType: 'single-stage-premium'
      });
      
    } catch (premiumError) {
      console.warn('⚠️ Premium features failed, falling back to basic OCR:', premiumError);
      
      const basicRequest = {
        name,
        rawDocument: {
          content: base64Data,
          mimeType: 'image/jpeg',
        }
      };
      
      const [fallbackResult] = await client.processDocument(basicRequest);
      const { document: fallbackDocument } = fallbackResult;
      
      console.log('✅ Document processed successfully with basic OCR');
      
      const pages = fallbackDocument?.pages?.map((page: any, index: number) => ({
        pageNumber: index + 1,
        text: page.paragraphs?.map((p: any) => p.layout?.textAnchor?.content || '').join('\n') || '',
        width: page.dimension?.width || 0,
        height: page.dimension?.height || 0
      })) || [];
      
      return NextResponse.json({ 
        success: true, 
        result: fallbackDocument?.text,
        pages: pages,
        totalPages: fallbackDocument?.pages?.length || 0,
        filename: filename,
        processorType: 'single-stage-basic',
        warning: 'Premium features not available, used basic OCR'
      });
    }
    
  } catch (error) {
    console.error('❌ OCR processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

//session will be stored in the tidb database
//use mysql to configure tidb database

/**
 * QUICKSTART FUNCTION - FILE-BASED TWO-STAGE OCR PIPELINE
 */
const quickstart = async (filePath: string) => {
  console.log('\n🚀 === QUICKSTART: FILE-BASED TWO-STAGE OCR ===');
  console.log(`📁 Processing local file: ${filePath}`);

  try {
    // Read PDF file and convert to base64
    const file = fs.readFileSync(filePath);
    const pdfBase64 = Buffer.from(file).toString('base64');
    
    console.log(`📊 File loaded: ${file.length} bytes → ${pdfBase64.length} base64 chars`);
    
    // Extract filename for processing
    const filename = filePath.split(/[/\\]/).pop() || 'unknown.pdf';
    
    // Run the two-stage pipeline
    const pipelineResults = await processPdfWithCropping(pdfBase64, filename);
    
    console.log('\n🎉 Quickstart processing complete!');
    
    return {
      ...pipelineResults,
      quickstart: {
        localFile: filePath,
        fileSize: file.length,
        processingMode: 'file-based-two-stage'
      }
    };

  } catch (error) {
    console.error('\n❌ Quickstart processing failed:', error);
    throw new Error(`Quickstart failed: ${(error as Error).message}`);
  }
};

export async function GET(req: NextRequest) {
    try {
        console.log("� Starting individual Q&A processing approach...");

        // Use the test PDF file directly
        const testPdfPath = "C:\\Users\\rayap\\OneDrive\\Desktop\\tidbHackathon\\trainingDocs\\07-10.pdf";
        
        console.log(`� Processing PDF: ${testPdfPath}`);
        
        if (!fs.existsSync(testPdfPath)) {
            return NextResponse.json({ 
                success: false, 
                error: `PDF file not found at: ${testPdfPath}` 
            }, { status: 400 });
        }

        // Step 1: Process PDF with basic Document AI to get entities
        console.log("🎯 Step 1: Processing PDF with Document AI to extract entities...");
        const pdfBuffer = await fs.promises.readFile(testPdfPath);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        const basicOcrResult = await processDocumentWithBasicOCR(pdfBase64);
        const allEntities = basicOcrResult.entities || [];

        console.log(`📊 Found ${allEntities.length} total entities to process individually`);

        // Group ALL entities by page (Questions, Answers, AND Images)
        const entitiesByPage: { [key: string]: any[] } = {};
        allEntities.forEach((entity: any) => {
            const pageNum = entity.pageNumber;
            if (!entitiesByPage[pageNum]) {
                entitiesByPage[pageNum] = [];
            }
            entitiesByPage[pageNum].push(entity);
        });

        // Process each page in order
        const processedPages: any[] = [];
        const sortedPageNumbers = Object.keys(entitiesByPage).sort((a, b) => parseInt(a) - parseInt(b));

        for (const pageNum of sortedPageNumbers) {
            const pageEntities = entitiesByPage[pageNum];
            
            if (!pageEntities || pageEntities.length === 0) {
                continue; // Skip empty pages
            }
            
            // Sort entities within page by position (assuming they're in order in the JSON)
            const sortedEntities = pageEntities.sort((a: any, b: any) => {
                // If we have bounding box info, use it; otherwise maintain original order
                return 0; // Keep original order from JSON
            });

            const processedEntities: any[] = [];

            // NEW: Use MASTER crop approach - process all Q&A entities at once per page
            console.log(`🎯 Using MASTER crop for page ${pageNum} with ${pageEntities.length} entities...`);
            
            // Filter only Q&A entities for premium OCR processing
            const qaEntities = sortedEntities.filter((entity: any) => 
                entity.entityType === "Question" || entity.entityType === "Answer"
            );
            
            if (qaEntities.length > 0) {
                console.log(`🔍 Processing ${qaEntities.length} Q&A entities with MASTER crop...`);
                
                // Make ONE master premium OCR call for ALL Q&A entities on this page
                const masterOcrResult = await makeMasterPremiumOcrCall(qaEntities, pdfBase64, pageNum);
                
                if (masterOcrResult.success) {
                    console.log(`✅ Master OCR successful! Enhanced text: ${masterOcrResult.masterText.length} chars`);
                    
                    // REVERT: Use TEXT-BASED parsing and distribution to individual entities
                    // Parse master text and distribute to individual entities using improved patterns
                    const textSegments = masterOcrResult.masterText.split(/\n\n+|\n(?=\d+\.)|(?<=\?)\s*\n|(?<=\.)\s*\n(?=[A-Z])/);
                    
                    console.log(`📝 Text-based parsing: Split master text into ${textSegments.length} segments`);
                    
                    // TEXT-BASED: Map text segments to Q&A entities by order
                    console.log(`🔄 Mapping text segments to Q&A entities...`);
                    console.log(`   - Q&A entities: ${qaEntities.length}`);
                    console.log(`   - Text segments: ${textSegments.length}`);
                    
                    qaEntities.forEach((stage1Entity: any, index: number) => {
                        const boundingBoxData = getBoundingBox(stage1Entity);
                        
                        // TEXT-BASED mapping: Use text segments by order
                        const correspondingTextSegment = textSegments[index]?.trim() || "";
                        
                        let enhancedText = stage1Entity.content || "";
                        
                        if (correspondingTextSegment && correspondingTextSegment.length > enhancedText.length) {
                            // Use the text segment if it's longer/more detailed than original
                            enhancedText = correspondingTextSegment;
                            console.log(`   ✅ Entity ${index + 1}: ${stage1Entity.entityType} → Enhanced from text segment (${enhancedText.length} chars)`);
                        } else {
                            console.log(`   ⚠️ Entity ${index + 1}: ${stage1Entity.entityType} → Using original text (${enhancedText.length} chars)`);
                        }
                        
                        processedEntities.push({
                            type: stage1Entity.entityType,
                            pageNumber: parseInt(pageNum),
                            originalText: stage1Entity.content || "",
                            enhancedText: enhancedText,
                            boundingBoxes: boundingBoxData,
                            confidence: masterOcrResult.confidence,
                            processed: true,
                            premiumOcrUsed: true,
                            processingMethod: "master-crop-text-based-mapping",
                            stage1Index: index,
                            hasTextMatch: !!correspondingTextSegment,
                            imagesCroppedOut: false // Images are included in master crop but handled via text parsing
                        });
                    });
                    
                    console.log(`🎉 Text-based entity mapping complete: ${qaEntities.length} entities processed`);
                    
                } else {
                    console.warn(`⚠️ Master OCR failed, using fallback for ${qaEntities.length} entities`);
                    
                    // Fallback: use original text for all entities
                    qaEntities.forEach((entity: any) => {
                        const boundingBoxData = getBoundingBox(entity);
                        
                        processedEntities.push({
                            type: entity.entityType,
                            pageNumber: parseInt(pageNum),
                            originalText: entity.content || "",
                            enhancedText: entity.content || "",
                            boundingBoxes: boundingBoxData,
                            confidence: entity.confidence || 0.8,
                            processed: true,
                            premiumOcrUsed: false,
                            processingMethod: "sequence-based-fallback-original-text",
                            error: "Master OCR failed"
                        });
                    });
                }
            }
            
            // Include images in structure but don't process with OCR
            const imageEntities = sortedEntities.filter((entity: any) => entity.entityType === "Image");
            imageEntities.forEach((entity: any) => {
                processedEntities.push({
                    type: "Image",
                    pageNumber: parseInt(pageNum),
                    originalContent: entity.content || "Image content",
                    confidence: entity.confidence || 1.0,
                    processed: false,
                    premiumOcrUsed: false,
                    note: "Images excluded from OCR processing"
                });
            });

            processedPages.push({
                pageNumber: parseInt(pageNum),
                entities: processedEntities
            });
        }

        // Create final structured object with Q&A entities processed via MASTER crop, Images included but not processed
        const result = {
            processingMethod: "pdf-to-premium-ocr-qa-only-master-crop-sequence-entity-mapping",
            description: "Single premium OCR call per page using Q&A-only master crop with sequence-based entity mapping",
            inputFile: testPdfPath,
            totalPages: processedPages.length,
            totalEntities: allEntities.length,
            processedPages: processedPages,
            efficiency: {
                originalApproach: `${allEntities.filter((e: any) => e.entityType !== "Image").length} individual API calls`,
                masterCropApproach: `${processedPages.length} master API calls (one per page)`,
                costReduction: `~${Math.round((1 - processedPages.length / Math.max(allEntities.filter((e: any) => e.entityType !== "Image").length, 1)) * 100)}% fewer API calls`
            },
            summary: {
                questionsCount: allEntities.filter((e: any) => e.entityType === "Question").length,
                answersCount: allEntities.filter((e: any) => e.entityType === "Answer").length,
                imagesCount: allEntities.filter((e: any) => e.entityType === "Image").length,
                masterCropCallsCount: processedPages.length,
                premiumOcrProcessedCount: processedPages.flatMap(p => p.entities).filter((e: any) => e.premiumOcrUsed).length,
                successfulProcessing: processedPages.flatMap(p => p.entities).filter((e: any) => e.processed).length
            }
        };

        // Save the result
        const resultPath = "C:\\Users\\rayap\\OneDrive\\Desktop\\tidbHackathon\\apps\\backend\\output\\premium-ocr-master-crop-result.json";
        await fs.promises.writeFile(resultPath, JSON.stringify(result, null, 2));
        
        console.log(`✅ Premium OCR MASTER CROP processing complete! Results saved to: ${resultPath}`);
        console.log(`🎯 Efficiency achieved: ${result.efficiency.costReduction} cost reduction!`);

        return NextResponse.json(result);
        
    } catch (error: any) {
        console.error("❌ Premium OCR MASTER CROP processing failed:", error);
        return NextResponse.json({ 
            success: false, 
            error: (error as Error).message,
            stage: 'Premium OCR master crop processing'
        }, { status: 500 });
    }
}

/**
 * Process PDF with basic Document AI to extract entities
 */
async function processDocumentWithBasicOCR(pdfBase64: string): Promise<{entities: any[]}> {
    try {
        console.log("🔍 Processing PDF with basic Document AI to extract entities...");
        
        const name = `projects/${documentAIProjectId}/locations/${documentAILocation}/processors/${documentAIProcessorId}`;
        
        const request = {
            name: name,
            rawDocument: {
                content: pdfBase64,
                mimeType: 'application/pdf'
            }
        };

        console.log(`📤 Sending request to basic processor: ${documentAIProcessorId}`);
        
        const [result] = await client.processDocument(request);
        
        if (result && result.document && result.document.entities) {
            const entities = result.document.entities.map((entity: any) => {
                // Extract entity information
                const pageRefs = entity.pageAnchor?.pageRefs || [];
                const pageNumber = pageRefs.length > 0 ? pageRefs[0].page : 0;
                
                return {
                    entityType: entity.type,
                    mentionText: entity.mentionText,
                    content: entity.mentionText,
                    pageNumber: pageNumber.toString(),
                    confidence: entity.confidence || 1.0,
                    pageAnchor: entity.pageAnchor
                };
            });
            
            console.log(`✅ Basic OCR found ${entities.length} entities`);
            return { entities };
            
        } else {
            console.warn("⚠️ Basic OCR returned no entities");
            return { entities: [] };
        }
        
    } catch (error) {
        console.error("❌ Basic OCR processing failed:", error);
        return { entities: [] };
    }
}

/**
 * NEW: Make a SINGLE premium OCR call using master crop of ALL entities  
 */
async function makeMasterPremiumOcrCall(allEntities: any[], pdfBase64: string, pageNumber: string): Promise<{success: boolean, masterText: string, confidence: number}> {
    try {
        console.log(`🎯 Making MASTER premium OCR call for ${allEntities.length} entities on page ${pageNumber}...`);
        
        // Step 1: Convert PDF to page images 
        console.log(`📄 Converting PDF to images...`);
        const pageImages = await convertPdfToImages(pdfBase64);
        
        const pageIndex = parseInt(pageNumber) || 0;
        
        if (pageIndex >= pageImages.length || pageIndex < 0) {
            console.warn(`⚠️ Page ${pageIndex} not found in PDF (${pageImages.length} pages total)`);
            return {
                success: false,
                masterText: "",
                confidence: 0.5
            };
        }

        const pageImageBase64 = pageImages[pageIndex];
        if (!pageImageBase64) {
            console.warn(`⚠️ Page image not found for page ${pageIndex}`);
            return {
                success: false,
                masterText: "",
                confidence: 0.5
            };
        }
        
        console.log(`✅ Got page ${pageIndex} image: ${pageImageBase64.length} base64 chars`);

        // Step 2: Create MASTER crop encompassing ALL entities 
        const pageWidth = 2000;  // Standard width from convertPdfToImages
        const pageHeight = 2000; // Standard height from convertPdfToImages
        
        console.log(`🎯 Creating master crop region for Q&A entities ONLY...`);
        const masterCroppedImage = await cropMasterRegionFromAllEntities(
            pageImageBase64,
            allEntities, // Pass all entities, function will filter to Q&A only
            pageWidth,
            pageHeight
        );
        
        console.log(`✅ Master cropped image: ${masterCroppedImage.length} base64 chars`);

        // Step 3: Send the MASTER crop to premium OCR (ONE API call)
        const name = `projects/${documentAIProjectId}/locations/${documentAILocation}/processors/${premiumProcessorId}`;
        
        const request = {
            name: name,
            rawDocument: {
                content: masterCroppedImage,
                mimeType: 'image/png'
            },
            processOptions: {
                ocrConfig: {
                    enableNativePdfParsing: false,
                    enableImageQualityScores: true,
                    premiumFeatures: {
                        enableMathOcr: true,
                        enableSelectionMarkDetection: true
                    }
                }
            }
        };

        console.log(`📤 Sending MASTER request to premium processor: ${premiumProcessorId}`);
        
        // Make the SINGLE API call to premium OCR  
        const [result] = await client.processDocument(request);
        
        if (result && result.document) {
            const masterText = result.document.text || "";
            
            console.log(`✅ MASTER Premium OCR successful!`);
            console.log(`📝 Master enhanced text length: ${masterText.length} chars`);
            console.log(`🎯 Enhanced ALL ${allEntities.length} entities in ONE call`);
            
            return {
                success: true,
                masterText: masterText,
                confidence: 0.95
            };
        } else {
            console.warn(`⚠️ Master Premium OCR returned empty result`);
            return {
                success: false,
                masterText: "",
                confidence: 0.8
            };
        }
        
    } catch (error) {
        console.error(`❌ Master Premium OCR API call failed:`, error);
        
        return {
            success: false,
            masterText: "",
            confidence: 0.7
        };
    }
}

/**
 * Make premium OCR API call for individual entity (LEGACY - keep for compatibility)
 */
async function makePremiumOcrCall(entity: any, boundingBoxData: BoundingBox[], pdfBase64: string): Promise<{text: string, confidence: number}> {
    try {
        console.log(`� Making premium OCR call for ${entity.entityType}...`);
        console.log(`📍 Processing ${boundingBoxData.length} bounding boxes`);
        
        // Step 1: Convert PDF to page images to get the specific page
        console.log(`📄 Converting PDF to images for page...`);
        const pageImages = await convertPdfToImages(pdfBase64);
        
        // Validate boundingBoxData
        if (!boundingBoxData || boundingBoxData.length === 0) {
            console.warn(`⚠️ No bounding box data found for entity`);
            return {
                text: entity.content || entity.mentionText || "",
                confidence: entity.confidence || 0.5
            };
        }
        
        // Get the page number from the first bounding box
        const boundingBox = boundingBoxData[0];
        const pageIndex = boundingBox ? boundingBox.page || 0 : 0;
        
        if (pageIndex >= pageImages.length || pageIndex < 0) {
            console.warn(`⚠️ Page ${pageIndex} not found in PDF (${pageImages.length} pages total)`);
            return {
                text: entity.content || entity.mentionText || "",
                confidence: entity.confidence || 0.5
            };
        }

        const pageImageBase64 = pageImages[pageIndex];
        if (!pageImageBase64) {
            console.warn(`⚠️ Page image not found for page ${pageIndex}`);
            return {
                text: entity.content || entity.mentionText || "",
                confidence: entity.confidence || 0.5
            };
        }
        
        console.log(`✅ Got page ${pageIndex} image: ${pageImageBase64.length} base64 chars`);

        // Step 2: Crop the specific entity region from the page image
        if (!boundingBox || !boundingBox.boundingPoly) {
            console.warn(`⚠️ No bounding polygon found for entity`);
            return {
                text: entity.content || entity.mentionText || "",
                confidence: entity.confidence || 0.5
            };
        }
        
        const pageWidth = 2000;  // Standard width from convertPdfToImages
        const pageHeight = 2000; // Standard height from convertPdfToImages
        
        console.log(`✂️ Cropping entity region from page ${pageIndex}...`);
        const croppedEntityImage = await cropImageByBoundingBox(
            pageImageBase64,
            boundingBox.boundingPoly,
            pageWidth,
            pageHeight
        );
        
        console.log(`✅ Cropped entity image: ${croppedEntityImage.length} base64 chars`);

        // Prepare the request for premium OCR processor with cropped image
        const name = `projects/${documentAIProjectId}/locations/${documentAILocation}/processors/${premiumProcessorId}`;
        
        // Use the cropped entity image instead of the full PDF
        const request = {
            name: name,
            rawDocument: {
                content: croppedEntityImage,
                mimeType: 'image/png'
            },
            processOptions: {
                ocrConfig: {
                    enableNativePdfParsing: false,
                    enableImageQualityScores: true,
                    premiumFeatures: {
                        enableMathOcr: true,
                        enableSelectionMarkDetection: true
                    }
                }
            }
        };

        console.log(`📤 Sending request to premium processor: ${premiumProcessorId}`);
        
        // Make the API call to premium OCR
        const [result] = await client.processDocument(request);
        
        if (result && result.document && result.document.text) {
            console.log(`✅ Premium OCR successful for ${entity.entityType}`);
            console.log(`📝 Original: "${(entity.content || entity.mentionText || "").substring(0, 50)}..."`);
            console.log(`🔍 Enhanced: "${result.document.text.substring(0, 50)}..."`);
            
            return {
                text: result.document.text,
                confidence: 0.95 // Premium OCR typically has high confidence
            };
        } else {
            console.warn(`⚠️ Premium OCR returned empty result for ${entity.entityType}`);
            return {
                text: entity.content || entity.mentionText || "", // Fallback to original
                confidence: entity.confidence || 0.8
            };
        }
        
    } catch (error) {
        console.error(`❌ Premium OCR API call failed for ${entity.entityType}:`, error);
        
        // Enhanced fallback processing
        const enhancedText = enhanceTextLocally(entity.content || "", entity.entityType);
        
        return {
            text: enhancedText,
            confidence: entity.confidence || 0.7
        };
    }
}

/**
 * Local text enhancement as fallback when premium OCR fails
 */
function enhanceTextLocally(textContent: string, entityType: string): string {
    let enhancedText = textContent;
    
    // Basic text cleaning and enhancement
    enhancedText = enhancedText
        .replace(/\n+/g, ' ')  // Replace multiple newlines with spaces
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/✓+/g, '✓')   // Clean up check marks
        .trim();

    // Add entity type prefix for clarity
    if (entityType === "Question" && enhancedText.length > 0) {
        enhancedText = `[Q] ${enhancedText}`;
    } else if (entityType === "Answer" && enhancedText.length > 0) {
        enhancedText = `[A] ${enhancedText}`;
    }

    return enhancedText;
}