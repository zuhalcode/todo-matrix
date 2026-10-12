import { describe, expect, it } from 'vitest';
import { calculateTaskXP, deriveGamificationState } from './progression';
import type { TaskWithProgress } from '@/types/database';

describe('Gamification Progression', () => {
  it('calculates XP based on priority multipliers', () => {
    expect(calculateTaskXP('low')).toBe(50);
    expect(calculateTaskXP('medium')).toBe(60);
    expect(calculateTaskXP('high')).toBe(80);
    expect(calculateTaskXP('urgent')).toBe(100);
  });

  it('derives level, XP, and achievements deterministically', () => {
    const tasks: TaskWithProgress[] = [
      {
        id: 't1',
        user_id: 'u1',
        project_id: null,
        parent_id: null,
        title: 'Task 1',
        description: null,
        status: 'completed',
        priority: 'urgent', // 100 XP
        due_date: null,
        completed_at: null,
        sort_order: 0,
        depth: 0,
        created_at: '',
        updated_at: '',
        total_children_count: 0,
        active_children_count: 0,
        completed_children_count: 0,
        total_checklist_count: 0,
        completed_checklist_count: 0,
        is_leaf: true,
        progress_percentage: 100,
      },
      {
        id: 't2',
        user_id: 'u1',
        project_id: null,
        parent_id: null,
        title: 'Task 2',
        description: null,
        status: 'completed',
        priority: 'high', // 80 XP
        due_date: null,
        completed_at: null,
        sort_order: 1,
        depth: 0,
        created_at: '',
        updated_at: '',
        total_children_count: 0,
        active_children_count: 0,
        completed_children_count: 0,
        total_checklist_count: 0,
        completed_checklist_count: 0,
        is_leaf: true,
        progress_percentage: 100,
      },
    ];

    // 100 + 80 = 180 XP + 2 checklists * 10 XP = 200 XP -> Level 2
    const state = deriveGamificationState(tasks, 2);

    expect(state.totalXp).toBe(200);
    expect(state.level).toBe(2);
    expect(state.completedTasksCount).toBe(2);
    expect(state.completedChecklistsCount).toBe(2);

    const firstStep = state.achievements.find((a) => a.id === 'first_step');
    expect(firstStep?.isUnlocked).toBe(true);

    const deepFocus = state.achievements.find((a) => a.id === 'deep_focus');
    expect(deepFocus?.isUnlocked).toBe(true);
  });
});
