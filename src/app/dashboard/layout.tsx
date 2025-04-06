'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { DashboardProvider } from '@/lib/DashboardContext';
import { User } from '@supabase/supabase-js';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientComponentClient();

  // Keep track of the last visited path to maintain state during navigation
  useEffect(() => {
    if (pathname) {
      localStorage.setItem('last_dashboard_path', pathname);
    }
  }, [pathname]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    checkAuth();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Left section - Canvas Token only */}
              <div className="flex items-center space-x-4">
                <Link
                  href="/settings#canvas-token"
                  className="text-gray-600 hover:text-gray-900 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Canvas Token
                </Link>
              </div>
              
              {/* Center section - Logo */}
              <div className="flex items-center absolute left-1/2 transform -translate-x-1/2">
                <Link href="/dashboard" className="text-xl font-semibold">
                  Canv<span className="text-indigo-600">AI</span>
                </Link>
              </div>
              
              {/* Right section - User info & Sign out */}
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </DashboardProvider>
  );
} 