import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { CanvasAPI } from '@/lib/canvas';

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(req: Request) {
  // Verify authentication
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'Google API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { messages, courseId, courseName } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    // Initialize the model with proper configuration
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.8,
        topK: 40,
      }
    });

    // Extract any file context from system messages
    let fileContext = '';
    const chatMessages = messages.filter(msg => {
      if (msg.role === 'system' && msg.content.includes('Context from selected files:')) {
        fileContext = msg.content;
        return false;
      }
      return true;
    });

    // Get course name if not provided
    let displayCourseName = courseName;
    if (!displayCourseName) {
      try {
        // Try to get the course name from Canvas API
        const canvasApi = await CanvasAPI.create();
        if (canvasApi) {
          const courseDetails = await canvasApi.getCourseDetails(courseId);
          if (courseDetails && courseDetails.name) {
            displayCourseName = courseDetails.name;
          }
        }
      } catch (error) {
        console.error('Error fetching course name:', error);
      }
    }

    // Fallback to course ID if name couldn't be retrieved
    const courseIdentifier = displayCourseName || `Course ${courseId}`;

    // Create the system message
    const systemMessage = `You are a helpful AI course instructor assistant for ${courseIdentifier}. 
                          Your goal is to help students understand the course material and answer their questions.
                          Always be encouraging, supportive, and academically accurate.
                          
                          ${fileContext ? `I've provided you with context extracted from selected course files. Use this information to provide detailed, accurate answers based on the provided materials:
                          
                          ${fileContext}
                          
                          When answering questions, refer directly to the provided course materials. If you can't find relevant information in the context, explain that the specific information might not be in the provided materials, but still try to give a helpful answer based on general knowledge.` : 
                          'No specific course materials have been provided as context. Give general guidance based on the topic while making it clear that your response is not based on the specific course materials.'}`;

    // Build the conversation history
    let conversationHistory = systemMessage + "\n\n";
    
    // Add previous messages to the conversation (excluding system messages)
    chatMessages.forEach(msg => {
      if (msg.role === 'user') {
        conversationHistory += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        conversationHistory += `Assistant: ${msg.content}\n`;
      }
    });

    // Generate content with the full conversation history
    const result = await model.generateContent(conversationHistory);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      message: text
    });
  } catch (error: unknown) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 