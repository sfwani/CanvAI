import { NextRequest, NextResponse } from 'next/server';
import { getCanvasToken } from '@/lib/auth';

type RouteParams = {
  params: {
    courseId: string;
  };
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const token = await getCanvasToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const courseId = params.courseId;
    const canvasBaseUrl = process.env.CANVAS_API_URL;
    
    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/files?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch course files from Canvas');
    }

    const files = await response.json();
    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching course files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course files' },
      { status: 500 }
    );
  }
} 