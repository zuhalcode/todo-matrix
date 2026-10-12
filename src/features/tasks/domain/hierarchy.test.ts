import { describe, expect, it } from 'vitest';
import { buildTaskTree, validateHierarchyTransition } from './hierarchy';
import type { TaskWithProgress } from '@/types/database';

describe('validateHierarchyTransition', () => {
  it('prevents direct self-parenting', () => {
    const result = validateHierarchyTransition('task-1', 'task-1', []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('own parent');
  });

  it('prevents circular loops: T1 -> T2 -> T3, cannot set T1 parent to T3', () => {
    const tasks = [
      { id: 't1', parent_id: null, depth: 0 },
      { id: 't2', parent_id: 't1', depth: 1 },
      { id: 't3', parent_id: 't2', depth: 2 },
    ];

    const result = validateHierarchyTransition('t1', 't3', tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular task hierarchy detected');
  });

  it('prevents exceeding max nesting depth 5', () => {
    const tasks = [{ id: 'parent-deep', parent_id: 'something', depth: 5 }];

    const result = validateHierarchyTransition('new-task', 'parent-deep', tasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Maximum task nesting depth (5) exceeded');
  });

  it('allows valid reparenting', () => {
    const tasks = [
      { id: 'root-1', parent_id: null, depth: 0 },
      { id: 'sub-1', parent_id: 'root-1', depth: 1 },
      { id: 'root-2', parent_id: null, depth: 0 },
    ];

    const result = validateHierarchyTransition('sub-1', 'root-2', tasks);
    expect(result.valid).toBe(true);
  });
});

describe('buildTaskTree', () => {
  it('correctly constructs nested hierarchy from flat list', () => {
    const flat: TaskWithProgress[] = [
      {
        id: 't1',
        user_id: 'u1',
        project_id: null,
        parent_id: null,
        title: 'Root 1',
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date: null,
        completed_at: null,
        sort_order: 1,
        depth: 0,
        created_at: '',
        updated_at: '',
        total_children_count: 1,
        active_children_count: 1,
        completed_children_count: 0,
        total_checklist_count: 0,
        completed_checklist_count: 0,
        is_leaf: false,
        progress_percentage: 0,
      },
      {
        id: 't2',
        user_id: 'u1',
        project_id: null,
        parent_id: 't1',
        title: 'Child 1',
        description: null,
        status: 'todo',
        priority: 'low',
        due_date: null,
        completed_at: null,
        sort_order: 0,
        depth: 1,
        created_at: '',
        updated_at: '',
        total_children_count: 0,
        active_children_count: 0,
        completed_children_count: 0,
        total_checklist_count: 0,
        completed_checklist_count: 0,
        is_leaf: true,
        progress_percentage: 0,
      },
    ];

    const tree = buildTaskTree(flat);
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe('t1');
    expect(tree[0].children?.length).toBe(1);
    expect(tree[0].children?.[0].id).toBe('t2');
  });
});
