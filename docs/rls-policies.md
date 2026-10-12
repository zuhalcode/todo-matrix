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

## 4. Application Limitations & Best Practices

1. **Client-Provided `user_id`:** When performing inserts from Next.js, the client must supply `user_id: user.id` (or the application can use a default trigger if desired). If omitted, the `NOT NULL` constraint will reject the insert.
2. **Bulk Operations:** Reordering multiple subtasks via `sort_order` should be executed inside a single transaction or batch update. RLS validates each updated row against `auth.uid() = user_id`.
3. **Soft vs Hard Deletes:** Deleting a project or parent task cascades physically (`ON DELETE CASCADE`). If soft deletes are required in future phases, an `is_deleted` column can be introduced with corresponding index and view adjustments.
