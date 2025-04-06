import { NextRequest, NextResponse } from 'next/server';
// These imports are safe here because this file only runs on the server
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Mark this as a server-side only file
export const runtime = 'nodejs'; // or 'edge'

export async function POST(req: NextRequest) {
  console.log('⭐ parse-document API called');

  // Verify authentication
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.log('❌ Authentication failed - no session');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('✅ Authentication successful');
  } catch (authError) {
    console.error('❌ Authentication error:', authError);
    return NextResponse.json(
      { error: 'Authentication error', details: authError instanceof Error ? authError.message : 'Unknown auth error' },
      { status: 401 }
    );
  }

  try {
    // Parse the form data
    console.log('Parsing form data...');
    const formData = await req.formData().catch(e => {
      console.error('❌ Failed to parse form data:', e);
      throw new Error('Failed to parse form data: ' + (e instanceof Error ? e.message : String(e)));
    });
    
    const file = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string | null;

    console.log('Form data values:', { 
      hasFile: !!file, 
      fileType, 
      fileName: file?.name,
      fileSize: file?.size,
      fileType2: file?.type
    });

    if (!file || !fileType) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { error: 'File and fileType are required' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer().catch(e => {
      console.error('❌ Failed to get array buffer from file:', e);
      throw new Error('Failed to read file data: ' + (e instanceof Error ? e.message : String(e)));
    });
    
    const buffer = Buffer.from(arrayBuffer);
    console.log(`Buffer created, size: ${buffer.length} bytes`);

    let text = '';

    // Extract text based on file type
    console.log(`Processing ${fileType} file...`);
    switch (fileType) {
      case 'pdf':
        try {
          console.log('Parsing PDF with pdf-parse...');
          const data = await pdfParse(buffer);
          text = data.text;
          console.log(`✅ PDF parsed successfully, extracted ${text.length} chars`);
        } catch (error) {
          console.error('❌ Error parsing PDF:', error);
          return NextResponse.json(
            { 
              error: 'Failed to parse PDF. Server-side processing error occurred.',
              details: error instanceof Error ? error.message : 'Unknown PDF parsing error',
              stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
          );
        }
        break;

      case 'docx':
        try {
          console.log('Parsing DOCX with mammoth...');
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
          console.log(`✅ DOCX parsed successfully, extracted ${text.length} chars`);
        } catch (error) {
          console.error('❌ Error parsing DOCX:', error);
          return NextResponse.json(
            { 
              error: 'Failed to parse DOCX. Server-side processing error occurred.',
              details: error instanceof Error ? error.message : 'Unknown DOCX parsing error' 
            },
            { status: 500 }
          );
        }
        break;

      case 'pptx':
        try {
          console.log('Parsing PPTX via text extraction...');
          // Simple PPTX parsing by looking for text elements
          const content = buffer.toString('utf-8');
          const matches = content.match(/<a:t>([^<]+)<\/a:t>/g) || [];
          
          if (matches.length === 0) {
            console.log('⚠️ No text elements found in PPTX');
            return NextResponse.json(
              { text: 'Unable to extract text from this PowerPoint file.' },
              { status: 200 }
            );
          }
          
          // Clean up the matches
          const extractedTexts = matches.map(match => {
            const content = match.replace(/<a:t>|<\/a:t>/g, '');
            return content.trim();
          });
          
          text = extractedTexts.join('\n');
          console.log(`✅ PPTX parsed, extracted ${text.length} chars from ${matches.length} text elements`);
        } catch (error) {
          console.error('❌ Error parsing PPTX:', error);
          return NextResponse.json(
            { 
              error: 'Failed to parse PPTX. Server-side processing error occurred.',
              details: error instanceof Error ? error.message : 'Unknown PPTX parsing error' 
            },
            { status: 500 }
          );
        }
        break;

      case 'txt':
        console.log('Parsing TXT via direct text conversion...');
        text = buffer.toString('utf-8');
        console.log(`✅ Text extracted, ${text.length} chars`);
        break;

      default:
        console.log(`❌ Unsupported file type: ${fileType}`);
        return NextResponse.json(
          { error: `Unsupported file type: ${fileType}` },
          { status: 400 }
        );
    }

    // Truncate if the text is too long
    const maxLength = 100000;
    if (text.length > maxLength) {
      console.log(`⚠️ Truncating text from ${text.length} to ${maxLength} chars`);
      text = text.substring(0, maxLength) + 
        '\n\n[Note: This content has been truncated as it exceeds the maximum length. The original document contains more information.]';
    }

    console.log('✅ Document processing complete, returning text');
    return NextResponse.json({ text });
  } catch (error) {
    console.error('❌ Error processing document:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process document. This might be due to a server-side error or an unsupported file format.',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 