'use client';

import { useState } from 'react';

interface PDFData {
  success: boolean;
  text: string;
  metadata: {
    info: Record<string, unknown>;
    numberOfPages: number;
    version: string;
  };
}

export default function PDFTestPage() {
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testParser = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test-pdf-parser');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to parse PDF');
      }
      
      setPdfData(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error testing PDF parser:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">PDF Parser Test</h1>
      
      <button 
        onClick={testParser}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mb-6 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test PDF Parser'}
      </button>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {pdfData && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">PDF Parsing Results</h2>
          
          <div className="bg-gray-100 p-4 rounded mb-4">
            <h3 className="font-semibold mb-1">Metadata</h3>
            <pre className="text-sm overflow-auto">{JSON.stringify(pdfData.metadata, null, 2)}</pre>
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold mb-1">Extracted Text</h3>
            <pre className="text-sm whitespace-pre-wrap">{pdfData.text}</pre>
          </div>
        </div>
      )}
    </div>
  );
} 