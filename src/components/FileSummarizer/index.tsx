'use client';

import { FC, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { CourseFile } from '@/lib/courseFiles';

interface FileSummarizerProps {
  file: CourseFile;
}

interface DebugInfo {
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Alternative summarization approach that works directly with text
const FileSummarizer: FC<FileSummarizerProps> = ({ file }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  // Use AI directly if we already have the file content
  const summarizeWithAI = async (content: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `Please summarize the following content from ${file.name}:\n\n${content}` }
          ],
          courseId: 'unknown'
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to summarize: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.message || 'No summary available';
    } catch (error) {
      console.error('Error in AI summarization:', error);
      throw error;
    }
  };

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    setDebugInfo(null);

    try {
      console.log('Starting file summarization for:', file.name);
      
      // If we already have file content, use it directly for faster response
      if (file.content && file.content.length > 0) {
        console.log('Using existing file content for summarization');
        const summaryText = await summarizeWithAI(file.content.slice(0, 15000));
        setSummary(summaryText);
        return;
      }

      // Otherwise download and process the file
      console.log('Downloading file from:', file.url);
      const fileResponse = await fetch(file.url, {
        credentials: 'include'
      });
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      // Get the file blob
      const fileBlob = await fileResponse.blob();
      console.log('File downloaded, size:', fileBlob.size);
      
      // Create a File object from the blob
      const fileObj = new File([fileBlob], file.name, { 
        type: fileResponse.headers.get('Content-Type') || file.type || '' 
      });
      
      // Create form data to send to our server API
      const formData = new FormData();
      formData.append('file', fileObj);
      formData.append('fileName', file.name);
      
      // Log the form data for debugging
      console.log('Sending file to API, name:', file.name, 'type:', fileObj.type, 'size:', fileObj.size);
      
      // Send the file to our summarization API
      const summaryResponse = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      // Store debug info
      const responseDebugInfo = {
        status: summaryResponse.status,
        statusText: summaryResponse.statusText,
        headers: Object.fromEntries(summaryResponse.headers.entries()),
      };
      setDebugInfo(responseDebugInfo);
      
      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json().catch(() => ({ 
          error: `Invalid response from server: ${summaryResponse.status} ${summaryResponse.statusText}` 
        }));
        
        console.error('API error response:', errorData);
        throw new Error(errorData.error || 'Failed to summarize document');
      }
      
      // Get summary data
      const data = await summaryResponse.json().catch(e => {
        console.error('Error parsing JSON response:', e);
        throw new Error('Failed to parse response from server');
      });
      
      if (data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error('No summary returned from API');
      }
    } catch (error) {
      console.error('Error summarizing file:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const isPdf = file.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="w-full">
      <Button 
        onClick={handleSummarize}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        disabled={isLoading || isPdf}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Summarizing...
          </>
        ) : (
          'summarize the file'
        )}
      </Button>
      
      {isPdf && (
        <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-100 mt-2 flex items-start">
          <FileText className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0 text-blue-500" />
          <span>
            PDF content is being provided to the AI. Ask questions about this document directly in the chat.
          </span>
        </div>
      )}
      
      {error && !isPdf && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          <div className="flex justify-between items-center">
            <p>{error}</p>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          {showDetails && debugInfo && (
            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}
      
      {summary && !isPdf && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="font-semibold mb-2">
            Summary of {file.name}
          </h3>
          <div className="whitespace-pre-line text-sm">{summary}</div>
        </div>
      )}
    </div>
  );
};

export default FileSummarizer; 