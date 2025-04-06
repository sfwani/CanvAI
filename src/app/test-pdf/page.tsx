'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface APIResult {
  text?: string;
  status?: string;
  success?: boolean;
  error?: string;
  details?: unknown;
  [key: string]: unknown;
}

export default function TestPdfPage() {
  const [apiResult, setApiResult] = useState<APIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Test the direct PDF parsing API
  const testDirectApi = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-pdf');
      const data = await response.json();
      setApiResult(data);
      
      if (!response.ok) {
        setError(`API returned error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error calling API: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setApiResult(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Test file upload to parse-document API
  const testFileUpload = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create a simple text file as a blob
      const testFileContent = 'This is a test file content for PDF parsing API testing.';
      const blob = new Blob([testFileContent], { type: 'text/plain' });
      
      // Create a File object
      const file = new File([blob], 'test.txt', { type: 'text/plain' });
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', 'txt');
      
      // Make the API call
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      // Get response data
      const data = await response.json();
      setApiResult(data);
      
      if (!response.ok) {
        setError(`API returned error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError(`Error testing file upload: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setApiResult(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-run the test when page loads
  useEffect(() => {
    testDirectApi();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">PDF Parsing API Test Page</h1>
        <p className="mb-4">Use this page to test the PDF parsing functionality</p>
        <div className="flex gap-4 mb-8">
          <button 
            onClick={testDirectApi} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Direct API'}
          </button>
          
          <button 
            onClick={testFileUpload} 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test File Upload API'}
          </button>
          
          <Link 
            href="/dashboard" 
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {apiResult && (
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">API Result:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
            {JSON.stringify(apiResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 