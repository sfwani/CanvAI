'use client';

import { FC, useEffect, useState } from 'react';
import CourseChat from '@/components/CourseChat';
import Link from 'next/link';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import { use } from 'react';
import { CanvasAPI } from '@/lib/canvas';

interface PageProps {
  params: Promise<{
    courseId: string;
  }>;
}

interface StoredCourseInfo {
  id: string;
  name: string;
  time: number;
}

const CoursePage: FC<PageProps> = ({ params }) => {
  const { courseId } = use(params);
  const [courseName, setCourseName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to get course name from localStorage first
    const fetchCourseDetails = async () => {
      try {
        setLoading(true);
        
        // Check localStorage first
        const storedCoursesJson = localStorage.getItem('dashboard_courses');
        
        if (storedCoursesJson) {
          const storedCourses = JSON.parse(storedCoursesJson) as StoredCourseInfo[];
          const matchingCourse = storedCourses.find(course => course.id.toString() === courseId.toString());
          
          if (matchingCourse) {
            setCourseName(matchingCourse.name);
            setError(null);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to API if not found in localStorage
        const canvasApi = await CanvasAPI.create();
        
        if (!canvasApi) {
          throw new Error('Could not initialize Canvas API');
        }
        
        // Fetch course details
        const courseDetails = await canvasApi.getCourseDetails(courseId);
        
        if (courseDetails && courseDetails.name) {
          setCourseName(courseDetails.name);
          
          // Store in localStorage for future use
          const courses: StoredCourseInfo[] = storedCoursesJson 
            ? JSON.parse(storedCoursesJson) 
            : [];
            
          // Add or update this course in localStorage
          const existingIndex = courses.findIndex(c => c.id.toString() === courseId.toString());
          if (existingIndex >= 0) {
            courses[existingIndex] = { 
              id: courseId.toString(), 
              name: courseDetails.name,
              time: Date.now()
            };
          } else {
            courses.push({ 
              id: courseId.toString(), 
              name: courseDetails.name,
              time: Date.now()
            });
          }
          
          localStorage.setItem('dashboard_courses', JSON.stringify(courses));
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching course details:', err);
        setError('Could not load course details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourseDetails();
  }, [courseId]);

  useEffect(() => {
    // Update document title when course name changes
    if (courseName) {
      document.title = `${courseName} - CanvAI`;
    } else if (!loading) {
      document.title = 'CanvAI';
    }
  }, [courseName, loading]);

  // Handle navigation back to dashboard with state preservation
  const handleBackToDashboard = () => {
    // No action needed, the dashboard will now use cached data
    // when navigating back from this page
  };

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Header */}
      <header className="h-16 border-b bg-white shadow-sm flex items-center px-6 shrink-0">
        {/* Back button - left aligned */}
        <div className="w-48 flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            onClick={handleBackToDashboard}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span className="font-medium">Dashboard</span>
          </Link>
        </div>
        
        {/* Course Title - centered */}
        <div className="flex-1 flex justify-center items-center">
          {loading ? (
            <div className="flex items-center">
              <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
              <Loader2 className="h-4 w-4 ml-2 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <h1 className="text-lg font-semibold text-gray-500">Canv<span className="text-indigo-600">AI</span></h1>
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {courseName || "Untitled Course"}
                {error && (
                  <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                    Limited Data
                  </span>
                )}
              </h2>
            </div>
          )}
        </div>
        
        {/* PDF File Notice - right aligned */}
        <div className="w-48 flex justify-end">
          <div className="flex-shrink-0 flex items-center text-amber-600 text-sm border border-amber-200 px-3 py-1.5 rounded-full bg-amber-50">
            <Info className="h-4 w-4 mr-1.5 text-amber-500 flex-shrink-0" />
            <span className="whitespace-nowrap">PDF files are processed on the server</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <CourseChat courseId={courseId} courseName={courseName} />
      </main>
    </div>
  );
};

export default CoursePage; 