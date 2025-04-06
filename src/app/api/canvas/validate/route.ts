import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { domain, token } = await request.json();

    if (!domain || !token) {
      return NextResponse.json(
        { error: 'Domain and token are required' },
        { status: 400 }
      );
    }

    // Clean up the domain URL
    const cleanDomain = domain.trim().replace(/\/$/, '');
    const testEndpoint = `${cleanDomain}/api/v1/users/self/profile`;

    console.log('Attempting to validate Canvas credentials...');
    console.log('Endpoint:', testEndpoint);

    // Make the request to Canvas
    try {
      const response = await fetch(testEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      console.log('Canvas API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Canvas API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });

        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Invalid Canvas API token. Please check your token and try again.' },
            { status: 401 }
          );
        } else if (response.status === 404) {
          return NextResponse.json(
            { error: 'Invalid Canvas domain. Please check your Canvas URL and try again.' },
            { status: 404 }
          );
        } else {
          return NextResponse.json(
            { 
              error: `Canvas API error (${response.status}): ${errorText || response.statusText}`,
              details: {
                status: response.status,
                statusText: response.statusText,
                errorText,
              }
            },
            { status: response.status }
          );
        }
      }

      const userData = await response.json();
      console.log('Canvas API Success:', userData);
      return NextResponse.json({ success: true, user: userData });
    } catch (fetchError: unknown) {
      console.error('Fetch Error:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to connect to Canvas API',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Validation Error:', error);
    return NextResponse.json(
      { 
        error: 'Unable to validate Canvas credentials',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 