'use client';

import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskPriority, TaskStatus, TaskTreeNode } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChecklistSection } from './ChecklistSection';
import { formatDate } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ListTodo,
  Calendar,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export interface TaskCardProps {
  task: TaskTreeNode;
  userId: string;
  supabase: SupabaseClient;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit: (task: TaskTreeNode) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentTask: TaskTreeNode) => void;
  onMoveOrder?: (taskId: string, direction: 'up' | 'down') => void;
  onRefresh: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TaskCard({
  task,
  userId,
  supabase,
  isSelected,
  onSelect,
  onStatusChange,
  onEdit,
  onDelete,
  onAddSubtask,
  onMoveOrder,
  onRefresh,
  isExpanded = true,
  onToggleExpand,
}: TaskCardProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isCompleted = task.status === 'completed';
  const isCanceled = task.status === 'canceled';
  const isPastDue =
    task.due_date &&
    new Date(task.due_date).getTime() < Date.now() &&
    !isCompleted &&
    !isCanceled;

  const handleToggleCompletion = () => {
    if (isCompleted) {
      onStatusChange(task.id, 'todo');
    } else {
      onStatusChange(task.id, 'completed');
    }
  };

  const hasChildren = (task.children?.length ?? 0) > 0 || task.total_children_count > 0;

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={`group relative rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
      }`}
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          {/* Completion Checkbox Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCompletion();
            }}
            className="mt-0.5 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/40" />
            ) : task.status === 'in_progress' ? (
              <Clock className="w-5 h-5 text-indigo-500" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          {/* Title & Description & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                className={`text-sm sm:text-base font-semibold leading-snug break-words ${
                  isCompleted
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : isCanceled
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {task.title}
              </h4>

              {/* Priority & Status Badges */}
              <Badge variant="priority" priority={task.priority} />
              <Badge variant="status" status={task.status} />

              {/* Nesting Depth Indicator */}
              {task.depth > 0 && (
                <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                  L{task.depth}
                </span>
              )}
            </div>

            {task.description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Metadata row: Due date, checklist count, subtask count */}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {task.due_date && (
                <div
                  className={`flex items-center gap-1 font-medium ${
                    isPastDue ? 'text-rose-500 dark:text-rose-400' : ''
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(task.due_date)}</span>
                  {isPastDue && (
                    <span title="Overdue">
                      <AlertCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              )}

              {/* Checklist Toggle Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChecklist((prev) => !prev);
                }}
                className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>
                  {task.completed_checklist_count}/{task.total_checklist_count} Steps
                </span>
              </button>

              {/* Subtask Children Summary */}
              {hasChildren && (
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                  <span>
                    Subtasks: {task.completed_children_count}/{task.active_children_count}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar (from view `tasks_with_progress`) */}
            {(hasChildren || task.total_checklist_count > 0 || task.progress_percentage > 0) && (
              <div className="mt-2.5 max-w-xs">
                <ProgressBar
                  value={task.progress_percentage}
                  size="sm"
                  showLabel={true}
                />
              </div>
            )}
          </div>

          {/* Action Menu & Controls */}
          <div className="relative flex items-center gap-1 shrink-0">
            {/* Expand / Collapse Subtasks */}
            {hasChildren && onToggleExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Reorder Arrows (Accessible Reordering) */}
            {onMoveOrder && (
              <div className="hidden sm:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveOrder(task.id, 'up');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                  title="Move Up"
                  aria-label="Move task up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveOrder(task.id, 'down');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                  title="Move Down"
                  aria-label="Move task down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Add Subtask Button (enforcing max depth 5) */}
            {task.depth < 5 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubtask(task);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                title="Add Subtask"
                aria-label={`Add subtask to ${task.title}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* Overflow Action Menu Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Task options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Action Popup Menu */}
            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(task);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Task</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {/* Status Switchers */}
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Set Status
                </div>
                {(['todo', 'in_progress', 'completed', 'canceled'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onStatusChange(task.id, st);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-left capitalize ${
                      task.status === st ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''
                    }`}
                  >
                    <span>{st.replace('_', ' ')}</span>
                  </button>
                ))}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(task.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Checklist Items Section */}
        {showChecklist && (
          <ChecklistSection
            taskId={task.id}
            userId={userId}
            supabase={supabase}
            onItemUpdated={onRefresh}
          />
        )}
      </div>
    </div>
  );
}
