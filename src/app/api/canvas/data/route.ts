import { NextResponse } from 'next/server';
import { getUserCanvasConfig } from '../../user/canvas-config';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

  try {
    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Get the user's Canvas config
    const userCanvasConfig = await getUserCanvasConfig(session.user.id);
    
    if (!userCanvasConfig) {
      return NextResponse.json(
        { error: 'Canvas configuration not found. Please set up your Canvas integration.' },
        { status: 404 }
      );
    }

    // Construct the Canvas API URL
    const url = `${userCanvasConfig.domain}/api/v1/${endpoint}`;
    
    // Make the Canvas API request
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${userCanvasConfig.token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorCode = response.status;
      let errorMessage = `Canvas API error: ${response.statusText}`;
      
      // Try to get more detailed error message
      try {
        const errorData = await response.json();
        if (errorData && errorData.errors) {
          errorMessage = errorData.errors.map((err: { message: string }) => err.message).join(', ');
        }
      } catch {
        // If we can't parse the error response, just use the status text
      }
      
      return NextResponse.json({ error: errorMessage }, { status: errorCode });
    }

    const data = await response.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in Canvas API proxy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 