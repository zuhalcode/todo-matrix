import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskChecklistItem } from '@/types/database';
import { CreateChecklistItemSchema, type CreateChecklistItemInput } from '@/types/todo';

export class ChecklistsService {
  /**
   * Fetches all checklist items for a task, ordered by position.
   * Scoped to the authenticated user.
   */
  static async getChecklistItems(
    supabase: SupabaseClient,
    taskId: string
  ): Promise<{ data: TaskChecklistItem[] | null; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data as TaskChecklistItem[], error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch checklist items';
      return { data: null, error: msg };
    }
  }

  /**
   * Creates a new checklist item with verified user ownership.
   * Validates that the target task belongs to the authenticated user.
   */
  static async createChecklistItem(
    supabase: SupabaseClient,
    userId: string,
    input: CreateChecklistItemInput
  ): Promise<{ data: TaskChecklistItem | null; error: string | null }> {
    const parsed = CreateChecklistItemSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0]?.message || 'Invalid checklist input' };
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      // Pre-validate target task ownership
      const { data: parentTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', parsed.data.task_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!parentTask) {
        return { data: null, error: 'Target task not found or belongs to another user.' };
      }

      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({
          user_id: user.id,
          task_id: parsed.data.task_id,
          title: parsed.data.title,
          position: parsed.data.position,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23514') {
          return { data: null, error: 'Checklist item title cannot be blank.' };
        }
        return { data: null, error: error.message };
      }

      return { data: data as TaskChecklistItem, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create checklist item';
      return { data: null, error: msg };
    }
  }

  /**
   * Toggles the completion state of a checklist item owned by the user.
   */
  static async toggleChecklistItem(
    supabase: SupabaseClient,
    itemId: string,
    isCompleted: boolean
  ): Promise<{ data: TaskChecklistItem | null; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      const { data, error } = await supabase
        .from('task_checklist_items')
        .update({ is_completed: isCompleted })
        .eq('id', itemId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as TaskChecklistItem, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle checklist item';
      return { data: null, error: msg };
    }
  }

  /**
   * Deletes a checklist item owned by the user.
   */
  static async deleteChecklistItem(
    supabase: SupabaseClient,
    itemId: string
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
        .from('task_checklist_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete checklist item';
      return { success: false, error: msg };
    }
  }
}
