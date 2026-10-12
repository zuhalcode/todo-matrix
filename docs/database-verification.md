# Database Verification Plan & Test Suite

**Project:** Modern Todo List Web Application  
**Target Platform:** Next.js & Supabase PostgreSQL  
**Document Status:** Implementation Ready  

---

## 1. Schema Validation Checklist

Use this checklist to verify that all database objects have been created successfully after applying migrations:

- [ ] **Custom Enums:**
  - [ ] `task_status` contains `'todo'`, `'in_progress'`, `'completed'`, `'canceled'`.
  - [ ] `task_priority` contains `'low'`, `'medium'`, `'high'`, `'urgent'`.
- [ ] **Tables & Constraints:**
  - [ ] `projects`: Primary key `id`, foreign key `user_id`, unique composite `(id, user_id)`, non-empty name check, hex color check.
  - [ ] `tasks`: Primary key `id`, foreign key `user_id`, composite FK `(project_id, user_id)`, composite FK `(parent_id, user_id)`, depth check `[0, 5]`, self-parent guard.
  - [ ] `task_checklist_items`: Primary key `id`, composite FK `(task_id, user_id)`.
- [ ] **Triggers & Functions:**
  - [ ] `trg_projects_updated_at`, `trg_tasks_updated_at`, `trg_task_checklist_items_updated_at` fire on update.
  - [ ] `trg_tasks_completed_at` sets and clears `completed_at`.
  - [ ] `trg_validate_task_hierarchy` enforces non-circularity, max depth 5, and project synchronization.
  - [ ] `trg_cascade_descendant_depth` updates children depth when parent depth moves.
  - [ ] `calculate_task_progress` returns deterministic numeric progress.
- [ ] **Views & Indexes:**
  - [ ] View `tasks_with_progress` configured with `security_invoker = true`.
  - [ ] Indexes created on `projects(user_id, is_archived)`, `tasks(user_id, project_id, parent_id, sort_order)`, `tasks(user_id, parent_id, sort_order)`, `task_checklist_items(user_id, task_id, position)`, and partial indexes for inbox and due dates.
- [ ] **Row Level Security & Ownership Defaults (Migration 5):**
  - [ ] `projects.user_id`, `tasks.user_id`, `task_checklist_items.user_id` default to `auth.uid()`.
  - [ ] Triggers `trg_*_prevent_user_id_change` prevent modification of `user_id` on update (`restrict_violation`).
  - [ ] Triggers `trg_*_enforce_user_id` automatically assign `auth.uid()` if missing on insert, and reject unauthenticated inserts.
  - [ ] Trigger `trg_cascade_descendant_project` cascades parent task's `project_id` to subtasks.
  - [ ] Table `quarantined_unowned_records` exists to preserve unresolved legacy data.
  - [ ] RLS enabled and forced on `projects`, `tasks`, `task_checklist_items`.
  - [ ] CRUD policies applied strictly to `authenticated` matching `auth.uid() = user_id`.
  - [ ] Anonymous (`anon`) role has zero permissions.

---

## 2. Test Suite: Verification Scenarios

Run these SQL verification test cases in a staging or local development database.

### 2.1 Test Suite A: Multi-Tenant RLS & Data Isolation

#### Setup Test Users
```sql
-- Ensure two dummy auth users exist for test purposes
INSERT INTO auth.users (id, email)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'user_a@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'user_b@example.com')
ON CONFLICT (id) DO NOTHING;
```

#### Test A.1: User A Creates Project and Task
```sql
-- Set session to User A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

INSERT INTO projects (id, user_id, name)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'User A Project');

INSERT INTO tasks (id, user_id, project_id, title)
VALUES ('aaaaaaaa-1111-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'User A Task 1');

-- Verification: User A sees their records
SELECT count(*) FROM projects; -- Expected: 1
SELECT count(*) FROM tasks;    -- Expected: 1
```

#### Test A.2: User B Cross-Read Isolation
```sql
-- Switch session to User B
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

-- Verification: User B sees 0 rows from User A
SELECT count(*) FROM projects;            -- Expected: 0
SELECT count(*) FROM tasks;               -- Expected: 0
SELECT count(*) FROM tasks_with_progress; -- Expected: 0
```

#### Test A.3: User B Cross-Tenant Foreign Key Attack
```sql
-- User B attempts to attach a task to User A's project
-- Must FAIL with foreign key violation
INSERT INTO tasks (user_id, project_id, title)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- User A's project
    'Malicious Injected Task'
);
-- Expected Outcome: ERROR 23503 (foreign_key_violation: tasks_project_fkey)
```

#### Test A.4: User B Cross-Tenant Subtask Hijacking
```sql
-- User B attempts to attach a subtask to User A's parent task
-- Must FAIL with foreign key violation
INSERT INTO tasks (user_id, parent_id, title)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-1111-0000-0000-000000000001', -- User A's task
    'Malicious Subtask'
);
-- Expected Outcome: ERROR 23503 (foreign_key_violation: tasks_parent_fkey)
```

---

### 2.2 Test Suite B: Task Hierarchy & Cycle Guards

#### Test B.1: Self-Parenting Guard
```sql
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

-- Attempt to set parent_id = id
UPDATE tasks
SET parent_id = id
WHERE id = 'aaaaaaaa-1111-0000-0000-000000000001';
-- Expected Outcome: ERROR 23514 (check_violation: tasks_no_self_parent)
```

#### Test B.2: Multi-Hop Cycle Detection ($T_1 \to T_2 \to T_3 \to T_1$)
```sql
-- Create T2 under T1
INSERT INTO tasks (id, user_id, parent_id, title)
VALUES ('aaaaaaaa-1111-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000001', 'Task 2');

-- Create T3 under T2
INSERT INTO tasks (id, user_id, parent_id, title)
VALUES ('aaaaaaaa-1111-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000002', 'Task 3');

-- Attempt to move T1 under T3 (creating circular dependency)
UPDATE tasks
SET parent_id = 'aaaaaaaa-1111-0000-0000-000000000003'
WHERE id = 'aaaaaaaa-1111-0000-0000-000000000001';
-- Expected Outcome: ERROR 23514 (Circular task hierarchy detected)
```

#### Test B.3: Max Nesting Depth Limit
```sql
-- Attempt to create a 6th nested level (exceeding max depth 5)
-- Depth 0 (T1) -> Depth 1 (T2) -> Depth 2 (T3)
-- Insert T4 (Depth 3), T5 (Depth 4), T6 (Depth 5)
INSERT INTO tasks (id, user_id, parent_id, title) VALUES ('aaaaaaaa-1111-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000003', 'T4');
INSERT INTO tasks (id, user_id, parent_id, title) VALUES ('aaaaaaaa-1111-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000004', 'T5');
INSERT INTO tasks (id, user_id, parent_id, title) VALUES ('aaaaaaaa-1111-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000005', 'T6');

-- Attempt to insert T7 (Depth 6)
INSERT INTO tasks (id, user_id, parent_id, title)
VALUES ('aaaaaaaa-1111-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-0000-0000-000000000006', 'T7');
-- Expected Outcome: ERROR 23514 (Maximum task nesting depth (5) exceeded)
```

---

### 2.3 Test Suite C: Progress Calculation & Status Lifecycle

#### Test C.1: Parent Task Progress with Mixed Subtask Statuses
```sql
-- Clean up tasks and setup test parent P1
DELETE FROM tasks WHERE user_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO tasks (id, user_id, title, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Parent Progress Test', 'in_progress');

-- Add 4 subtasks:
-- Sub 1: completed
-- Sub 2: completed
-- Sub 3: todo
-- Sub 4: canceled (must be ignored in denominator)
INSERT INTO tasks (user_id, parent_id, title, status) VALUES
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000000', 'Sub 1', 'completed'),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000000', 'Sub 2', 'completed'),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000000', 'Sub 3', 'todo'),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000000', 'Sub 4', 'canceled');

-- Query progress from view
SELECT 
    total_children_count,
    active_children_count,
    completed_children_count,
    progress_percentage
FROM tasks_with_progress
WHERE id = 'bbbbbbbb-0000-0000-0000-000000000000';

-- Expected Results:
-- total_children_count: 4
-- active_children_count: 3
-- completed_children_count: 2
-- progress_percentage: 66.67
```

#### Test C.2: Leaf Task with Checklist Items Progress
```sql
INSERT INTO tasks (id, user_id, title, status)
VALUES ('cccccccc-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Leaf Checklist Task', 'todo');

INSERT INTO task_checklist_items (user_id, task_id, title, is_completed, position) VALUES
('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000000', 'Item 1', true, 1),
('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000000', 'Item 2', false, 2);

SELECT 
    is_leaf,
    total_checklist_count,
    completed_checklist_count,
    progress_percentage
FROM tasks_with_progress
WHERE id = 'cccccccc-0000-0000-0000-000000000000';

-- Expected Results:
-- is_leaf: true
-- total_checklist_count: 2
-- completed_checklist_count: 1
-- progress_percentage: 50.00
```

---

## 3. Migration Application Guide (Development Environment)

When the development database is ready and authorized, apply the migrations using one of the following methods:

### Method 1: Supabase CLI (Recommended)
1. Ensure the Supabase CLI is installed and initialize the project:
   ```bash
   npx supabase init
   ```
2. Start the local Supabase emulator or link to your remote project:
   ```bash
   npx supabase start
   # or
   npx supabase link --project-ref your-project-ref
   ```
3. Run the migrations sequentially:
   ```bash
   npx supabase db push
   # or
   npx supabase migration up
   ```

### Method 2: Supabase Web Dashboard SQL Editor
Apply the migration files in strict numerical order via the Supabase Dashboard **SQL Editor**:
1. Run `supabase/migrations/20261012000001_create_core_schema.sql`
2. Run `supabase/migrations/20261012000002_create_functions_and_triggers.sql`
3. Run `supabase/migrations/20261012000003_create_indexes_and_views.sql`
4. Run `supabase/migrations/20261012000004_create_rls_policies.sql`

---

## 4. Known Limitations & Unresolved Assumptions

1. **Hierarchy Nesting Depth:** The hierarchy is capped at 5 levels (`depth <= 5`). If future business requirements require deeper nesting, the CHECK constraint and trigger limit can be adjusted.
2. **Progress Calculation Scope:** Progress rollups are computed from immediate direct children. If nested sub-branch weighted rollups (e.g. weighted averaging across leaf descendants) are required in future phases, a recursive CTE can replace the lateral join.
3. **Hard Deletion vs Soft Deletion:** Deletions cascade physically (`ON DELETE CASCADE`). An `is_deleted` column with an index filter can be added in a future migration if soft deletes with a trash bin feature are requested.
