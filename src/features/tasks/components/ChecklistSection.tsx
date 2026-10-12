'use client';

import React, { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TaskChecklistItem } from '@/types/database';
import { ChecklistsService } from '@/services/checklists.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, CheckSquare, Square, Loader2 } from 'lucide-react';

interface ChecklistSectionProps {
  taskId: string;
  userId: string;
  supabase: SupabaseClient;
  onItemUpdated: () => void;
}

export function ChecklistSection({
  taskId,
  userId,
  supabase,
  onItemUpdated,
}: ChecklistSectionProps) {
  const [items, setItems] = useState<TaskChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await ChecklistsService.getChecklistItems(supabase, taskId);
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [taskId]);

  const handleToggle = async (item: TaskChecklistItem) => {
    const nextCompleted = !item.is_completed;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_completed: nextCompleted } : i))
    );
    await ChecklistsService.toggleChecklistItem(supabase, item.id, nextCompleted);
    onItemUpdated();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    const { data } = await ChecklistsService.createChecklistItem(supabase, userId, {
      task_id: taskId,
      title: newTitle.trim(),
      position: items.length,
    });

    if (data) {
      setItems((prev) => [...prev, data]);
      setNewTitle('');
      onItemUpdated();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await ChecklistsService.deleteChecklistItem(supabase, itemId);
    onItemUpdated();
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>Checklist Items ({items.filter((i) => i.is_completed).length}/{items.length})</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Loading items...</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 transition-colors"
            >
              <button
                type="button"
                onClick={() => handleToggle(item)}
                className="flex items-center gap-2 flex-1 text-left focus:outline-none"
              >
                {item.is_completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span className={item.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                  {item.title}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                aria-label={`Delete item: ${item.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a checklist step..."
          className="h-8 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          isLoading={isSubmitting}
          disabled={!newTitle.trim()}
          className="h-8 px-2.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
