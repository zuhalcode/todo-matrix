-- Migration: 20261012000001_create_core_schema.sql
-- Description: Creates core enums, tables, check constraints, composite keys, and foreign keys.

-- 1. Custom Enum Types
CREATE TYPE task_status AS ENUM (
    'todo',
    'in_progress',
    'completed',
    'canceled'
);

CREATE TYPE task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- 2. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT projects_name_not_empty CHECK (char_length(trim(name)) > 0),
    CONSTRAINT projects_color_hex_format CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$'),
    CONSTRAINT projects_id_user_id_key UNIQUE (id, user_id)
);

COMMENT ON TABLE projects IS 'Project containers for grouping and organizing user tasks.';
COMMENT ON COLUMN projects.user_id IS 'Owner reference to auth.users.';
COMMENT ON CONSTRAINT projects_id_user_id_key ON projects IS 'Composite unique key required for multi-tenant composite foreign keys.';

-- 3. Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID,
    parent_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tasks_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT tasks_depth_range CHECK (depth >= 0 AND depth <= 5),
    CONSTRAINT tasks_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT tasks_id_user_id_key UNIQUE (id, user_id),
    CONSTRAINT tasks_project_fkey FOREIGN KEY (project_id, user_id)
        REFERENCES projects(id, user_id) ON DELETE CASCADE,
    CONSTRAINT tasks_parent_fkey FOREIGN KEY (parent_id, user_id)
        REFERENCES tasks(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE tasks IS 'Core task table supporting hierarchical nesting and project assignment.';
COMMENT ON COLUMN tasks.project_id IS 'Optional container project. NULL represents Inbox tasks.';
COMMENT ON COLUMN tasks.parent_id IS 'Self-referencing parent task ID. NULL represents root-level tasks.';
COMMENT ON COLUMN tasks.depth IS '0-based nesting depth in the task hierarchy (capped at 5).';
COMMENT ON CONSTRAINT tasks_project_fkey ON tasks IS 'Ensures task and assigned project belong to the identical user.';
COMMENT ON CONSTRAINT tasks_parent_fkey ON tasks IS 'Ensures subtask and parent task belong to the identical user.';

-- 4. Checklist Items Table
CREATE TABLE task_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checklist_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT checklist_task_fkey FOREIGN KEY (task_id, user_id)
        REFERENCES tasks(id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE task_checklist_items IS 'Optional lightweight inline checklists attached to tasks.';
COMMENT ON CONSTRAINT checklist_task_fkey ON task_checklist_items IS 'Ensures checklist item belongs to the same user as the parent task.';
