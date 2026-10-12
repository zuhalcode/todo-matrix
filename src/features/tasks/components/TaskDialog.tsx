'use client';

import React, { useState, useEffect } from 'react';
import type { Project, TaskPriority, TaskStatus, TaskTreeNode, TaskWithProgress } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { validateHierarchyTransition } from '../domain/hierarchy';

export interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
    project_id: string | null;
    parent_id: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
  initialData?: TaskTreeNode | null;
  parentTask?: TaskTreeNode | null;
  currentProjectId?: string | null;
  projects: Project[];
  allTasks: TaskWithProgress[];
}

export function TaskDialog({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  parentTask,
  currentProjectId,
  projects,
  allTasks,
}: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setDueDate(initialData.due_date ? initialData.due_date.substring(0, 10) : '');
      setProjectId(initialData.project_id);
      setParentId(initialData.parent_id);
    } else if (parentTask) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setDueDate('');
      setProjectId(parentTask.project_id);
      setParentId(parentTask.id);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setDueDate('');
      setProjectId(currentProjectId ?? null);
      setParentId(null);
    }
    setError(null);
  }, [isOpen, initialData, parentTask, currentProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    // Validate hierarchy transition
    if (initialData && parentId !== initialData.parent_id) {
      const val = validateHierarchyTransition(initialData.id, parentId, allTasks);
      if (!val.valid) {
        setError(val.error || 'Invalid parent task.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    const result = await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      project_id: projectId || null,
      parent_id: parentId || null,
    });

    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to save task.');
    }
  };

  // Filter tasks eligible to be parents (cannot be the task itself or exceed depth 4)
  const eligibleParents = allTasks.filter((t) => {
    if (initialData && t.id === initialData.id) return false;
    return t.depth < 5;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialData
          ? 'Edit Task'
          : parentTask
          ? `Add Subtask to "${parentTask.title}"`
          : 'Create New Task'
      }
      description="Organize your work with priorities, deadlines, and hierarchies."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design 3D productivity sanctum"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add relevant context, acceptance criteria, or notes..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Due Date
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Inbox (No Project)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Parent Task Selector (Only if not fixed subtask modal) */}
        {!parentTask && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parent Task (Optional)
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">None (Top-Level Root Task)</option>
              {eligibleParents.map((t) => (
                <option key={t.id} value={t.id}>
                  {'—'.repeat(t.depth)} {t.title} (Level {t.depth})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
