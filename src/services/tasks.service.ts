import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskStatus, TaskWithProgress } from '@/types/database';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/types/todo';

export interface GetTasksOptions {
  projectId?: string | null;
  parentId?: string | null;
  includeAllSubtasks?: boolean;
}

export class TasksService {
  /**
   * Fetches tasks from the authoritative `tasks_with_progress` view.
   * Scoped to the authenticated user.
   */
  static async getTasksWithProgress(
    supabase: SupabaseClient,
    options: GetTasksOptions = {}
  ): Promise<{ data: TaskWithProgress[] | null; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      let query = supabase
        .from('tasks_with_progress')
        .select('*')
        .eq('user_id', user.id);

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
   * Creates a root task or subtask with verified user ownership.
   * Validates relational boundaries (project_id and parent_id belong to user)
   * and derives owner identity directly from the authenticated session.
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
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { data: null, error: 'Unauthorized: No authenticated user session.' };
      }

      // Pre-validate relational ownership boundaries
      if (parsed.data.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('id', parsed.data.project_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!project) {
          return { data: null, error: 'Selected project not found or belongs to another user.' };
        }
      }

      if (parsed.data.parent_id) {
        const { data: parentTask } = await supabase
          .from('tasks')
          .select('id, depth')
          .eq('id', parsed.data.parent_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!parentTask) {
          return { data: null, error: 'Selected parent task not found or belongs to another user.' };
        }
      }

      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
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

      // Read back with progress from view scoped to user
      const { data: taskWithProgress } = await supabase
        .from('tasks_with_progress')
        .select('*')
        .eq('id', inserted.id)
        .eq('user_id', user.id)
        .single();

      return { data: taskWithProgress as TaskWithProgress, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task';
      return { data: null, error: msg };
    }
  }

  /**
   * Updates an existing task's fields for the authenticated user.
   * Validates relational boundaries and scopes update strictly to user.id.
   */
  static async updateTask(
    supabase: SupabaseClient,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<{ data: TaskWithProgress | null; error: string | null }> {
    const parsed = UpdateTaskSchema.safeParse(input);
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

      // Pre-validate relational ownership boundaries if project_id or parent_id are updated
      if (parsed.data.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('id', parsed.data.project_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!project) {
          return { data: null, error: 'Selected project not found or belongs to another user.' };
        }
      }

      if (parsed.data.parent_id) {
        const { data: parentTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('id', parsed.data.parent_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!parentTask) {
          return { data: null, error: 'Selected parent task not found or belongs to another user.' };
        }
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update(parsed.data)
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return { data: null, error: TasksService.mapDatabaseError(error) };
      }

      const { data: taskWithProgress } = await supabase
        .from('tasks_with_progress')
        .select('*')
        .eq('id', updated.id)
        .eq('user_id', user.id)
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
   * Updates only within the authenticated user's scope.
   */
  static async reorderTasks(
    supabase: SupabaseClient,
    userId: string,
    items: { id: string; sort_order: number }[]
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return { success: false, error: 'Unauthorized: No active authenticated session.' };
      }

      const updatePromises = items.map((item) =>
        supabase
          .from('tasks')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('user_id', user.id)
      );

      const results = await Promise.all(updatePromises);
      const failed = results.find((r) => r.error);

      if (failed && failed.error) {
        return { success: false, error: TasksService.mapDatabaseError(failed.error) };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder tasks';
      return { success: false, error: msg };
    }
  }

  /**
   * Deletes a task owned by the authenticated user.
   * Cascades down to direct and indirect subtasks & checklist items.
   */
  static async deleteTask(
    supabase: SupabaseClient,
    taskId: string
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
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

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
