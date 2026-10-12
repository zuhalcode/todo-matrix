import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './DashboardClient';
import type { Project, TaskWithProgress } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Fetch initial projects for the authenticated user
  const { data: projectsData } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  // Fetch initial tasks from authoritative view tasks_with_progress for the authenticated user
  const { data: tasksData } = await supabase
    .from('tasks_with_progress')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  const initialProjects: Project[] = (projectsData as Project[]) || [];
  const initialTasks: TaskWithProgress[] = (tasksData as TaskWithProgress[]) || [];

  return (
    <DashboardClient
      user={user}
      initialProjects={initialProjects}
      initialTasks={initialTasks}
    />
  );
}
