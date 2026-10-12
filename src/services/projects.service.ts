import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from '@/types/database';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/types/todo';

export class ProjectsService {
  /**
   * Fetches all non-archived projects for the authenticated user.
   */
  static async getProjects(supabase: SupabaseClient): Promise<{ data: Project[] | null; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data as Project[], error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch projects';
      return { data: null, error: msg };
    }
  }

  /**
   * Creates a new project with authoritative user ownership.
   * Derives owner identity directly from the authenticated Supabase session.
   */
  static async createProject(
    supabase: SupabaseClient,
    userId: string,
    input: CreateProjectInput
  ): Promise<{ data: Project | null; error: string | null }> {
    const parsed = CreateProjectSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0]?.message || 'Invalid project data' };
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: parsed.data.name,
          description: parsed.data.description || null,
          color: parsed.data.color || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23514') {
          return { data: null, error: 'Project name cannot be empty and color must be a valid hex code.' };
        }
        return { data: null, error: error.message };
      }

      return { data: data as Project, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      return { data: null, error: msg };
    }
  }

  /**
   * Updates an existing project owned by the authenticated user.
   */
  static async updateProject(
    supabase: SupabaseClient,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<{ data: Project | null; error: string | null }> {
    const parsed = UpdateProjectSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0]?.message || 'Invalid update data' };
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      const { data, error } = await supabase
        .from('projects')
        .update(parsed.data)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as Project, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update project';
      return { data: null, error: msg };
    }
  }

  /**
   * Deletes a project (cascades to all contained tasks in database) owned by the authenticated user.
   */
  static async deleteProject(
    supabase: SupabaseClient,
    projectId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized: No authenticated user session.' };
      }

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      return { success: false, error: msg };
    }
  }
}
