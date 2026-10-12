import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskChecklistItem } from '@/types/database';
import { CreateChecklistItemSchema, type CreateChecklistItemInput } from '@/types/todo';

export class ChecklistsService {
  /**
   * Fetches all checklist items for a task, ordered by position.
   */
  static async getChecklistItems(
    supabase: SupabaseClient,
    taskId: string
  ): Promise<{ data: TaskChecklistItem[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId)
        .order('position', { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data as TaskChecklistItem[], error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch checklist items';
      return { data: null, error: msg };
    }
  }

  /**
   * Creates a new checklist item.
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
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({
          user_id: userId,
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
   * Toggles the completion state of a checklist item.
   */
  static async toggleChecklistItem(
    supabase: SupabaseClient,
    itemId: string,
    isCompleted: boolean
  ): Promise<{ data: TaskChecklistItem | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .update({ is_completed: isCompleted })
        .eq('id', itemId)
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
   * Deletes a checklist item.
   */
  static async deleteChecklistItem(
    supabase: SupabaseClient,
    itemId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.from('task_checklist_items').delete().eq('id', itemId);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete checklist item';
      return { success: false, error: msg };
    }
  }
}
