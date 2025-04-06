import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export async function GET() {
  try {
    // Path to our test PDF file
    const pdfPath = path.join(process.cwd(), 'public', 'samples', 'test.pdf');
    
    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Parse the PDF
    const result = await pdfParse(dataBuffer);
    
    // Return the parsed text and metadata
    return NextResponse.json({
      success: true,
      text: result.text,
      metadata: {
        info: result.info,
        numberOfPages: result.numpages,
        version: result.version
      }
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
} 