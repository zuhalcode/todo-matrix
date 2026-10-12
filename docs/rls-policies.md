# Row Level Security (RLS) Policy Specification

**Project:** Modern Todo List Web Application  
**Target Platform:** Next.js & Supabase PostgreSQL  
**Document Status:** Production Ready  

---

## 1. Overview & Security Architecture

Multi-user security in this application is enforced using a **defense-in-depth model** combining Supabase Row Level Security (RLS) with declarative database constraints.

```
+-------------------------------------------------------------------+
| Next.js Client / Server Component (Supabase Client with User JWT) |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|               PostgreSQL Row Level Security (RLS)                 |
|             Enforces auth.uid() = user_id on all rows             |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|              Declarative Composite Foreign Keys                   |
|   (parent_id, user_id) REFERENCES tasks(id, user_id)              |
|   (project_id, user_id) REFERENCES projects(id, user_id)          |
|   (task_id, user_id) REFERENCES tasks(id, user_id)                |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|             Hierarchy & Cycle Validation Triggers                 |
|     Enforces no circular paths, max depth <= 5, and proj sync     |
+-------------------------------------------------------------------+
```

### Key Security Guarantees
1. **Authenticated Access Only:** Policies are bound explicitly `TO authenticated`. Anonymous (`anon`) requests have zero access to data tables or views.
2. **Deny by Default:** RLS is enabled and forced (`FORCE ROW LEVEL SECURITY`) on all tables.
3. **Zero Cross-User Visibility:** A user cannot view, insert, update, or delete any record where `user_id` does not match `auth.uid()`.
4. **Relational Boundary Enforcement:** Even if an attacker learns or guesses the UUID of another user's project or task, PostgreSQL composite foreign keys physically prevent linking a task or subtask across user boundaries.

---

## 2. Policy Matrix by Table

### 2.1 Table: `projects`

| Operation | Policy Name | Role | Condition (`USING`) | Check (`WITH CHECK`) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELECT** | `projects_select_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only read own projects |
| **INSERT** | `projects_insert_own` | `authenticated` | N/A | `auth.uid() = user_id` | Can only insert projects with own `user_id` |
| **UPDATE** | `projects_update_own` | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` | Can only update own projects; cannot reassign `user_id` |
| **DELETE** | `projects_delete_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only delete own projects |

---

### 2.2 Table: `tasks`

| Operation | Policy Name | Role | Condition (`USING`) | Check (`WITH CHECK`) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELECT** | `tasks_select_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only read own tasks |
| **INSERT** | `tasks_insert_own` | `authenticated` | N/A | `auth.uid() = user_id` | Can only insert tasks with own `user_id` |
| **UPDATE** | `tasks_update_own` | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` | Can only update own tasks; cannot reassign `user_id` |
| **DELETE** | `tasks_delete_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only delete own tasks |

---

### 2.3 Table: `task_checklist_items`

| Operation | Policy Name | Role | Condition (`USING`) | Check (`WITH CHECK`) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SELECT** | `task_checklist_items_select_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only read own checklist items |
| **INSERT** | `task_checklist_items_insert_own` | `authenticated` | N/A | `auth.uid() = user_id` | Can only insert items with own `user_id` |
| **UPDATE** | `task_checklist_items_update_own` | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` | Can only update own items; cannot reassign `user_id` |
| **DELETE** | `task_checklist_items_delete_own` | `authenticated` | `auth.uid() = user_id` | N/A | Can only delete own checklist items |

---

### 2.4 View: `tasks_with_progress`

* **Security Mode:** `WITH (security_invoker = true)`
* **Behavior:** In PostgreSQL 15+, when a view is defined with `security_invoker = true`, any query through the view executes with the privileges and RLS policies of the caller rather than the view owner.
* **Guarantee:** PostgREST queries against `tasks_with_progress` automatically inherit `tasks_select_own` and `task_checklist_items_select_own`. Users can never aggregate or inspect data from another tenant.

---

## 3. Defense Against Known Threat Vectors

### Vector 1: Cross-User Project Hijacking
* **Threat:** User A attempts to create a task with `user_id = User A` but specifies `project_id = User B's project`.
* **Protection:** 
  1. Constraint `tasks_project_fkey FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id)` fails immediately because no row in `projects` matches `(User B project_id, User A user_id)`.
  2. Transaction aborts with a foreign key violation before data write.

### Vector 2: Cross-User Parent Task Hijacking
* **Threat:** User A attempts to attach their task as a subtask to User B's task by setting `parent_id = User B's task_id`.
* **Protection:** 
  1. Constraint `tasks_parent_fkey FOREIGN KEY (parent_id, user_id) REFERENCES tasks(id, user_id)` fails immediately.
  2. Trigger `validate_task_hierarchy()` performs an additional verification query bounded by `user_id = NEW.user_id` and raises a violation if no parent exists within the user's data boundary.

### Vector 3: Reparenting to Introduce Cycles
* **Threat:** User moves Task 1 under Task 3, while Task 3 is already a descendant of Task 1 ($1 \to 2 \to 3 \to 1$).
* **Protection:** Trigger `validate_task_hierarchy()` recursively traverses the ancestor chain. If the task's own ID appears in the path, it raises `Circular task hierarchy detected` (`ERRCODE: check_violation`), rolling back the mutation.

### Vector 4: Unbounded Nesting Depth Attack
* **Threat:** Malicious client attempts to create an ultra-deep nesting chain ($> 5$ levels) to degrade rendering or crash recursive queries.
* **Protection:** Trigger `validate_task_hierarchy()` validates depth against ancestor chain. If `depth > 5`, transaction raises `Maximum task nesting depth (5) exceeded` and aborts.

### Vector 5: Service Role Leakage
* **Threat:** Next.js application mistakenly uses the `SUPABASE_SERVICE_ROLE_KEY` in client-side code, completely bypassing RLS.
* **Mitigation Guidance:**
  - Client components must strictly use the standard Supabase client initialized with `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Server Actions and Route Handlers must utilize the `@supabase/ssr` server client created from request cookies, retaining the user's authenticated context.
  - The `service_role` key must never be bundled into client bundles or used for standard user CRUD operations.

---

## 4. Application Identity Enforcement & Best Practices

1. **Authoritative Supabase Auth Identity:** The application derives user identity directly from the verified Supabase Auth session (`supabase.auth.getUser()`). Client-supplied `user_id` values in request arguments or form payloads are never trusted as proof of identity.
2. **Database Defaults (`auth.uid()`):** `projects.user_id`, `tasks.user_id`, and `task_checklist_items.user_id` are configured with `DEFAULT auth.uid()`. Database triggers automatically enforce `user_id := auth.uid()` when missing and reject unauthenticated writes with `not_null_violation`.
3. **Immutability of `user_id`:** Dedicated database triggers (`prevent_user_id_mutation`) on `projects`, `tasks`, and `task_checklist_items` strictly prohibit modifying `user_id` during updates (`restrict_violation`).
4. **Relational Boundary Pre-Validation:** In addition to composite foreign keys (`tasks_project_fkey`, `tasks_parent_fkey`, `checklist_task_fkey`), the application services pre-validate that any referenced `project_id`, `parent_id`, or `task_id` belongs to the authenticated user before executing writes.
5. **Subtask Project Coherence:** The database trigger `cascade_descendant_project` automatically synchronizes `project_id` across descendant subtasks when a parent task moves to another project.
6. **Legacy Data Quarantine Strategy:** Unowned records without an identifiable Supabase Auth user are quarantined into `quarantined_unowned_records` rather than assigned to an arbitrary user, preventing data corruption and cross-tenant leakage.
