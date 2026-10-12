'use client';

import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskPriority, TaskStatus, TaskTreeNode } from '@/types/database';
import { TaskCard } from './TaskCard';

export interface TaskTreeProps {
  tasks: TaskTreeNode[];
  userId: string;
  supabase: SupabaseClient;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask: (task: TaskTreeNode) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubtask: (parentTask: TaskTreeNode) => void;
  onMoveOrder?: (taskId: string, direction: 'up' | 'down') => void;
  onRefresh: () => void;
}

export function TaskTree({
  tasks,
  userId,
  supabase,
  selectedTaskId,
  onSelectTask,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onAddSubtask,
  onMoveOrder,
  onRefresh,
}: TaskTreeProps) {
  // Store set of expanded task IDs (default: all expanded)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const renderNode = (node: TaskTreeNode) => {
    const isExpanded = !collapsedIds.has(node.id);
    const hasChildren = (node.children?.length ?? 0) > 0;
    const depthIndent = Math.min(node.depth, 5) * 20;

    return (
      <div key={node.id} className="space-y-2">
        <div style={{ paddingLeft: `${depthIndent}px` }}>
          <TaskCard
            task={node}
            userId={userId}
            supabase={supabase}
            isSelected={node.id === selectedTaskId}
            onSelect={onSelectTask}
            onStatusChange={onStatusChange}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onAddSubtask={onAddSubtask}
            onMoveOrder={onMoveOrder}
            onRefresh={onRefresh}
            isExpanded={isExpanded}
            onToggleExpand={hasChildren ? () => toggleExpand(node.id) : undefined}
          />
        </div>

        {/* Recursive Subtask Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-2 relative before:absolute before:left-[11px] before:top-0 before:bottom-3 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
            {node.children!.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          No tasks found in this view.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Create a new task above to start making progress!
        </p>
      </div>
    );
  }

  return <div className="space-y-3">{tasks.map((task) => renderNode(task))}</div>;
}
