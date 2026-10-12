import { describe, expect, it } from 'vitest';
import { calculateTaskProgress } from './progress';

describe('calculateTaskProgress', () => {
  it('Rule 1: should calculate branch progress correctly with active children', () => {
    // 2 completed, 1 todo, 1 canceled = 2 completed out of 3 active = 66.67%
    const result = calculateTaskProgress({
      status: 'in_progress',
      children: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'todo' },
        { status: 'canceled' },
      ],
    });

    expect(result.totalChildrenCount).toBe(4);
    expect(result.activeChildrenCount).toBe(3);
    expect(result.completedChildrenCount).toBe(2);
    expect(result.isLeaf).toBe(false);
    expect(result.progressPercentage).toBe(66.67);
  });

  it('Rule 1 edge: branch with all canceled children should return 100 if completed, else 0', () => {
    const completedBranch = calculateTaskProgress({
      status: 'completed',
      children: [{ status: 'canceled' }, { status: 'canceled' }],
    });
    expect(completedBranch.progressPercentage).toBe(100);

    const todoBranch = calculateTaskProgress({
      status: 'todo',
      children: [{ status: 'canceled' }, { status: 'canceled' }],
    });
    expect(todoBranch.progressPercentage).toBe(0);
  });

  it('Rule 2: leaf task with checklist items should calculate checklist percentage', () => {
    const result = calculateTaskProgress({
      status: 'todo',
      children: [],
      checklistItems: [
        { is_completed: true },
        { is_completed: false },
        { is_completed: true },
        { is_completed: true },
      ],
    });

    expect(result.isLeaf).toBe(true);
    expect(result.totalChecklistCount).toBe(4);
    expect(result.completedChecklistCount).toBe(3);
    expect(result.progressPercentage).toBe(75.0);
  });

  it('Rule 3: simple leaf task without checklist items returns status-based progress', () => {
    expect(
      calculateTaskProgress({ status: 'completed', children: [], checklistItems: [] })
        .progressPercentage
    ).toBe(100);

    expect(
      calculateTaskProgress({ status: 'in_progress', children: [], checklistItems: [] })
        .progressPercentage
    ).toBe(50);

    expect(
      calculateTaskProgress({ status: 'todo', children: [], checklistItems: [] })
        .progressPercentage
    ).toBe(0);

    expect(
      calculateTaskProgress({ status: 'canceled', children: [], checklistItems: [] })
        .progressPercentage
    ).toBe(0);
  });
});
