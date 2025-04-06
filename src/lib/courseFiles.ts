import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createCanvasAPI } from './canvas';
import { getDocumentType, truncateText } from './documentParser';

export interface CourseFile {
  id: string;
  name: string;
  content: string;
  url: string;
  type: string;
}

/**
 * Custom error class for Canvas API errors
 */
export class CanvasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanvasError';
  }
}

export async function getCourseFiles(courseId: string): Promise<CourseFile[]> {
  const supabase = createClientComponentClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new CanvasError('Not authenticated');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('canvas_token, canvas_domain')
      .eq('id', user.id)
      .single();

    if (userError) throw new CanvasError(`Supabase error: ${userError.message}`);

    if (!userData?.canvas_token || !userData?.canvas_domain) {
      throw new CanvasError('Canvas credentials not found. Please set up your Canvas integration in account settings.');
    }

    const canvas = createCanvasAPI({
      domain: userData.canvas_domain,
      token: userData.canvas_token,
    });

    try {
      const files = await canvas.getCourseFiles(Number(courseId));
      
      // Transform files to our format
      return files.map(file => ({
        id: file.id.toString(),
        name: file.display_name,
        content: '', // This will be populated when the file is selected
        url: file.url,
        type: file.content_type || 'unknown'
      }));
    } catch (error: unknown) {
      // Handle Canvas API specific errors
      console.error('Canvas API error:', error);
      if (error instanceof Error) {
        if (error.message?.includes('Resource not found')) {
          throw new CanvasError(`Course ${courseId} not found. Please check the course ID and your permissions.`);
        } else if (error.message?.includes('Invalid Canvas API token')) {
          throw new CanvasError('Invalid Canvas API token. Please update your Canvas token in account settings.');
        }
        
        // Re-throw other errors
        throw new CanvasError(`Canvas API error: ${error.message}`);
      }
      
      // If it's not an Error object
      throw new CanvasError(`Canvas API error: Unknown error`);
    }
  } catch (error) {
    console.error('Error fetching course files:', error);
    
    // If it's already a CanvasError, just re-throw it
    if (error instanceof CanvasError) {
      throw error;
    }
    
    // Otherwise, wrap it in a CanvasError
    throw new CanvasError(`Error fetching course files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getFileContent(fileUrl: string, fileName?: string): Promise<string> {
  try {
    // Check if we have a valid URL
    if (!fileUrl || typeof fileUrl !== 'string') {
      console.error('Invalid file URL:', fileUrl);
      return 'Error: Could not load file content';
    }

    // Extract the file name from the URL if not provided
    const extractedFileName = fileName || fileUrl.split('/').pop() || 'unknown';
    
    // Check if it's a document type that needs special handling
    const documentType = getDocumentType(extractedFileName);
    
    // For text files, simple fetching works fine
    if (documentType === 'txt') {
      const response = await fetch(fileUrl, {
        credentials: 'include' // Include authentication cookies
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      return truncateText(content, 50000);
    }
    
    // For PDF, DOCX, PPTX - use server-side processing
    if (documentType === 'pdf' || documentType === 'docx' || documentType === 'pptx') {
      try {
        // First download the file
        const fileResponse = await fetch(fileUrl, {
          credentials: 'include' // Include authentication cookies
        });
        
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
        }
        
        // Get the file blob
        const fileBlob = await fileResponse.blob();
        
        // Create a File object from the blob
        const file = new File([fileBlob], extractedFileName, { 
          type: fileResponse.headers.get('Content-Type') || '' 
        });
        
        // Create form data to send to our server API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', documentType);
        
        // Send the file to our server-side parser
        const parseResponse = await fetch('/api/parse-document', {
          method: 'POST',
          body: formData,
          credentials: 'include' // Include authentication cookies
        });
        
        if (!parseResponse.ok) {
          if (parseResponse.status === 401) {
            throw new Error('Authentication required. Please sign in again.');
          }
          const errorData = await parseResponse.json().catch(() => ({ error: 'Invalid response from server' }));
          throw new Error(errorData.error || 'Failed to parse document');
        }
        
        const { text } = await parseResponse.json();
        return text || `Unable to extract text from ${extractedFileName}`;
      } catch (error) {
        console.error(`Error processing ${documentType} file:`, error);
        
        // Return a more descriptive error message
        if (documentType === 'pdf') {
          return `[This PDF file could not be processed. PDF processing is done server-side for browser compatibility.]`;
        } else if (documentType === 'docx') {
          return `[This Word document could not be processed. DOCX processing is done server-side for browser compatibility.]`;
        } else {
          return `[This ${documentType.toUpperCase()} file could not be processed. Document processing is done server-side for browser compatibility.]`;
        }
      }
    }
    
    // For other file types, return a placeholder
    return `[This file type (${documentType}) cannot be displayed as text. Please try another file type or extract the text manually.]`;
    
  } catch (error) {
    console.error('Error fetching file content:', error);
    return `Error loading file content: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}