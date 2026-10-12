import { z } from 'zod';
import type { TaskPriority, TaskStatus } from './database';

// Hex color regex e.g. #3B82F6 or #fff123
export const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(hexColorRegex, 'Invalid hex color (e.g. #3B82F6)')
    .optional()
    .nullable(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  is_archived: z.boolean().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed', 'canceled'] as const).default('todo'),
  due_date: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const).optional(),
  status: z.enum(['todo', 'in_progress', 'completed', 'canceled'] as const).optional(),
  due_date: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const CreateChecklistItemSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().trim().min(1, 'Checklist item title is required').max(200),
  position: z.number().int().default(0),
});

export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemSchema>;

// Gamification Types (derived purely from authentic task state)
export interface GamificationState {
  totalXp: number;
  level: number;
  currentLevelProgress: number; // 0 to 100%
  xpForNextLevel: number;
  completedTasksCount: number;
  completedChecklistsCount: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  progressPercent: number;
}
