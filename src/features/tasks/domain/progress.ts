import type { TaskStatus } from '@/types/database';

export interface ProgressCalculationInput {
  status: TaskStatus;
  children?: { status: TaskStatus }[];
  checklistItems?: { is_completed: boolean }[];
}

export interface ProgressRollupResult {
  totalChildrenCount: number;
  activeChildrenCount: number;
  completedChildrenCount: number;
  totalChecklistCount: number;
  completedChecklistCount: number;
  isLeaf: boolean;
  progressPercentage: number;
}

/**
 * Pure domain function to calculate task progress identically to the
 * authoritative database function `calculate_task_progress` and view `tasks_with_progress`.
 */
export function calculateTaskProgress(input: ProgressCalculationInput): ProgressRollupResult {
  const children = input.children ?? [];
  const checklistItems = input.checklistItems ?? [];

  const totalChildrenCount = children.length;
  const activeChildren = children.filter((c) =>
    c.status === 'todo' || c.status === 'in_progress' || c.status === 'completed'
  );
  const activeChildrenCount = activeChildren.length;
  const completedChildrenCount = children.filter((c) => c.status === 'completed').length;

  const totalChecklistCount = checklistItems.length;
  const completedChecklistCount = checklistItems.filter((i) => i.is_completed).length;
  const isLeaf = totalChildrenCount === 0;

  let progressPercentage = 0;

  if (!isLeaf) {
    // Case 1: Branch task with active children (canceled excluded from denominator)
    if (activeChildrenCount > 0) {
      progressPercentage = Number(
        ((completedChildrenCount / activeChildrenCount) * 100).toFixed(2)
      );
    } else {
      // Case 2: Branch task with all children canceled
      progressPercentage = input.status === 'completed' ? 100 : 0;
    }
  } else if (totalChecklistCount > 0) {
    // Case 3: Leaf task with checklist items
    progressPercentage = Number(
      ((completedChecklistCount / totalChecklistCount) * 100).toFixed(2)
    );
  } else {
    // Case 4: Simple leaf task
    if (input.status === 'completed') {
      progressPercentage = 100;
    } else if (input.status === 'in_progress') {
      progressPercentage = 50;
    } else {
      progressPercentage = 0;
    }
  }

  return {
    totalChildrenCount,
    activeChildrenCount,
    completedChildrenCount,
    totalChecklistCount,
    completedChecklistCount,
    isLeaf,
    progressPercentage,
  };
}
