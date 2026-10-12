'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Project, TaskStatus, TaskPriority, TaskTreeNode, TaskWithProgress } from '@/types/database';
import { TasksService } from '@/services/tasks.service';
import { ProjectsService } from '@/services/projects.service';
import { buildTaskTree } from '@/features/tasks/domain/hierarchy';
import { deriveGamificationState } from '@/features/gamification/domain/progression';
import { ProjectSidebar } from '@/features/projects/components/ProjectSidebar';
import { TaskTree } from '@/features/tasks/components/TaskTree';
import { TaskFilters } from '@/features/tasks/components/TaskFilters';
import { TaskDialog } from '@/features/tasks/components/TaskDialog';
import { ProjectDialog } from '@/features/projects/components/ProjectDialog';
import { GamificationBar } from '@/features/gamification/components/GamificationBar';
import { SceneContainer } from '@/components/3d/SceneContainer';
import { Button } from '@/components/ui/Button';
import { Plus, LogOut, CheckSquare2, Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface DashboardClientProps {
  user: User;
  initialProjects: Project[];
  initialTasks: TaskWithProgress[];
}

export function DashboardClient({
  user,
  initialProjects,
  initialTasks,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Persistent server data state
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tasks, setTasks] = useState<TaskWithProgress[]>(initialTasks);

  // Client UI state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null | 'all'>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modals state
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTreeNode | null>(null);
  const [parentSubtaskTask, setParentSubtaskTask] = useState<TaskTreeNode | null>(null);

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 3D Transient celebration trigger
  const [burstTrigger, setBurstTrigger] = useState(0);

  // Refresh tasks and projects from Supabase
  const refreshData = useCallback(async () => {
    const [tasksRes, projectsRes] = await Promise.all([
      TasksService.getTasksWithProgress(supabase, { includeAllSubtasks: true }),
      ProjectsService.getProjects(supabase),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
  }, [supabase]);

  // Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  };

  // Status toggle with celebration trigger
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // If completing, trigger celebration burst
    if (newStatus === 'completed') {
      setBurstTrigger((prev) => prev + 1);
    }

    // Optimistic status update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    await TasksService.setTaskStatus(supabase, taskId, newStatus);
    await refreshData();
  };

  // Reorder handling (Accessible reorder)
  const handleMoveOrder = async (taskId: string, direction: 'up' | 'down') => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Find siblings (same parent_id and project_id)
    const siblings = tasks
      .filter((t) => t.parent_id === task.parent_id && t.project_id === task.project_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = siblings.findIndex((t) => t.id === taskId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    // Swap sort orders
    const currentOrder = siblings[index].sort_order;
    const targetOrder = siblings[targetIndex].sort_order;

    await TasksService.reorderTasks(supabase, user.id, [
      { id: siblings[index].id, sort_order: targetOrder },
      { id: siblings[targetIndex].id, sort_order: currentOrder },
    ]);
    await refreshData();
  };

  // Task Dialog Submit
  const handleTaskDialogSubmit = async (formData: {
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
    project_id: string | null;
    parent_id: string | null;
  }) => {
    if (editingTask) {
      const res = await TasksService.updateTask(supabase, editingTask.id, formData);
      if (res.error) return { success: false, error: res.error };
    } else {
      const res = await TasksService.createTask(supabase, user.id, {
        ...formData,
        sort_order: tasks.length * 10,
      });
      if (res.error) return { success: false, error: res.error };
    }
    await refreshData();
    return { success: true };
  };

  // Project Dialog Submit
  const handleProjectDialogSubmit = async (formData: {
    name: string;
    description: string | null;
    color: string | null;
  }) => {
    if (editingProject) {
      const res = await ProjectsService.updateProject(supabase, editingProject.id, formData);
      if (res.error) return { success: false, error: res.error };
    } else {
      const res = await ProjectsService.createProject(supabase, user.id, formData);
      if (res.error) return { success: false, error: res.error };
    }
    await refreshData();
    return { success: true };
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Are you sure you want to delete this task and all its subtasks?')) {
      await TasksService.deleteTask(supabase, taskId);
      await refreshData();
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? All associated tasks will be deleted.')) {
      await ProjectsService.deleteProject(supabase, projectId);
      if (selectedProjectId === projectId) {
        setSelectedProjectId('all');
      }
      await refreshData();
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Project filter
      if (selectedProjectId === null) {
        if (task.project_id !== null) return false;
      } else if (selectedProjectId !== 'all') {
        if (task.project_id !== selectedProjectId) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [tasks, selectedProjectId, statusFilter, priorityFilter, searchQuery]);

  // Construct hierarchical tree from filtered tasks
  const taskTree = useMemo(() => {
    return buildTaskTree(filteredTasks);
  }, [filteredTasks]);

  // Aggregate completion rate
  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  // Gamification state derived purely from task data
  const gamificationState = useMemo(() => {
    const totalChecklists = tasks.reduce((sum, t) => sum + (t.completed_checklist_count || 0), 0);
    return deriveGamificationState(tasks, totalChecklists);
  }, [tasks]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <CheckSquare2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Todo Matrix</h1>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
                Next.js • Supabase • 3D Sanctum
              </span>
            </div>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              setEditingTask(null);
              setParentSubtaskTask(null);
              setIsTaskDialogOpen(true);
            }}
            className="shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold truncate max-w-[150px]">{user.email}</span>
            <span className="text-[10px] text-emerald-500 font-medium">Authenticated</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 dark:text-slate-300"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main App Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <ProjectSidebar
            projects={projects}
            tasks={tasks}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onOpenCreateProject={() => {
              setEditingProject(null);
              setIsProjectDialogOpen(true);
            }}
            onOpenEditProject={(p) => {
              setEditingProject(p);
              setIsProjectDialogOpen(true);
            }}
            onDeleteProject={handleDeleteProject}
          />
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full z-10 shadow-2xl p-4">
              <ProjectSidebar
                projects={projects}
                tasks={tasks}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  setMobileSidebarOpen(false);
                }}
                onOpenCreateProject={() => {
                  setEditingProject(null);
                  setIsProjectDialogOpen(true);
                  setMobileSidebarOpen(false);
                }}
                onOpenEditProject={(p) => {
                  setEditingProject(p);
                  setIsProjectDialogOpen(true);
                  setMobileSidebarOpen(false);
                }}
                onDeleteProject={handleDeleteProject}
              />
            </div>
          </div>
        )}

        {/* Workspace Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top Gamification Banner */}
          <GamificationBar state={gamificationState} />

          {/* Interactive 3D Productivity Grove */}
          <section aria-label="3D Productivity Sanctum">
            <SceneContainer
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => setSelectedTaskId(id)}
              completionRate={completionRate}
              level={gamificationState.level}
              burstTrigger={burstTrigger}
            />
          </section>

          {/* Task Filters & Control Bar */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {selectedProjectId === 'all'
                    ? 'All Tasks'
                    : selectedProjectId === null
                    ? 'Inbox'
                    : projects.find((p) => p.id === selectedProjectId)?.name || 'Project Tasks'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
                </p>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingTask(null);
                  setParentSubtaskTask(null);
                  setIsTaskDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </Button>
            </div>

            <TaskFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityFilterChange={setPriorityFilter}
              onClearFilters={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
            />
          </section>

          {/* Hierarchical Task Tree */}
          <section aria-label="Task Hierarchy List">
            <TaskTree
              tasks={taskTree}
              userId={user.id}
              supabase={supabase}
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onStatusChange={handleStatusChange}
              onEditTask={(task) => {
                setEditingTask(task);
                setParentSubtaskTask(null);
                setIsTaskDialogOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onAddSubtask={(parent) => {
                setEditingTask(null);
                setParentSubtaskTask(parent);
                setIsTaskDialogOpen(true);
              }}
              onMoveOrder={handleMoveOrder}
              onRefresh={refreshData}
            />
          </section>
        </main>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        isOpen={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        onSubmit={handleTaskDialogSubmit}
        initialData={editingTask}
        parentTask={parentSubtaskTask}
        currentProjectId={selectedProjectId === 'all' ? null : selectedProjectId}
        projects={projects}
        allTasks={tasks}
      />

      {/* Project Dialog */}
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onSubmit={handleProjectDialogSubmit}
        initialData={editingProject}
      />
    </div>
  );
}
