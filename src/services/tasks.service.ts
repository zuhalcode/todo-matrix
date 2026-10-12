import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskStatus, TaskWithProgress } from '@/types/database';
import { CreateTaskSchema, type CreateTaskInput, type UpdateTaskInput } from '@/types/todo';

export interface GetTasksOptions {
  projectId?: string | null;
  parentId?: string | null;
  includeAllSubtasks?: boolean;
}

export class TasksService {
  /**
   * Fetches tasks from the authoritative `tasks_with_progress` view.
   * Inherits RLS automatically via security_invoker = true.
   */
  static async getTasksWithProgress(
    supabase: SupabaseClient,
    options: GetTasksOptions = {}
  ): Promise<{ data: TaskWithProgress[] | null; error: string | null }> {
    try {
      let query = supabase.from('tasks_with_progress').select('*');

      if (options.projectId !== undefined) {
        if (options.projectId === null) {
          query = query.is('project_id', null);
        } else {
          query = query.eq('project_id', options.projectId);
        }
      }

      if (!options.includeAllSubtasks) {
        if (options.parentId !== undefined) {
          if (options.parentId === null) {
            query = query.is('parent_id', null);
          } else {
            query = query.eq('parent_id', options.parentId);
          }
        }
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data as TaskWithProgress[], error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tasks';
      return { data: null, error: msg };
    }
  }

  /**
   * Creates a root task or subtask.
   * Triggers automatically validate cycles, set depth (<=5), and inherit parent's project_id.
   */
  static async createTask(
    supabase: SupabaseClient,
    userId: string,
    input: CreateTaskInput
  ): Promise<{ data: TaskWithProgress | null; error: string | null }> {
    const parsed = CreateTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0]?.message || 'Invalid task input' };
    }

    try {
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: parsed.data.title,
          description: parsed.data.description || null,
          project_id: parsed.data.project_id || null,
          parent_id: parsed.data.parent_id || null,
          priority: parsed.data.priority,
          status: parsed.data.status,
          due_date: parsed.data.due_date || null,
          sort_order: parsed.data.sort_order,
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: TasksService.mapDatabaseError(error) };
      }

      // Read back with progress from view
      const { data: taskWithProgress } = await supabase
        .from('tasks_with_progress')
        .select('*')
        .eq('id', inserted.id)
        .single();

      return { data: taskWithProgress as TaskWithProgress, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      return { data: null, error: msg };
    }
  }

  /**
   * Updates an existing task's fields.
   */
  static async updateTask(
    supabase: SupabaseClient,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<{ data: TaskWithProgress | null; error: string | null }> {
    try {
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(input)
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        return { data: null, error: TasksService.mapDatabaseError(error) };
      }

      const { data: taskWithProgress } = await supabase
        .from('tasks_with_progress')
        .select('*')
        .eq('id', updated.id)
        .single();

      return { data: taskWithProgress as TaskWithProgress, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      return { data: null, error: msg };
    }
  }

  /**
   * Toggles or updates task status.
   * `handle_task_completed_at` trigger automatically synchronizes completed_at.
   */
  static async setTaskStatus(
    supabase: SupabaseClient,
    taskId: string,
    newStatus: TaskStatus
  ): Promise<{ data: TaskWithProgress | null; error: string | null }> {
    return TasksService.updateTask(supabase, taskId, { status: newStatus });
  }

  /**
   * Reparents a task (moves under another parent or to root).
   * Validated on database via `trg_validate_task_hierarchy`.
   */
  static async reparentTask(
    supabase: SupabaseClient,
    taskId: string,
    newParentId: string | null
  ): Promise<{ data: TaskWithProgress | null; error: string | null }> {
    return TasksService.updateTask(supabase, taskId, { parent_id: newParentId });
  }

  /**
   * Reorders tasks by updating their sort_order values.
   */
  static async reorderTasks(
    supabase: SupabaseClient,
    userId: string,
    items: { id: string; sort_order: number }[]
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const updates = items.map((item) => ({
        id: item.id,
        user_id: userId,
        sort_order: item.sort_order,
      }));

      const { error } = await supabase.from('tasks').upsert(updates, { onConflict: 'id' });

      if (error) {
        return { success: false, error: TasksService.mapDatabaseError(error) };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder tasks';
      return { success: false, error: msg };
    }
  }

  /**
   * Deletes a task. Cascades down to direct and indirect subtasks & checklist items.
   */
  static async deleteTask(
    supabase: SupabaseClient,
    taskId: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) return { success: false, error: TasksService.mapDatabaseError(error) };
      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task';
      return { success: false, error: msg };
    }
  }

  /**
   * Maps PostgreSQL error codes according to docs/data-contract.md specifications.
   */
  private static mapDatabaseError(error: { code?: string; message: string }): string {
    if (error.code === '23514') {
      if (error.message.includes('Circular task hierarchy detected')) {
        return 'Cannot move task inside itself or one of its subtasks.';
      }
      if (error.message.includes('Maximum task nesting depth (5) exceeded')) {
        return 'Maximum nesting level of 5 subtasks reached.';
      }
      if (error.message.includes('tasks_title_not_empty')) {
        return 'Task title is required and cannot be blank.';
      }
      if (error.message.includes('tasks_no_self_parent')) {
        return 'A task cannot be set as its own parent.';
      }
    }
    if (error.code === '23503') {
      return 'Selected project or parent task not found, or belongs to another user.';
    }
    return error.message;
  }
}
