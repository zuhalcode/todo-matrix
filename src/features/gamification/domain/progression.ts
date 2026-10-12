import type { TaskPriority, TaskWithProgress } from '@/types/database';
import type { Achievement, GamificationState } from '@/types/todo';

export const XP_CONFIG = {
  TASK_BASE_XP: 50,
  PRIORITY_MULTIPLIERS: {
    low: 1.0,      // 50 XP
    medium: 1.2,   // 60 XP
    high: 1.6,     // 80 XP
    urgent: 2.0,   // 100 XP
  } as Record<TaskPriority, number>,
  CHECKLIST_ITEM_XP: 10,
  XP_PER_LEVEL: 200,
};

/**
 * Calculates XP earned from a single completed task based on priority.
 */
export function calculateTaskXP(priority: TaskPriority): number {
  const multiplier = XP_CONFIG.PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  return Math.round(XP_CONFIG.TASK_BASE_XP * multiplier);
}

/**
 * Derives the user's gamification state deterministically from real tasks data.
 * Pure function: No localStorage or invented tables, ensuring 100% data integrity.
 */
export function deriveGamificationState(
  tasks: TaskWithProgress[],
  totalCompletedChecklistsCount: number = 0
): GamificationState {
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completedTasksCount = completedTasks.length;

  // Calculate task XP
  const taskXp = completedTasks.reduce((sum, task) => {
    return sum + calculateTaskXP(task.priority);
  }, 0);

  // Calculate checklist XP
  const checklistXp = totalCompletedChecklistsCount * XP_CONFIG.CHECKLIST_ITEM_XP;

  const totalXp = taskXp + checklistXp;

  // Level progression (level 1 starts at 0 XP)
  const level = Math.floor(totalXp / XP_CONFIG.XP_PER_LEVEL) + 1;
  const xpIntoCurrentLevel = totalXp % XP_CONFIG.XP_PER_LEVEL;
  const currentLevelProgress = Math.round(
    (xpIntoCurrentLevel / XP_CONFIG.XP_PER_LEVEL) * 100
  );
  const xpForNextLevel = XP_CONFIG.XP_PER_LEVEL - xpIntoCurrentLevel;

  // Achievements derived from real accomplishments
  const hasHighOrUrgentCompleted = completedTasks.some(
    (t) => t.priority === 'high' || t.priority === 'urgent'
  );
  const hasSubtaskParentCompleted = completedTasks.some(
    (t) => t.total_children_count > 0 && t.completed_children_count === t.active_children_count
  );

  const achievements: Achievement[] = [
    {
      id: 'first_step',
      title: 'First Step',
      description: 'Complete your first task',
      icon: '🌱',
      isUnlocked: completedTasksCount >= 1,
      progressPercent: Math.min(100, Math.round((completedTasksCount / 1) * 100)),
    },
    {
      id: 'deep_focus',
      title: 'High Impact',
      description: 'Complete a High or Urgent priority task',
      icon: '🔥',
      isUnlocked: hasHighOrUrgentCompleted,
      progressPercent: hasHighOrUrgentCompleted ? 100 : 0,
    },
    {
      id: 'branch_master',
      title: 'Branch Master',
      description: 'Complete a task with subtasks',
      icon: '🌳',
      isUnlocked: hasSubtaskParentCompleted,
      progressPercent: hasSubtaskParentCompleted ? 100 : 0,
    },
    {
      id: 'checklist_champion',
      title: 'Checklist Champion',
      description: 'Complete at least 5 checklist items',
      icon: '📝',
      isUnlocked: totalCompletedChecklistsCount >= 5,
      progressPercent: Math.min(
        100,
        Math.round((totalCompletedChecklistsCount / 5) * 100)
      ),
    },
    {
      id: 'productivity_elite',
      title: 'Productivity Adept',
      description: 'Accumulate 300+ total XP',
      icon: '✨',
      isUnlocked: totalXp >= 300,
      progressPercent: Math.min(100, Math.round((totalXp / 300) * 100)),
    },
  ];

  return {
    totalXp,
    level,
    currentLevelProgress,
    xpForNextLevel,
    completedTasksCount,
    completedChecklistsCount: totalCompletedChecklistsCount,
    achievements,
  };
}
