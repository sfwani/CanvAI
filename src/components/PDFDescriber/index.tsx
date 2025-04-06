'use client';

import { FC } from 'react';
import { FileText } from 'lucide-react';
import { CourseFile } from '@/lib/courseFiles';

interface PDFDescriberProps {
  file: CourseFile;
}

// This component provides information about PDFs in the context panel
const PDFDescriber: FC<PDFDescriberProps> = () => {
  return (
    <div className="w-full">
      <div className="text-xs text-gray-500 p-2 bg-blue-50 rounded border border-blue-100 flex items-start">
        <FileText className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0 text-blue-500" />
        <span>
          PDF content is being provided to the AI. Ask questions about this document directly in the chat.
        </span>
      </div>
    </div>
  );
};

export default PDFDescriber; 