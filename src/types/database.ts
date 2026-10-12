// ==========================================
// Canonical Database Types from docs/data-contract.md
// ==========================================

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'canceled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string; // UUID
  user_id: string; // UUID
  name: string; // non-empty string
  description: string | null;
  color: string | null; // hex format e.g. #3B82F6
  is_archived: boolean;
  created_at: string; // ISO 8601 TIMESTAMPTZ
  updated_at: string; // ISO 8601 TIMESTAMPTZ
}

export interface Task {
  id: string; // UUID
  user_id: string; // UUID
  project_id: string | null; // null represents Inbox
  parent_id: string | null; // null represents Root Task
  title: string; // non-empty string
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null; // ISO 8601 TIMESTAMPTZ
  completed_at: string | null; // ISO 8601 TIMESTAMPTZ
  sort_order: number; // integer
  depth: number; // 0 to 5
  created_at: string; // ISO 8601 TIMESTAMPTZ
  updated_at: string; // ISO 8601 TIMESTAMPTZ
}

export interface TaskChecklistItem {
  id: string; // UUID
  user_id: string; // UUID
  task_id: string; // UUID
  title: string; // non-empty string
  is_completed: boolean;
  position: number; // integer
  created_at: string; // ISO 8601 TIMESTAMPTZ
  updated_at: string; // ISO 8601 TIMESTAMPTZ
}

// View Model: tasks_with_progress
export interface TaskWithProgress extends Task {
  total_children_count: number;
  active_children_count: number;
  completed_children_count: number;
  total_checklist_count: number;
  completed_checklist_count: number;
  is_leaf: boolean;
  progress_percentage: number; // numeric e.g. 75.00
}

// Hierarchical UI Task with children recursively
export interface TaskTreeNode extends TaskWithProgress {
  children?: TaskTreeNode[];
  checklistItems?: TaskChecklistItem[];
}
