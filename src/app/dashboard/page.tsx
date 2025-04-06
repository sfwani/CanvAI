'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AssignmentCalendar from '@/components/AssignmentCalendar';
import { useDashboard } from '@/lib/DashboardContext';

// Import types for dashboard data
interface Course {
  id: number;
  name: string;
  course_code: string;
}

interface Announcement {
  id: number;
  title: string;
  posted_at: string;
}

interface Assignment {
  id: number;
  name: string;
  due_at: string | null;
  course_id: number;
  html_url: string;
  courseName?: string;
}

interface Term {
  id: number;
  name: string;
}

interface DashboardData {
  courses: Course[];
  currentTerm: Term | null;
  assignments: Assignment[];
  announcements: Announcement[];
  lastFetched: number | null;
}

// Skeleton loading component for better UX
const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 animate-pulse">
    <div className="lg:col-span-1">
      <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100">
        <div className="p-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-5 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="mt-3 h-3 bg-gray-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100 mt-6">
        <div className="p-6">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="lg:col-span-3">
      <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100 p-6">
        <div className="h-8 bg-gray-200 rounded w-40 mb-6 mx-auto"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { data, loading, error, fetchData } = useDashboard();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [initialCachedData, setInitialCachedData] = useState<DashboardData | null>(null);

  // On first render, try to load data from localStorage immediately
  useEffect(() => {
    try {
      const STORAGE_KEY = 'dashboard_cache';
      const cachedDataJson = localStorage.getItem(STORAGE_KEY);
      if (cachedDataJson) {
        const cachedData = JSON.parse(cachedDataJson) as DashboardData;
        
        // Check if the cached data is recent enough (15 min)
        if (cachedData.lastFetched && Date.now() - cachedData.lastFetched < 15 * 60 * 1000) {
          setInitialCachedData(cachedData);
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData().then(() => {
      // Set initial load to false after first data fetch completes
      setIsInitialLoad(false);
    });
  }, [fetchData]);

  // If we have initial cached data, show it immediately
  if (initialCachedData && isInitialLoad && loading) {
    return (
      <div className="relative animate-fade-in">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100">
          <div className="h-1 bg-indigo-600 animate-loading-bar"></div>
        </div>
        <DashboardContent data={initialCachedData} error={null} />
      </div>
    );
  }

  // Use a more elegant loading state with skeleton for initial load
  if (loading && isInitialLoad) {
    return (
      <div className="animate-fade-in">
        <DashboardSkeleton />
      </div>
    );
  }

  // For subsequent loading states (not initial), show the data with a subtle loading indicator
  if (loading && !isInitialLoad && data) {
    return (
      <div className="relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100">
          <div className="h-1 bg-indigo-600 animate-loading-bar"></div>
        </div>
        <DashboardContent data={data} error={error} />
      </div>
    );
  }

  return <DashboardContent data={data} error={error} />;
}

// Separate the content component for better organization and reuse
function DashboardContent({ data, error }: { data: DashboardData | null, error: string | null }) {
  return (
    <>
      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Courses */}
        <div className="lg:col-span-1">
          <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Current Term</h2>
              <p className="text-sm text-gray-500 mb-4">
                {data?.currentTerm?.name || 'No active term'} 
                <Link href="/settings#canvas-token" className="ml-2 text-indigo-600 hover:text-indigo-800 text-xs inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Canvas Token
                </Link>
              </p>
              <h3 className="text-md font-medium text-gray-900 mb-3">Your Courses</h3>
              <div className="space-y-4">
                {data?.courses && data.courses.length > 0 ? (
                  data.courses.map(course => (
                    <div
                      key={course.id}
                      className="group h-40 perspective"
                    >
                      <div className="relative preserve-3d w-full h-full duration-700 group-hover:rotate-y-180">
                        {/* Front of card */}
                        <div className="absolute backface-hidden w-full h-full p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                          <h3 className="font-semibold text-gray-800">{course.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{course.course_code}</p>
                          <div className="mt-3 text-xs text-indigo-600 font-medium">Hover to see options</div>
                        </div>
                        
                        {/* Back of card */}
                        <div className="absolute backface-hidden rotate-y-180 w-full h-full p-6 bg-indigo-50 rounded-lg border border-indigo-100 shadow-md flex flex-col justify-center items-center">
                          <Link
                            href={`/course/${course.id}`}
                            className="mb-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-200 text-center font-medium"
                          >
                            Open Instructor
                          </Link>
                          <Link
                            href={`/dashboard/${course.id}/files`}
                            className="w-full py-2.5 bg-white hover:bg-gray-100 text-gray-700 rounded-md border border-gray-200 transition-colors duration-200 text-center font-medium"
                          >
                            View Files
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No courses found for the current term</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Announcements */}
          <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100 mt-6">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Announcements</h2>
              <div className="space-y-4">
                {data?.announcements && data.announcements.length > 0 ? (
                  data.announcements.map(announcement => (
                    <div
                      key={announcement.id}
                      className="p-4 bg-white rounded-lg hover:bg-gray-50 transition-all duration-200 border border-gray-100 shadow-sm hover:shadow-md"
                    >
                      <h3 className="font-semibold text-gray-800">{announcement.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Posted: {new Date(announcement.posted_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No recent announcements</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="bg-white overflow-hidden shadow-md rounded-lg border border-gray-100 p-6">
            <AssignmentCalendar assignments={data?.assignments || []} />
          </div>
        </div>
      </div>
    </>
  );
} 