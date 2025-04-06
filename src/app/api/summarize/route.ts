import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDocumentType } from '@/lib/documentParser';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Mark this as a server-side only file
export const runtime = 'nodejs'; // or 'edge'

export async function POST(req: NextRequest) {
  console.log('⭐ Summarize API called');
  
  // Verify authentication
  try {
    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.log('❌ Authentication failed - no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
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

  if (!process.env.GOOGLE_API_KEY) {
    console.log('❌ Google API key not configured');
    return NextResponse.json(
      { error: 'Google API key not configured' },
      { status: 500 }
    );
  }

  try {
    console.log('Parsing form data...');
    const formData = await req.formData().catch(e => {
      console.error('❌ Failed to parse form data:', e);
      throw new Error('Failed to parse form data: ' + (e instanceof Error ? e.message : String(e)));
    });
    
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string || 'document';

    console.log('Form data values:', { 
      hasFile: !!file, 
      fileName,
      fileSize: file?.size,
      fileType: file?.type 
    });

    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // First extract text from the file using our existing document parser
    const fileType = getDocumentType(fileName);
    console.log(`File type determined: ${fileType}`);
    
    // Special handling for PDFs - which are problematic to parse in browser context
    if (fileType === 'pdf') {
      console.log('⚠️ PDF file detected, using AI to analyze filename');
      
      // For PDFs, we'll use the AI to generate a description of what the PDF likely contains
      // based on the filename, since PDF parsing is unreliable
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
          topP: 0.9,
          topK: 40,
        }
      });
      
      const prompt = `
      Based on its filename "${fileName}", what would you expect this PDF document to contain? 
      What topics might it cover? This is for a file in a course context.
      
      Respond with a thoughtful description of what the PDF likely contains.
      At the end, add a note explaining that this is a prediction based on the filename only.
      `;
      
      console.log('Generating PDF file description...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const description = response.text();
      
      return NextResponse.json({
        summary: `
PDF File Analysis: ${fileName}

${description}

[Note: Due to technical limitations with PDF processing in the browser, this description is based on the filename rather than the actual PDF content. PDF files require server-side processing which is currently optimized for text extraction rather than summarization.]
        `.trim(),
        fileName: fileName,
        isPdfFallback: true
      });
    }
    
    // For non-PDF files, continue with the regular document parsing process
    // Create form data to send to our document parser API
    console.log('Creating parser form data...');
    const parserFormData = new FormData();
    parserFormData.append('file', file);
    parserFormData.append('fileType', fileType);
    
    // Parse the document to get text content
    console.log('Calling parse-document API...');
    const parseResponse = await fetch(new URL('/api/parse-document', req.url), {
      method: 'POST',
      body: parserFormData,
      headers: {
        Cookie: req.headers.get('cookie') || '',
      },
    });
    
    // Parse the JSON response once and store it
    let responseData;
    try {
      console.log('Parsing API response...');
      responseData = await parseResponse.json();
      console.log('Response parsed successfully');
    } catch (error) {
      console.error('❌ Error parsing JSON response:', error);
      throw new Error('Invalid response from parser');
    }
    
    if (!parseResponse.ok) {
      console.error('❌ Parser API returned error:', responseData);
      throw new Error(responseData.error || 'Failed to parse document');
    }
    
    const { text } = responseData;
    
    if (!text || typeof text !== 'string') {
      console.log('❌ No text returned from parser');
      return NextResponse.json(
        { error: 'Failed to extract text from document' },
        { status: 500 }
      );
    }

    console.log(`✅ Text extracted, length: ${text.length} chars`);

    // Now use the AI to summarize the text
    // Initialize the model
    console.log('Initializing AI model for summarization...');
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-pro",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2000,
        topP: 0.95,
        topK: 40,
      }
    });

    // Create a prompt to summarize the content
    const prompt = `
    I need you to summarize the following document: ${fileName}
    
    Here is the content:
    ${text.slice(0, 150000)} 
    ${text.length > 150000 ? '\n[Note: Document content has been truncated due to size limitations.]' : ''}
    
    Please provide a comprehensive but concise summary that covers the main points, key concepts, and important details.
    Format your response with clear sections and bullet points where appropriate.
    `;

    console.log('Generating summary with AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    console.log('✅ Summary generated successfully');

    return NextResponse.json({
      summary: summary || `Unable to generate summary for ${fileName}`,
      fileName: fileName
    });
  } catch (error: unknown) {
    console.error('❌ Error in summarize API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to summarize document' },
      { status: 500 }
    );
  }
} 