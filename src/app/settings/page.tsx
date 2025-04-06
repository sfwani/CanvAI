'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function Settings() {
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('canvas_token, canvas_domain')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setCanvasToken(data.canvas_token || '');
          setCanvasDomain(data.canvas_domain || '');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setError(error instanceof Error ? error.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    getSettings();
  }, [supabase, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      // Clean up the domain URL
      const cleanDomain = canvasDomain.trim().replace(/\/$/, '');

      console.log('Validating Canvas credentials...');
      
      // Validate Canvas credentials using our API route
      const validateResponse = await fetch('/api/canvas/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: cleanDomain,
          token: canvasToken,
        }),
      });

      const validateData = await validateResponse.json();
      console.log('Validation response:', validateData);

      if (!validateResponse.ok) {
        throw new Error(validateData.error || 'Failed to validate Canvas credentials');
      }

      console.log('Canvas credentials validated successfully');

      // Check if user record exists
      console.log('Checking if user record exists...');
      const { error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingUserError && existingUserError.code === 'PGRST116') {
        // User doesn't exist, create new record
        console.log('User record not found, creating new record...');
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              canvas_token: canvasToken,
              canvas_domain: cleanDomain
            }
          ]);

        if (insertError) {
          console.error('Error creating user record:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          throw new Error(`Failed to create user record: ${insertError.message}`);
        }
      } else if (existingUserError) {
        console.error('Error checking user record:', existingUserError);
        throw new Error(`Failed to check user record: ${existingUserError.message}`);
      } else {
        // User exists, update record
        console.log('Updating existing user record...');
        const { data: dbData, error: dbError } = await supabase
          .from('users')
          .update({
            canvas_token: canvasToken,
            canvas_domain: cleanDomain
          })
          .eq('id', user.id);

        if (dbError) {
          console.error('Database error details:', {
            code: dbError.code,
            message: dbError.message,
            details: dbError.details,
            hint: dbError.hint
          });
          throw new Error(`Failed to save settings to database: ${dbError.message}`);
        }

        console.log('Database update successful:', dbData);
      }

      setSuccess('Settings saved successfully! Redirecting to dashboard...');
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error saving settings:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error
      });
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">Canvas Token Settings</h2>
            <form onSubmit={handleSave} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}
              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}
              <div>
                <label htmlFor="canvasDomain" className="block text-sm font-medium text-gray-700">
                  Canvas Domain
                </label>
                <input
                  type="url"
                  id="canvasDomain"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="https://usflearn.instructure.com"
                  value={canvasDomain}
                  onChange={(e) => setCanvasDomain(e.target.value)}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  For USF students, use: https://usflearn.instructure.com
                </p>
              </div>
              <div id="canvas-token">
                <label htmlFor="canvasToken" className="block text-sm font-medium text-gray-700">
                  Canvas API Token
                </label>
                <input
                  type="password"
                  id="canvasToken"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={canvasToken}
                  onChange={(e) => setCanvasToken(e.target.value)}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">
                  Generate a token in Canvas: Account &gt; Settings &gt; New Access Token
                </p>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 