import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ProjectsService } from '../projects.service';
import { TasksService } from '../tasks.service';
import { ChecklistsService } from '../checklists.service';

describe('User-Owned Data Architecture & Identity Enforcement', () => {
  const authenticUser = { id: 'auth-user-uuid-1111', email: 'owner@example.com' };
  const forgedUserId = 'attacker-uuid-9999';

  let mockSupabase: any;

  beforeEach(() => {
    // Fresh mock Supabase client for each test
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authenticUser },
          error: null,
        }),
      },
      from: vi.fn(),
    };
  });

  describe('ProjectsService User Ownership', () => {
    it('binds created project strictly to authenticated Supabase user, ignoring forged userId', async () => {
      let insertedPayload: any = null;

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((payload) => {
          insertedPayload = payload;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'p-1', ...payload },
                error: null,
              }),
            }),
          };
        }),
      });

      const res = await ProjectsService.createProject(
        mockSupabase as unknown as SupabaseClient,
        forgedUserId, // malicious/spoofed client argument
        { name: 'My Secure Project' }
      );

      expect(res.error).toBeNull();
      expect(insertedPayload).toBeDefined();
      // Must use authentic session user.id, NOT the forged argument
      expect(insertedPayload.user_id).toBe(authenticUser.id);
      expect(insertedPayload.user_id).not.toBe(forgedUserId);
    });

    it('rejects project creation when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('JWT expired'),
      });

      const res = await ProjectsService.createProject(
        mockSupabase as unknown as SupabaseClient,
        authenticUser.id,
        { name: 'Unauthenticated Project' }
      );

      expect(res.error).toContain('Unauthorized');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('scopes project queries and updates strictly to authenticated user', async () => {
      const eqMock = vi.fn().mockReturnThis();
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: { id: 'p-1' }, error: null }),
      });

      await ProjectsService.getProjects(mockSupabase as unknown as SupabaseClient);
      expect(eqMock).toHaveBeenCalledWith('user_id', authenticUser.id);

      await ProjectsService.updateProject(mockSupabase as unknown as SupabaseClient, 'p-1', {
        name: 'Renamed',
      });
      expect(eqMock).toHaveBeenCalledWith('user_id', authenticUser.id);
    });
  });

  describe('TasksService Relational Isolation & User Ownership', () => {
    it('binds created task to authenticated Supabase user', async () => {
      let insertedTask: any = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedTask = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 't-1' }, error: null }),
                }),
              };
            }),
          };
        }
        if (table === 'tasks_with_progress') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 't-1' }, error: null }),
          };
        }
        return {};
      });

      const res = await TasksService.createTask(
        mockSupabase as unknown as SupabaseClient,
        forgedUserId,
        { title: 'Secure Task' }
      );

      expect(res.error).toBeNull();
      expect(insertedTask.user_id).toBe(authenticUser.id);
      expect(insertedTask.user_id).not.toBe(forgedUserId);
    });

    it('prevents attaching task to a project owned by another user', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Returns null because project does not belong to authenticUser
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const res = await TasksService.createTask(
        mockSupabase as unknown as SupabaseClient,
        authenticUser.id,
        {
          title: 'Cross-Project Hijack Attempt',
          project_id: 'a0000000-0000-0000-0000-000000000001',
        }
      );

      expect(res.error).toContain('Selected project not found or belongs to another user');
    });

    it('prevents attaching subtask to a parent task owned by another user', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Returns null because parent does not belong to authenticUser
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const res = await TasksService.createTask(
        mockSupabase as unknown as SupabaseClient,
        authenticUser.id,
        {
          title: 'Cross-Parent Hijack Attempt',
          parent_id: 'b0000000-0000-0000-0000-000000000002',
        }
      );

      expect(res.error).toContain('Selected parent task not found or belongs to another user');
    });

    it('scopes reorder operations strictly to authenticated user', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: eqMock,
          }),
        }),
      });

      const res = await TasksService.reorderTasks(
        mockSupabase as unknown as SupabaseClient,
        authenticUser.id,
        [{ id: 't-1', sort_order: 10 }]
      );

      expect(res.success).toBe(true);
      expect(eqMock).toHaveBeenCalledWith('user_id', authenticUser.id);
    });
  });

  describe('ChecklistsService Relational Isolation & User Ownership', () => {
    it('prevents creating checklist items for another user task', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      const res = await ChecklistsService.createChecklistItem(
        mockSupabase as unknown as SupabaseClient,
        authenticUser.id,
        {
          task_id: 'c0000000-0000-0000-0000-000000000003',
          title: 'Unauthorized checklist item',
          position: 0,
        }
      );

      expect(res.error).toContain('Target task not found or belongs to another user');
    });

    it('binds created checklist item to authenticated user and target task', async () => {
      let insertedItem: any = null;

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'tasks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c0000000-0000-0000-0000-000000000003' }, error: null }),
          };
        }
        if (table === 'task_checklist_items') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedItem = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'chk-1', ...payload }, error: null }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const res = await ChecklistsService.createChecklistItem(
        mockSupabase as unknown as SupabaseClient,
        forgedUserId,
        {
          task_id: 'c0000000-0000-0000-0000-000000000003',
          title: 'Legitimate item',
          position: 0,
        }
      );

      expect(res.error).toBeNull();
      expect(insertedItem.user_id).toBe(authenticUser.id);
      expect(insertedItem.user_id).not.toBe(forgedUserId);
    });
  });
});
