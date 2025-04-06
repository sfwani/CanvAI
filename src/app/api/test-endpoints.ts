import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

// This is a test endpoint to validate PDF processing works
export async function GET() {
  try {
    // Log to help with debugging
    console.log('Test endpoint started');
    
    // Define sample file paths - using Node path to join and resolve
    const sampleDir = path.resolve(process.cwd(), 'public', 'samples');
    
    // Create the samples directory if it doesn't exist
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
      console.log(`Created sample directory at ${sampleDir}`);
    }
    
    // Path for a test PDF - use a known PDF if available
    const samplePdfPath = path.join(sampleDir, 'test.pdf');
    
    // Check if test.pdf exists, and if not, create a very simple one
    if (!fs.existsSync(samplePdfPath)) {
      console.log(`Sample PDF not found at ${samplePdfPath}. Using fallback test data.`);
      
      // Return test data to confirm endpoint is working even without a PDF
      return NextResponse.json({
        status: 'success',
        message: 'Test endpoint working, but no sample PDF available',
        pdfAvailable: false,
        nodeVersion: process.version,
        testFileExists: false,
        cwd: process.cwd(),
        samplesDir: sampleDir
      });
    }
    
    // Test PDF processing - read the test file
    console.log(`Reading sample PDF from ${samplePdfPath}`);
    const dataBuffer = fs.readFileSync(samplePdfPath);
    
    // Parse PDF
    console.log('Parsing PDF');
    const pdfData = await pdfParse(dataBuffer);
    
    // Return results
    return NextResponse.json({
      status: 'success',
      pdfAvailable: true,
      pdfText: pdfData.text?.substring(0, 500) || 'No text extracted',
      pdfInfo: {
        pageCount: pdfData.numpages,
        metadata: pdfData.metadata
      }
    });
  } catch (error) {
    console.error('Error in test-endpoints API:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 