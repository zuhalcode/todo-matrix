'use client';

import React, { useState, useEffect } from 'react';
import type { Project } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { hexColorRegex } from '@/types/todo';

export interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    description: string | null;
    color: string | null;
  }) => Promise<{ success: boolean; error?: string }>;
  initialData?: Project | null;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

export function ProjectDialog({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: ProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || '');
      setColor(initialData.color || '#3b82f6');
    } else {
      setName('');
      setDescription('');
      setColor('#3b82f6');
    }
    setError(null);
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    if (color && !hexColorRegex.test(color)) {
      setError('Color must be a valid 6-character hex code (e.g. #3B82F6).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      color: color || null,
    });

    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to save project.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Project' : 'Create Project'}
      description="Projects organize related tasks and hierarchical subtasks."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Project Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mobile App Redesign"
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
            placeholder="Overview of project objectives..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Color Accent
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color.toLowerCase() === c.toLowerCase()
                    ? 'border-indigo-600 scale-110 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#3B82F6"
            className="w-36 font-mono text-xs uppercase"
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
