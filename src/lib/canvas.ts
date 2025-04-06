interface CanvasConfig {
  domain: string;
  token: string;
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  start_at: string | null;
  end_at: string | null;
  enrollment_term_id: number;
  term: {
    id: number;
    name: string;
    start_at: string | null;
    end_at: string | null;
  };
}

interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  course_id: number;
}

interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  course_id: number;
}

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  content_type: string;
}

/**
 * Custom error class for Canvas API errors
 */
export class CanvasApiError extends Error {
  public statusCode?: number;
  
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'CanvasApiError';
    this.statusCode = statusCode;
  }
}

export class CanvasAPI {
  private domain: string;
  private token: string;

  constructor(config: CanvasConfig) {
    this.domain = config.domain.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
  }

  /**
   * Static method to create a CanvasAPI instance from user config
   */
  static async create(): Promise<CanvasAPI | null> {
    try {
      // Fetch user's Canvas configuration from API
      const response = await fetch('/api/user/canvas-config', {
        credentials: 'include' // Include authentication cookies
      });
      
      if (!response.ok) {
        console.error('Failed to fetch Canvas configuration');
        return null;
      }
      
      const config = await response.json();
      
      if (!config || !config.domain || !config.token) {
        console.error('Invalid Canvas configuration');
        return null;
      }
      
      return new CanvasAPI(config);
    } catch (error) {
      console.error('Error creating CanvasAPI:', error);
      return null;
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    try {
      console.log(`Fetching Canvas API endpoint: ${endpoint}`);
      const response = await fetch('/api/canvas/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
        credentials: 'include', // Include authentication cookies
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || 'Failed to fetch Canvas data';
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new CanvasApiError('Authentication required. Please sign in again.', 401);
        }
        
        if (errorMessage.includes('Resource not found')) {
          throw new CanvasApiError(`Resource not found: ${endpoint}`, 404);
        }
        
        if (errorMessage.includes('Invalid Canvas API token')) {
          throw new CanvasApiError('Invalid Canvas API token. Please check your Canvas settings.', 401);
        }
        
        throw new CanvasApiError(errorMessage, response.status);
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching from Canvas:', error);
      
      // If it's already a CanvasApiError, just re-throw it
      if (error instanceof CanvasApiError) {
        throw error;
      }
      
      // Otherwise, create a new CanvasApiError
      throw new CanvasApiError(
        error instanceof Error ? error.message : 'Unable to connect to Canvas. Please check your network connection and Canvas URL.'
      );
    }
  }

  async getCurrentUser() {
    return this.fetch<Record<string, unknown>>('users/self/profile');
  }

  async getCourses() {
    return this.fetch<CanvasCourse[]>('courses?enrollment_state=active&include[]=term&per_page=100');
  }

  async getCourseAssignments(courseId: number) {
    return this.fetch<CanvasAssignment[]>(
      `courses/${courseId}/assignments?include[]=submission&order_by=due_at&per_page=100`
    );
  }

  async getCourseAnnouncements(courseId: number) {
    return this.fetch<CanvasAnnouncement[]>(
      `courses/${courseId}/announcements?per_page=10`
    );
  }

  async getCourseFiles(courseId: number) {
    try {
      return await this.fetch<CanvasFile[]>(
        `courses/${courseId}/files?per_page=100`
      );
    } catch (error) {
      if (error instanceof CanvasApiError && error.statusCode === 404) {
        // Provide more context for course not found errors
        throw new CanvasApiError(`Course ${courseId} not found or you don't have permission to access it.`, 404);
      }
      throw error;
    }
  }

  async getUpcomingAssignments() {
    try {
      const courses = await this.getCourses();
      const assignmentPromises = courses.map(async course => {
        try {
          const assignments = await this.getCourseAssignments(course.id);
          return assignments.map(assignment => ({
            ...assignment,
            courseName: course.name // Add course name to each assignment
          }));
        } catch (error) {
          console.log(`Skipping assignments for course ${course.name} (${course.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });

      const assignments = await Promise.all(assignmentPromises);
      
      return assignments
        .flat()
        .filter(assignment => {
          try {
            return assignment.due_at && new Date(assignment.due_at) > new Date();
          } catch (error) {
            console.log(`Skipping assignment with invalid due date:`, assignment);
            return false;
          }
        })
        .sort((a, b) => {
          try {
            if (!a.due_at || !b.due_at) return 0;
            return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
          } catch (error) {
            console.log(`Error sorting assignments:`, { a, b, error });
            return 0;
          }
        });
    } catch (error) {
      console.error('Error fetching upcoming assignments:', error);
      return [];
    }
  }

  async getRecentAnnouncements() {
    try {
      const courses = await this.getCourses();
      const announcementPromises = courses.map(async course => {
        try {
          const announcements = await this.getCourseAnnouncements(course.id);
          return announcements.map(announcement => ({
            ...announcement,
            courseName: course.name // Add course name to each announcement
          }));
        } catch (error) {
          console.log(`Skipping announcements for course ${course.name} (${course.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
          return [];
        }
      });

      const announcements = await Promise.all(announcementPromises);
      
      return announcements
        .flat()
        .sort((a, b) => {
          try {
            return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
          } catch (error) {
            console.log(`Error sorting announcements:`, { a, b, error });
            return 0;
          }
        });
    } catch (error) {
      console.error('Error fetching recent announcements:', error);
      return [];
    }
  }

  /**
   * Get details for a specific course
   */
  async getCourseDetails(courseId: string | number): Promise<CanvasCourse | null> {
    try {
      return await this.fetch<CanvasCourse>(`courses/${courseId}?include[]=term`);
    } catch (error) {
      console.error(`Error getting details for course ${courseId}:`, error);
      
      if (error instanceof CanvasApiError && error.statusCode === 404) {
        // Course not found
        return null;
      }
      
      throw error;
    }
  }
}

export function createCanvasAPI(config: CanvasConfig) {
  return new CanvasAPI(config);
} 