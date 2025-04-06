'use client';

import { FC } from 'react';
import { Switch } from '@/components/ui/switch';
import { CourseFile } from '@/lib/courseFiles';
import { Loader2, CheckCircle, FileText, FileX } from 'lucide-react';
import FileSummarizer from '@/components/FileSummarizer';

interface FileContextPanelProps {
  files: CourseFile[];
  onToggleFile: (fileId: string) => void;
  selectedFiles: Set<string>;
  processingFiles?: Set<string>;
}

const FileContextPanel: FC<FileContextPanelProps> = ({
  files,
  onToggleFile,
  selectedFiles,
  processingFiles = new Set(),
}) => {
  const selectedFilesList = files.filter(file => selectedFiles.has(file.id));
  const unselectedFilesList = files.filter(file => !selectedFiles.has(file.id));

  // Get a simpler file type description
  const getSimpleFileType = (mimeType: string): string => {
    if (!mimeType || mimeType === 'unknown') return 'File';
    
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('docx')) return 'Word';
    if (mimeType.includes('presentation') || mimeType.includes('pptx')) return 'PowerPoint';
    if (mimeType.includes('text/')) return 'Text';
    if (mimeType.includes('image/')) return 'Image';
    
    // Return just the subtype (after the /)
    const parts = mimeType.split('/');
    if (parts.length === 2) {
      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
    
    return 'File';
  };

  return (
    <div className="w-80 h-full overflow-hidden flex flex-col bg-gray-50 border-l">
      <div className="p-4 border-b bg-white">
        <h2 className="text-lg font-semibold">Course Materials</h2>
        <p className="text-sm text-gray-600 mt-1">
          Toggle files to include them as context when asking questions.
        </p>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2">
        {processingFiles.size > 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="mt-2 text-sm text-gray-600">Loading course files...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected Files Section */}
            {selectedFilesList.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                  <h3 className="font-medium text-blue-900 flex items-center">
                    Selected Files ({selectedFilesList.length})
                  </h3>
                </div>
                <div className="divide-y">
                  {selectedFilesList.map(file => (
                    <div 
                      key={file.id}
                      className="px-4 py-3 flex items-center justify-between group hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {getSimpleFileType(file.type)}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {processingFiles.has(file.id) ? (
                          <Loader2 className="h-4 w-4 text-blue-500 animate-spin mr-2" />
                        ) : file.content ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <FileText className="h-4 w-4 text-gray-400 mr-2" />
                        )}
                        <Switch 
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={() => onToggleFile(file.id)}
                          className="data-[state=checked]:bg-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Available Files Section */}
            {unselectedFilesList.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <h3 className="font-medium text-gray-700">
                    Available Files ({unselectedFilesList.length})
                  </h3>
                </div>
                <div className="divide-y">
                  {unselectedFilesList.map(file => (
                    <div 
                      key={file.id}
                      className="px-4 py-3 flex items-center justify-between group hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {getSimpleFileType(file.type)}
                        </p>
                      </div>
                      <Switch 
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => onToggleFile(file.id)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length === 0 && !processingFiles.size && (
              <div className="text-center py-8 px-4">
                <FileX className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-gray-700 font-medium mb-1">No files found</h3>
                <p className="text-gray-500 text-sm">
                  No course files are available from Canvas.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileContextPanel; 