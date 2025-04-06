'use client';

import { FC, useState, useRef, useEffect } from 'react';
import { Send, FileText, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import FileContextPanel from '@/components/FileContextPanel';
import { CourseFile, getCourseFiles, getFileContent } from '@/lib/courseFiles';
import { toast } from "sonner";

interface CourseChatProps {
  courseId: string;
  courseName?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const CourseChat: FC<CourseChatProps> = ({ courseId, courseName = '' }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicateWarning, setIsDuplicateWarning] = useState(false);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use formatted course name or default
  const displayCourseName = courseName || `Course ${courseId}`;

  const resetChat = () => {
    // Clear all messages
    setMessages([]);
    // Clear selected files
    setSelectedFiles(new Set());
    // Show confirmation
    toast.success("Chat history cleared");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingFiles(true);
      setError(null);
      
      try {
        const courseFiles = await getCourseFiles(courseId);
        setFiles(courseFiles);
      } catch (error) {
        console.error('Error loading course files:', error);
        
        // Handle specific error cases
        if (error instanceof Error) {
          if (error.message.includes('Resource not found')) {
            setError(`${displayCourseName} not found. Please check the course ID.`);
          } else if (error.message.includes('Invalid Canvas API token')) {
            setError('Invalid Canvas API token. Please check your Canvas settings.');
          } else {
            setError(`Error loading course files: ${error.message}`);
          }
        } else {
          setError('An unknown error occurred while loading course files.');
        }
      } finally {
        setIsLoadingFiles(false);
      }
    };
    
    loadFiles();
  }, [courseId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleToggleFile = async (fileId: string) => {
    const newSelectedFiles = new Set(selectedFiles);
    
    if (newSelectedFiles.has(fileId)) {
      // If unselecting a file
      newSelectedFiles.delete(fileId);
    } else {
      // If selecting a new file
      newSelectedFiles.add(fileId);
      
      // Load file content if not already loaded
      const file = files.find(f => f.id === fileId);
      if (file && !file.content) {
        try {
          // Mark file as processing
          setProcessingFiles(prev => new Set(prev).add(fileId));
          
          // Extract content from the file
          const content = await getFileContent(file.url, file.name);
          
          // Update the file with its content
          setFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, content } : f
            )
          );
        } catch (error) {
          console.error('Error loading file content:', error);
          
          // Update file with error message
          setFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, content: `Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}` } : f
            )
          );
        } finally {
          // Remove from processing state
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
        }
      }
    }
    
    setSelectedFiles(newSelectedFiles);
  };

  // Create a function to force sending a specific message
  const forceSendMessage = (text: string) => {
    const forcedMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, forcedMessage]);
    setIsLoading(true);
    
    // Process the forced message
    processChatRequest(text, forcedMessage);
  };

  // Create a separate function to process chat requests
  const processChatRequest = async (inputText: string, userMessage: Message) => {
    try {
      // Prepare the chat history
      const chatHistory = messages.filter(msg => msg.role !== 'system');
      
      // Get selected files with content
      const selectedFilesWithContent = files
        .filter(file => selectedFiles.has(file.id) && file.content);
      
      // Create the API messages array
      const apiMessages = [...chatHistory, userMessage];
      
      if (selectedFilesWithContent.length > 0) {
        // Format the file context with special handling for PDFs
        const selectedFilesContent = selectedFilesWithContent
          .map(file => {
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const fileHeader = `File: ${file.name}${isPdf ? ' (PDF)' : ''}`;
            
            // For PDFs, add a note about the extraction method
            if (isPdf && file.content.includes('[This PDF file could not be processed')) {
              return `${fileHeader}\n[PDF content not available. Using the filename for context.]`;
            }
            
            return `${fileHeader}\n${file.content}`;
          })
          .join('\n\n');
          
        // Add the file context as a system message
        apiMessages.push({ 
          role: 'system', 
          content: `Context from selected files:\n${selectedFilesContent}` 
        });
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          courseId,
          courseName
        }),
        credentials: 'include', // Include auth cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in again.');
        }
        throw new Error('Failed to get response from AI assistant');
      }

      const data = await response.json();
      
      // Update the messages with the AI response corresponding to this specific user message
      setMessages(prev => {
        // Find the index of the user message we're responding to
        const userMsgIndex = prev.findIndex(
          msg => msg.role === 'user' && msg.content === inputText
        );
        
        if (userMsgIndex === -1) {
          // If the user message is no longer in the chat (unusual case), 
          // just append the assistant response
          return [...prev.filter(msg => msg.role !== 'system'), { 
            role: 'assistant', 
            content: data.message 
          }];
        }
        
        // Create a new array with all messages, inserting the assistant response
        // right after the corresponding user message
        const updatedMessages = [...prev];
        
        // Check if there's already an assistant response after this user message
        if (userMsgIndex + 1 < updatedMessages.length && 
            updatedMessages[userMsgIndex + 1].role === 'assistant') {
          // Replace the existing assistant response
          updatedMessages[userMsgIndex + 1] = { 
            role: 'assistant', 
            content: data.message 
          };
        } else {
          // Insert a new assistant response after the user message
          updatedMessages.splice(userMsgIndex + 1, 0, { 
            role: 'assistant', 
            content: data.message 
          });
        }
        
        return updatedMessages.filter(msg => msg.role !== 'system');
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Find the user message we're responding to
      setMessages(prev => {
        const userMsgIndex = prev.findIndex(
          msg => msg.role === 'user' && msg.content === inputText
        );
        
        if (userMsgIndex === -1) {
          // If we can't find the user message, just append the error
          return [...prev.filter(msg => msg.role !== 'system'), { 
            role: 'assistant', 
            content: error instanceof Error 
              ? `Error: ${error.message}` 
              : 'Sorry, I encountered an error. Please try again.'
          }];
        }
        
        // Create a new array with all messages, inserting the error message
        const updatedMessages = [...prev];
        
        // Check if there's already an assistant response after this user message
        if (userMsgIndex + 1 < updatedMessages.length && 
            updatedMessages[userMsgIndex + 1].role === 'assistant') {
          // Replace the existing assistant response
          updatedMessages[userMsgIndex + 1] = { 
            role: 'assistant', 
            content: error instanceof Error 
              ? `Error: ${error.message}` 
              : 'Sorry, I encountered an error. Please try again.'
          };
        } else {
          // Insert a new assistant response after the user message
          updatedMessages.splice(userMsgIndex + 1, 0, { 
            role: 'assistant', 
            content: error instanceof Error 
              ? `Error: ${error.message}` 
              : 'Sorry, I encountered an error. Please try again.'
          });
        }
        
        return updatedMessages.filter(msg => msg.role !== 'system');
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Create a new user message
    const newMessage: Message = { role: 'user', content: input };
    
    // Clear input immediately to prevent accidental double-sends
    const userInput = input;
    setInput('');
    
    // Check if this is a duplicate of the last message (user sending the same text)
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMessage && lastMessage.role === 'user' && lastMessage.content === userInput) {
      console.log('Preventing duplicate message');
      // Show toast notification for duplicate message
      toast.info(
        <div>
          <p>You already sent this message.</p>
          <button 
            onClick={() => {
              // Force send the message with a slight modification to bypass duplicate check
              forceSendMessage(userInput + ' '); 
            }}
            className="mt-2 text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            Send anyway
          </button>
        </div>
      );
      setIsDuplicateWarning(true);
      // Reset the warning after 3 seconds
      setTimeout(() => setIsDuplicateWarning(false), 3000);
      // Set the input back to show the user what they typed
      setInput(userInput);
      return;
    }
    setIsDuplicateWarning(false);
    
    // Add the new message to the chat
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    // Process the chat request
    processChatRequest(userInput, newMessage);
  };

  // Get count of files currently being processed
  const processingFileCount = processingFiles.size;

  // Improve the message rendering with better styling
  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={index}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div 
          className={`
            rounded-lg shadow-sm
            ${isUser 
              ? 'bg-blue-500 text-white ml-8 mr-0 max-w-[80%] px-4 py-3' 
              : 'bg-white border border-gray-200 mr-8 ml-0 max-w-[85%] p-4'}
          `}
        >
          {!isUser && (
            <div className="prose prose-slate max-w-none">
              {message.content.split('\n').map((paragraph, i) => {
                // Check if paragraph is a list item
                if (paragraph.trim().startsWith('•') || paragraph.trim().startsWith('-') || /^\d+\./.test(paragraph.trim())) {
                  return <p key={i} className="mb-2">{paragraph}</p>;
                }
                
                // Check if it's a code block
                if (paragraph.trim().startsWith('```') || paragraph.trim().endsWith('```')) {
                  return <pre key={i} className="bg-gray-100 p-2 rounded font-mono text-sm my-2">{paragraph.replace(/```/g, '')}</pre>;
                }
                
                // Check for inline code
                if (paragraph.includes('`')) {
                  return (
                    <p key={i} className="mb-2">
                      {paragraph.split('`').map((part, j) => {
                        return j % 2 === 0 
                          ? part 
                          : <code key={j} className="bg-gray-100 px-1 py-0.5 rounded font-mono text-sm">{part}</code>;
                      })}
                    </p>
                  );
                }
                
                // Bold text handling
                if (paragraph.includes('**')) {
                  return (
                    <p key={i} className="mb-2">
                      {paragraph.split('**').map((part, j) => {
                        return j % 2 === 0 
                          ? part 
                          : <strong key={j}>{part}</strong>;
                      })}
                    </p>
                  );
                }
                
                // Italic text handling
                if (paragraph.includes('*')) {
                  return (
                    <p key={i} className="mb-2">
                      {paragraph.split('*').map((part, j) => {
                        return j % 2 === 0 
                          ? part 
                          : <em key={j}>{part}</em>;
                      })}
                    </p>
                  );
                }
                
                // Regular paragraph
                return paragraph.trim() ? <p key={i} className="mb-2 last:mb-0">{paragraph}</p> : <br key={i} />;
              })}
            </div>
          )}
          {isUser && <div className="text-white break-words">{message.content}</div>}
        </div>
      </div>
    );
  };

  // Add a new component for the file count indicator at the bottom of the page
  const FileContextStatus: FC<{selectedFiles: Set<string>}> = ({ selectedFiles }) => {
    if (selectedFiles.size === 0) return null;
    
    return (
      <div className="flex justify-center items-center py-2 border-t bg-gray-50 text-xs text-blue-600">
        <FileText className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
        <span>Using {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} as context</span>
      </div>
    );
  };

  // Render error state if there's an error
  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] w-full bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Course</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please check that you have permission to access this course.
          </p>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoadingFiles) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] w-full bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Loading Course Materials</h2>
          <p className="text-gray-500 mt-2">
            Fetching files from Canvas for {displayCourseName}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Reset button - only visible when there are messages */}
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={resetChat}
                className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw size={12} className="mr-1" />
                Reset Chat
              </button>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center max-w-2xl mx-auto px-4">
                <h3 className="text-xl font-semibold mb-2">{displayCourseName} Assistant</h3>
                <p className="mb-4">Ask any question about your course materials!</p>
                <div className="text-sm">
                  <p>Examples:</p>
                  <ul className="mt-2 space-y-2">
                    <li className="p-2 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">&quot;Can you explain the concept of pipelining from Lecture 2.1?&quot;</li>
                    <li className="p-2 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">&quot;What are the key points about RISC-V registers?&quot;</li>
                    <li className="p-2 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">&quot;Summarize Chapter 5 about memory systems.&quot;</li>
                    <li className="p-2 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">&quot;Help me understand the formulas in the Formula List PDF.&quot;</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-2">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center text-gray-500 bg-white p-3 rounded-lg shadow-sm">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin text-blue-500" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File context indicator */}
        {selectedFiles.size > 0 && (
          <FileContextStatus selectedFiles={selectedFiles} />
        )}

        {/* Input area */}
        <div className="p-4 border-t bg-white">
          <form onSubmit={handleFormSubmit} className="flex items-start gap-2">
            <div className="relative flex-1">
              <textarea
                id="chat-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (isDuplicateWarning) setIsDuplicateWarning(false);
                }}
                placeholder="Ask a question about your course materials..."
                className={`
                  w-full p-3 border rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-base min-h-[60px] max-h-[200px]
                  ${isDuplicateWarning ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}
                `}
                rows={1}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              
              {/* Processing files indicator */}
              {processingFileCount > 0 && (
                <div className="absolute right-3 bottom-3 flex items-center text-amber-600 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`
                p-3 rounded-lg text-white self-stretch
                flex items-center justify-center w-12
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:cursor-not-allowed transition-colors
                ${isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'}
              `}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* File context panel */}
      <FileContextPanel
        files={files}
        onToggleFile={handleToggleFile}
        selectedFiles={selectedFiles}
        processingFiles={processingFiles}
      />
    </div>
  );
};

export default CourseChat; 