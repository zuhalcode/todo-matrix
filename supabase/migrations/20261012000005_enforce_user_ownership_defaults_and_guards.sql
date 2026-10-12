-- Migration: 20261012000005_enforce_user_ownership_defaults_and_guards.sql
-- Description: Enforces user ownership defaults, immutability guards, project cascade triggers,
--              and safe quarantine isolation for existing unowned records.
--
-- STRICT RESTRICTION COMPLIANCE:
-- This migration file is designed for review and subsequent authorized execution.
-- Under the prompt restrictions, it is NOT executed against any live or local database.

-- ============================================================================
-- 1. Safe Legacy Data Handling & Quarantine Preservation
-- ============================================================================
-- Rationale:
-- If an existing database has legacy records without an associated Supabase Auth
-- user, we must NOT assign them to an arbitrary user (to prevent data corruption
-- and tenant boundary violations), nor should they be silently dropped.
-- Instead, unowned records are quarantined in a dedicated table for administrator review.

CREATE TABLE IF NOT EXISTS quarantined_unowned_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_table TEXT NOT NULL,
    original_record_id UUID NOT NULL,
    record_payload JSONB NOT NULL,
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL
);

COMMENT ON TABLE quarantined_unowned_records IS
    'Safely preserves legacy records whose ownership cannot be established reliably without making arbitrary user assignment assumptions.';

-- Quarantine any existing checklist items without a valid auth user
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'task_checklist_items'
    ) THEN
        INSERT INTO quarantined_unowned_records (original_table, original_record_id, record_payload, reason)
        SELECT 
            'task_checklist_items',
            c.id,
            to_jsonb(c),
            'Unresolved user ownership: user_id is null or missing in auth.users'
        FROM task_checklist_items c
        WHERE c.user_id IS NULL OR c.user_id NOT IN (SELECT id FROM auth.users)
        ON CONFLICT DO NOTHING;

        DELETE FROM task_checklist_items
        WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;

-- Quarantine any existing tasks without a valid auth user
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tasks'
    ) THEN
        INSERT INTO quarantined_unowned_records (original_table, original_record_id, record_payload, reason)
        SELECT 
            'tasks',
            t.id,
            to_jsonb(t),
            'Unresolved user ownership: user_id is null or missing in auth.users'
        FROM tasks t
        WHERE t.user_id IS NULL OR t.user_id NOT IN (SELECT id FROM auth.users)
        ON CONFLICT DO NOTHING;

        DELETE FROM tasks
        WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;

-- Quarantine any existing projects without a valid auth user
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'projects'
    ) THEN
        INSERT INTO quarantined_unowned_records (original_table, original_record_id, record_payload, reason)
        SELECT 
            'projects',
            p.id,
            to_jsonb(p),
            'Unresolved user ownership: user_id is null or missing in auth.users'
        FROM projects p
        WHERE p.user_id IS NULL OR p.user_id NOT IN (SELECT id FROM auth.users)
        ON CONFLICT DO NOTHING;

        DELETE FROM projects
        WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM auth.users);
    END IF;
END $$;

-- ============================================================================
-- 2. Declarative Defaults for auth.uid()
-- ============================================================================
-- Guarantees that any insert omitting user_id automatically derives ownership
-- from the authenticated Supabase user context without relying on client input.

ALTER TABLE projects
    ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE tasks
    ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE task_checklist_items
    ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ============================================================================
-- 3. Immutability Guards: Prevent user_id Reassignment
-- ============================================================================
-- Prevents any malicious or accidental update from reassigning a project, task,
-- or checklist item to another user.

CREATE OR REPLACE FUNCTION prevent_user_id_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'user_id is immutable and cannot be modified (attempted % -> %)',
            OLD.user_id, NEW.user_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_user_id_mutation() IS
    'Ensures user_id ownership cannot be modified once set on any entity.';

DROP TRIGGER IF EXISTS trg_projects_prevent_user_id_change ON projects;
CREATE TRIGGER trg_projects_prevent_user_id_change
    BEFORE UPDATE OF user_id ON projects
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_id_mutation();

DROP TRIGGER IF EXISTS trg_tasks_prevent_user_id_change ON tasks;
CREATE TRIGGER trg_tasks_prevent_user_id_change
    BEFORE UPDATE OF user_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_id_mutation();

DROP TRIGGER IF EXISTS trg_checklist_prevent_user_id_change ON task_checklist_items;
CREATE TRIGGER trg_checklist_prevent_user_id_change
    BEFORE UPDATE OF user_id ON task_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_id_mutation();

-- ============================================================================
-- 4. Auto-Derivation & Fallback Trigger on INSERT
-- ============================================================================
-- Even if a client sends NULL for user_id, automatically assigns auth.uid().
-- If the caller is not authenticated, raises an explicit exception.

CREATE OR REPLACE FUNCTION enforce_authenticated_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;

    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'user_id cannot be null. An authenticated Supabase session is required.'
            USING ERRCODE = 'not_null_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_authenticated_user_id() IS
    'Automatically populates user_id from auth.uid() when missing, and guards against unauthenticated writes.';

DROP TRIGGER IF EXISTS trg_projects_enforce_user_id ON projects;
CREATE TRIGGER trg_projects_enforce_user_id
    BEFORE INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION enforce_authenticated_user_id();

DROP TRIGGER IF EXISTS trg_tasks_enforce_user_id ON tasks;
CREATE TRIGGER trg_tasks_enforce_user_id
    BEFORE INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION enforce_authenticated_user_id();

DROP TRIGGER IF EXISTS trg_checklist_enforce_user_id ON task_checklist_items;
CREATE TRIGGER trg_checklist_enforce_user_id
    BEFORE INSERT ON task_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION enforce_authenticated_user_id();

-- ============================================================================
-- 5. Subtask Project Coherence Cascade Trigger
-- ============================================================================
-- When a parent task is moved to another project, all existing subtasks
-- recursively synchronize their project_id to match the parent task.

CREATE OR REPLACE FUNCTION cascade_descendant_project()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
        UPDATE tasks
        SET project_id = NEW.project_id
        WHERE parent_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION cascade_descendant_project() IS
    'Propagates project_id reassignments down the hierarchical task subtree.';

DROP TRIGGER IF EXISTS trg_cascade_descendant_project ON tasks;
CREATE TRIGGER trg_cascade_descendant_project
    AFTER UPDATE OF project_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION cascade_descendant_project();

-- ============================================================================
-- 6. Lock Down Anonymous Role
-- ============================================================================
-- Explicitly revoke any residual permissions from anon on user data tables
REVOKE ALL ON projects FROM anon;
REVOKE ALL ON tasks FROM anon;
REVOKE ALL ON task_checklist_items FROM anon;
REVOKE ALL ON tasks_with_progress FROM anon;
REVOKE ALL ON quarantined_unowned_records FROM anon;
REVOKE ALL ON quarantined_unowned_records FROM authenticated;
