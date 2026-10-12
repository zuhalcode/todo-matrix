-- Migration: 20261012000002_create_functions_and_triggers.sql
-- Description: Implements updated_at automation, task completion tracking,
--              hierarchy cycle validation, depth propagation, and progress calculation.

-- 1. Updated At Trigger Function
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_updated_at() IS 'Automatically maintains updated_at timestamp on row mutation.';

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_task_checklist_items_updated_at
    BEFORE UPDATE ON task_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- 2. Task Completed At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION handle_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        IF NEW.completed_at IS NULL THEN
            NEW.completed_at := now();
        END IF;
    ELSIF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_task_completed_at() IS 'Sets completed_at when status becomes completed and clears it when reopened.';

CREATE TRIGGER trg_tasks_completed_at
    BEFORE INSERT OR UPDATE OF status, completed_at ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION handle_task_completed_at();

-- 3. Hierarchy Validation & Cycle Prevention Trigger Function
CREATE OR REPLACE FUNCTION validate_task_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    curr_parent_id UUID;
    parent_record RECORD;
    visited_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    -- If root task (no parent)
    IF NEW.parent_id IS NULL THEN
        NEW.depth := 0;
        RETURN NEW;
    END IF;

    -- Guard against direct self-parenting
    IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'Task cannot be its own parent (task_id: %)', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;

    -- Lookup parent record within same user scope
    SELECT id, depth, project_id, parent_id
    INTO parent_record
    FROM tasks
    WHERE id = NEW.parent_id AND user_id = NEW.user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent task % does not exist or belongs to another user', NEW.parent_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Enforce project coherence: subtask must belong to parent task project
    IF NEW.project_id IS DISTINCT FROM parent_record.project_id THEN
        NEW.project_id := parent_record.project_id;
    END IF;

    -- Detect circular chains
    IF NEW.id IS NOT NULL THEN
        visited_ids := ARRAY[NEW.id];
    END IF;

    curr_parent_id := NEW.parent_id;
    WHILE curr_parent_id IS NOT NULL LOOP
        IF curr_parent_id = ANY(visited_ids) THEN
            RAISE EXCEPTION 'Circular task hierarchy detected involving task %', curr_parent_id
                USING ERRCODE = 'check_violation';
        END IF;

        visited_ids := array_append(visited_ids, curr_parent_id);

        SELECT parent_id INTO curr_parent_id
        FROM tasks
        WHERE id = curr_parent_id AND user_id = NEW.user_id;
    END LOOP;

    -- Calculate depth based on verified parent
    NEW.depth := parent_record.depth + 1;

    IF NEW.depth > 5 THEN
        RAISE EXCEPTION 'Maximum task nesting depth (5) exceeded for task %', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_task_hierarchy() IS 'Prevents cycles, enforces project inheritance, and sets depth (max 5).';

CREATE TRIGGER trg_validate_task_hierarchy
    BEFORE INSERT OR UPDATE OF parent_id, project_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_hierarchy();

-- 4. Descendant Depth Cascade Trigger Function
CREATE OR REPLACE FUNCTION cascade_descendant_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.depth IS DISTINCT FROM NEW.depth THEN
        UPDATE tasks
        SET depth = depth + (NEW.depth - OLD.depth)
        WHERE parent_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION cascade_descendant_depth() IS 'Cascades depth adjustments down to child tasks when parent is moved.';

CREATE TRIGGER trg_cascade_descendant_depth
    AFTER UPDATE OF depth ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION cascade_descendant_depth();

-- 5. Authoritative Progress Calculation Database Function
CREATE OR REPLACE FUNCTION calculate_task_progress(target_task_id UUID)
RETURNS NUMERIC(5, 2)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
    v_task_status task_status;
    v_total_children INT := 0;
    v_active_children INT := 0;
    v_completed_children INT := 0;
    v_total_checklists INT := 0;
    v_completed_checklists INT := 0;
BEGIN
    -- Verify task exists and caller has read access (RLS applied)
    SELECT status INTO v_task_status
    FROM tasks
    WHERE id = target_task_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Aggregate direct children
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status IN ('todo', 'in_progress', 'completed')),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO
        v_total_children,
        v_active_children,
        v_completed_children
    FROM tasks
    WHERE parent_id = target_task_id;

    -- Rule 1: Parent task with direct children
    IF v_total_children > 0 THEN
        IF v_active_children > 0 THEN
            RETURN ROUND((v_completed_children::NUMERIC / v_active_children::NUMERIC) * 100.00, 2);
        ELSE
            -- All children canceled
            IF v_task_status = 'completed' THEN
                RETURN 100.00;
            ELSE
                RETURN 0.00;
            END IF;
        END IF;
    END IF;

    -- Rule 2: Leaf task - evaluate checklist items
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE is_completed = TRUE)
    INTO
        v_total_checklists,
        v_completed_checklists
    FROM task_checklist_items
    WHERE task_id = target_task_id;

    IF v_total_checklists > 0 THEN
        RETURN ROUND((v_completed_checklists::NUMERIC / v_total_checklists::NUMERIC) * 100.00, 2);
    END IF;

    -- Rule 3: Simple leaf task without subtasks or checklist items
    IF v_task_status = 'completed' THEN
        RETURN 100.00;
    ELSIF v_task_status = 'in_progress' THEN
        RETURN 50.00;
    ELSE
        RETURN 0.00;
    END IF;
END;
$$;

COMMENT ON FUNCTION calculate_task_progress(UUID) IS 'Authoritative progress calculation logic for a single task.';
