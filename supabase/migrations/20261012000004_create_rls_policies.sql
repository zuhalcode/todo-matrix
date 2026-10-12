-- Migration: 20261012000004_create_rls_policies.sql
-- Description: Enables Row Level Security (RLS) and enforces strict multi-tenant
--              user isolation policies across projects, tasks, and task_checklist_items.

-- 1. Enable and Force RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_items FORCE ROW LEVEL SECURITY;

-- 2. RLS Policies: projects
CREATE POLICY "projects_select_own"
    ON projects
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own"
    ON projects
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own"
    ON projects
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_own"
    ON projects
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 3. RLS Policies: tasks
CREATE POLICY "tasks_select_own"
    ON tasks
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own"
    ON tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own"
    ON tasks
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own"
    ON tasks
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. RLS Policies: task_checklist_items
CREATE POLICY "task_checklist_items_select_own"
    ON task_checklist_items
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "task_checklist_items_insert_own"
    ON task_checklist_items
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_checklist_items_update_own"
    ON task_checklist_items
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_checklist_items_delete_own"
    ON task_checklist_items
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
