'use client';

import React from 'react';
import type { Project, TaskWithProgress } from '@/types/database';
import {
  Inbox,
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';

export interface ProjectSidebarProps {
  projects: Project[];
  tasks: TaskWithProgress[];
  selectedProjectId: string | null | 'all';
  onSelectProject: (projectId: string | null | 'all') => void;
  onOpenCreateProject: () => void;
  onOpenEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectSidebar({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onOpenCreateProject,
  onOpenEditProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  // Compute counts
  const allCount = tasks.length;
  const inboxCount = tasks.filter((t) => t.project_id === null).length;

  const projectCounts = new Map<string, number>();
  tasks.forEach((t) => {
    if (t.project_id) {
      projectCounts.set(t.project_id, (projectCounts.get(t.project_id) || 0) + 1);
    }
  });

  return (
    <aside
      className="w-full md:w-64 bg-slate-50/70 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shrink-0"
      aria-label="Sidebar Navigation"
    >
      <div className="space-y-6">
        {/* Core Navigation Section */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Views
          </div>

          <button
            type="button"
            onClick={() => onSelectProject('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              selectedProjectId === 'all'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ListOrdered className="w-4 h-4 shrink-0" />
              <span>All Tasks</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                selectedProjectId === 'all'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {allCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              selectedProjectId === null
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox className="w-4 h-4 shrink-0" />
              <span>Inbox</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                selectedProjectId === null
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {inboxCount}
            </span>
          </button>
        </div>

        {/* Projects Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Projects ({projects.length})</span>
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              title="Create Project"
              aria-label="Create new project"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5 max-h-[45vh] overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No projects yet.
              </div>
            ) : (
              projects.map((project) => {
                const isSelected = selectedProjectId === project.id;
                const count = projectCounts.get(project.id) || 0;

                return (
                  <div
                    key={project.id}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left focus:outline-none"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <span className="truncate">{project.name}</span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-400 px-1.5 py-0.5 rounded-full group-hover:hidden">
                        {count}
                      </span>

                      {/* Edit / Delete actions on hover */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onOpenEditProject(project)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                          title="Edit project"
                          aria-label={`Edit project ${project.name}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(project.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete project"
                          aria-label={`Delete project ${project.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
        <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
        <span>PostgreSQL RLS Protected</span>
      </div>
    </aside>
  );
}
