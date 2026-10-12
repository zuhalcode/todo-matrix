-- Migration: 20261012000003_create_indexes_and_views.sql
-- Description: Creates workload-tailored indexes and the authoritative tasks_with_progress view.

-- 1. Performance Indexes for Projects
CREATE INDEX idx_projects_user_archived
    ON projects (user_id, is_archived);

CREATE INDEX idx_projects_user_created
    ON projects (user_id, created_at DESC);

-- 2. Performance Indexes for Tasks
-- Optimized for project root/subtask listing with sort ordering
CREATE INDEX idx_tasks_user_project_parent_sort
    ON tasks (user_id, project_id, parent_id, sort_order);

-- Optimized for fetching children of a specific parent
CREATE INDEX idx_tasks_user_parent_sort
    ON tasks (user_id, parent_id, sort_order);

-- Optimized for status filters
CREATE INDEX idx_tasks_user_status
    ON tasks (user_id, status);

-- Partial index for rapid inbox root task access
CREATE INDEX idx_tasks_user_inbox_root
    ON tasks (user_id, sort_order)
    WHERE project_id IS NULL AND parent_id IS NULL;

-- Partial index for active tasks with due dates (dashboard / overdue / today queries)
CREATE INDEX idx_tasks_user_active_due_date
    ON tasks (user_id, due_date)
    WHERE status NOT IN ('completed', 'canceled') AND due_date IS NOT NULL;

-- 3. Performance Indexes for Checklist Items
CREATE INDEX idx_checklist_user_task_position
    ON task_checklist_items (user_id, task_id, position);

-- 4. Authoritative View: tasks_with_progress
-- Defined with security_invoker = true to inherit caller RLS policies seamlessly in Supabase PostgREST
CREATE OR REPLACE VIEW tasks_with_progress
WITH (security_invoker = true)
AS
SELECT
    t.id,
    t.user_id,
    t.project_id,
    t.parent_id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.due_date,
    t.completed_at,
    t.sort_order,
    t.depth,
    t.created_at,
    t.updated_at,
    COALESCE(c.total_children, 0)::INT AS total_children_count,
    COALESCE(c.active_children, 0)::INT AS active_children_count,
    COALESCE(c.completed_children, 0)::INT AS completed_children_count,
    COALESCE(k.total_checklists, 0)::INT AS total_checklist_count,
    COALESCE(k.completed_checklists, 0)::INT AS completed_checklist_count,
    (COALESCE(c.total_children, 0) = 0) AS is_leaf,
    CASE
        -- Case 1: Branch task with active children (exclude canceled)
        WHEN COALESCE(c.total_children, 0) > 0 AND COALESCE(c.active_children, 0) > 0 THEN
            ROUND((c.completed_children::NUMERIC / c.active_children::NUMERIC) * 100.00, 2)
        -- Case 2: Branch task with all children canceled
        WHEN COALESCE(c.total_children, 0) > 0 AND COALESCE(c.active_children, 0) = 0 THEN
            CASE WHEN t.status = 'completed' THEN 100.00 ELSE 0.00 END
        -- Case 3: Leaf task with checklist items
        WHEN COALESCE(c.total_children, 0) = 0 AND COALESCE(k.total_checklists, 0) > 0 THEN
            ROUND((k.completed_checklists::NUMERIC / k.total_checklists::NUMERIC) * 100.00, 2)
        -- Case 4: Leaf task without checklist items
        ELSE
            CASE
                WHEN t.status = 'completed' THEN 100.00
                WHEN t.status = 'in_progress' THEN 50.00
                ELSE 0.00
            END
    END AS progress_percentage
FROM tasks t
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_children,
        COUNT(*) FILTER (WHERE status IN ('todo', 'in_progress', 'completed')) AS active_children,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_children
    FROM tasks sub
    WHERE sub.parent_id = t.id
) c ON TRUE
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_checklists,
        COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed_checklists
    FROM task_checklist_items chk
    WHERE chk.task_id = t.id
) k ON TRUE;

COMMENT ON VIEW tasks_with_progress IS 'Security-invoking view providing realtime progress derivation and child/checklist aggregates.';
