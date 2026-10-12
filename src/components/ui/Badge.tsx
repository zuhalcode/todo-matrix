import React from 'react';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/database';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'priority' | 'status' | 'outline';
  priority?: TaskPriority;
  status?: TaskStatus;
}

export function Badge({
  className,
  variant = 'default',
  priority,
  status,
  children,
  ...props
}: BadgeProps) {
  let colorClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';

  if (variant === 'priority' && priority) {
    switch (priority) {
      case 'low':
        colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300';
        break;
      case 'medium':
        colorClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900';
        break;
      case 'high':
        colorClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900';
        break;
      case 'urgent':
        colorClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900 animate-pulse-subtle';
        break;
    }
  }

  if (variant === 'status' && status) {
    switch (status) {
      case 'todo':
        colorClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        break;
      case 'in_progress':
        colorClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900';
        break;
      case 'completed':
        colorClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
        break;
      case 'canceled':
        colorClass = 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-500';
        break;
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-transparent select-none',
        colorClass,
        className
      )}
      {...props}
    >
      {children || priority || status}
    </span>
  );
}
