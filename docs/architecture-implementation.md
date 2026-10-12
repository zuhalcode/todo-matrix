# Architecture & Implementation Report

**Project:** Modern Todo List Web Application  
**Platform:** Next.js (App Router) + TypeScript + Tailwind CSS + Supabase + React Three Fiber  
**Status:** Implementation Complete (Ready for Dependency Installation & User Dev Server Execution)

---

## 1. System Architecture Overview

The application is structured following clean architecture principles, separating persistent database contracts, feature domains, technical infrastructure, accessible UI components, and the 3D subsystem:

```
src/
├── app/                                 # Next.js App Router composition & routes
│   ├── auth/page.tsx                   # Supabase Auth sign-in / sign-up interface
│   ├── dashboard/
│   │   ├── page.tsx                    # Protected Server Component (SSR session & initial fetch)
│   │   ├── DashboardClient.tsx         # Unified dashboard orchestration & state management
│   │   └── loading.tsx                 # Dashboard skeleton & suspense boundary
│   ├── layout.tsx                      # Root layout, fonts, dark mode tokens
│   ├── globals.css                     # Tailwind design system tokens & custom scrollbars
│   └── page.tsx                        # Feature landing page & overview
├── components/
│   ├── 3d/                             # Reusable 3D infrastructure & fallbacks
│   │   ├── SceneContainer.tsx          # Dynamic client-only Canvas wrapper with eco/2D toggle
│   │   ├── SceneFallback.tsx           # Accessible 2D Productivity Sanctum fallback
│   │   ├── ProductivityCrystal.tsx     # Central dynamic crystal with progress-driven shaders
│   │   ├── TaskNode3D.tsx              # Interactive orbiting 3D task nodes with hover/click
│   │   ├── CompletionBurst3D.tsx       # Event-driven particle celebration fountain
│   │   └── webgl-check.ts              # WebGL support & prefers-reduced-motion detector
│   └── ui/                             # Accessible reusable UI primitives
│       ├── Button.tsx                  # Polymorphic accessible button with loading states
│       ├── Input.tsx                   # Text input with validation error states
│       ├── Textarea.tsx                # Textarea with validation error states
│       ├── Badge.tsx                   # Semantic priority and workflow status badges
│       ├── ProgressBar.tsx             # ARIA-compliant progress bar
│       ├── Card.tsx                    # Compound card primitives
│       └── Modal.tsx                   # Accessible dialog with escape listener & backdrop
├── features/
│   ├── tasks/
│   │   ├── domain/
│   │   │   ├── progress.ts             # Mathematical mirror of PostgreSQL calculate_task_progress
│   │   │   ├── progress.test.ts        # Unit test suite verifying all 4 progress rules
│   │   │   ├── hierarchy.ts            # Cycle detection, depth limit (<=5), and tree construction
│   │   │   └── hierarchy.test.ts       # Unit test suite verifying cycle guards and tree nesting
│   │   └── components/
│   │       ├── TaskTree.tsx            # Recursive hierarchical tree rendering up to depth 5
│   │       ├── TaskCard.tsx            # Rich task card with subtasks, checklists, and reordering
│   │       ├── TaskDialog.tsx          # Modal for creating root tasks, subtasks, or editing
│   │       ├── TaskFilters.tsx         # Search bar, priority dropdown, and status pill filters
│   │       └── ChecklistSection.tsx    # Inline checklist step management
│   ├── projects/
│   │   └── components/
│   │       ├── ProjectSidebar.tsx      # Sidebar with Inbox, All Tasks, and colored projects
│   │       └── ProjectDialog.tsx       # Modal with hex color palette for project creation/editing
│   └── gamification/
│       ├── domain/
│       │   ├── progression.ts          # Deterministic XP, level, and achievement derivations
│       │   └── progression.test.ts     # Unit tests verifying deterministic progression
│       └── components/
│           └── GamificationBar.tsx     # Motivating banner with level, XP progress, and badges modal
├── scenes/
│   └── ProductivityGroveScene.tsx      # React Three Fiber scene composition & OrbitControls
├── services/
│   ├── tasks.service.ts                # Database access to tasks & tasks_with_progress view
│   ├── projects.service.ts             # Database access to projects table
│   └── checklists.service.ts           # Database access to task_checklist_items table
├── types/
│   ├── database.ts                     # Canonical TypeScript interfaces matching docs/data-contract.md
│   └── todo.ts                         # Zod validation schemas and gamification domain models
├── lib/
│   ├── utils.ts                        # Styling (cn) and date formatting helpers
│   └── supabase/
│       ├── client.ts                   # Browser Supabase client (@supabase/ssr)
│       ├── server.ts                   # Server Supabase client with cookie storage (@supabase/ssr)
│       └── middleware.ts               # Session token refresher and route protector
└── middleware.ts                       # Next.js middleware protecting /dashboard route
```

---

## 2. Supabase Database Contract, User Ownership & RLS Compliance

1. **User Ownership & Identity Source:**
   * Supabase Auth (`auth.users`) is the authoritative single source of identity.
   * `projects`, `tasks`, and `task_checklist_items` enforce `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
   * Column defaults set to `auth.uid()`, backed by auto-assignment and immutability triggers (`trg_*_prevent_user_id_change`).
   * Subtask project inheritance is preserved via `cascade_descendant_project` trigger.
   * Unresolved legacy records are preserved in `quarantined_unowned_records` rather than arbitrarily assigned to any user.
2. **Authoritative Progress Derivation:**
   * Reads from the `tasks_with_progress` view (`security_invoker = true`), which calculates:
     * Branch Tasks: $\text{ROUND}((N_{\text{completed}} / N_{\text{active}}) \times 100, 2)$ (ignoring canceled tasks).
     * Leaf Tasks with Checklists: $\text{ROUND}((N_{\text{completed\_chk}} / N_{\text{total\_chk}}) \times 100, 2)$.
     * Simple Leaf Tasks: $100\%$ if completed, $50\%$ if in_progress, $0\%$ otherwise.
   * Pure client-side mirror in `src/features/tasks/domain/progress.ts` allows instantaneous optimistic UI rendering without desynchronization.
3. **Hierarchy & Cycle Enforcement:**
   * Database triggers enforce non-circularity, project scope inheritance, and max nesting depth $\le 5$.
   * Client-side validation in `src/features/tasks/domain/hierarchy.ts` validates moves before submitting to prevent unnecessary error roundtrips.
4. **Security & Secrets:**
   * No secrets, private keys, or `.env` files are inspected or committed.
   * Standard public keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are documented via `.env.example`.

---

## 3. 3D React Three Fiber Integration & Performance

1. **Next.js Rendering Boundaries:**
   * Server Components fetch initial session and data.
   * Dynamic loading via `next/dynamic` with `{ ssr: false }` isolates WebGL dependencies to Client Components, completely preventing server rendering crashes and hydration mismatches.
2. **Eco Mode & Fallbacks:**
   * `src/components/3d/webgl-check.ts` detects WebGL availability and honors `prefers-reduced-motion`.
   * When WebGL is unavailable or when the user toggles "2D Eco Mode", `SceneFallback.tsx` renders a lightweight 2D radial completion aura with quick-focus buttons.
3. **Meaningful 3D Interactions:**
   * **Productivity Crystal:** Central multifaceted 3D crystal rotates smoothly; scale, emission intensity, and color evolve dynamically with user level and project completion percentage.
   * **Task Focus Nodes:** Floating 3D dodecahedrons represent active tasks with priority-coded colors. Hovering raises an HTML label and pointer cursor; clicking focuses the task directly in the list.
   * **Celebration Fireworks:** Completing any task or subtask triggers an event-driven 3D particle burst (`CompletionBurst3D.tsx`) with randomized velocity and gravity physics.
4. **Essential Control Accessibility:**
   * Every critical action (create, edit, reorder, complete, delete) is available via standard, accessible HTML controls. No workflow depends strictly on WebGL interaction.

---

## 4. Gamification Domain & Persistence Boundaries

1. **Deterministic Derivation:**
   * XP is calculated from completed tasks:
     * Base: 50 XP
     * Low: $1.0\times$ (50 XP), Medium: $1.2\times$ (60 XP), High: $1.6\times$ (80 XP), Urgent: $2.0\times$ (100 XP)
     * Checklist items: 10 XP
   * Level is derived as $\lfloor \text{Total XP} / 200 \rfloor + 1$.
2. **Zero Unauthorized Persistence:**
   * Because the database contract does not contain gamification tables, XP, levels, and achievements are derived dynamically from authentic task completion records.
   * No silent `localStorage` hack is used to fake database persistence.

---

## 5. Verification Checklist & Test Suites

Four comprehensive unit test suites are established:
1. `src/features/tasks/domain/progress.test.ts`: Verifies all 4 progress resolution rules from the approved database specification.
2. `src/features/tasks/domain/hierarchy.test.ts`: Verifies direct self-parenting rejection, multi-hop cycle detection ($T_1 \to T_2 \to T_3 \to T_1$), and max depth limit ($>5$).
3. `src/features/gamification/domain/progression.test.ts`: Verifies priority XP multipliers, level calculation, and achievement unlocking.
4. `src/services/__tests__/ownership.test.ts`: Verifies Supabase Auth identity enforcement, rejection of forged client user IDs, pre-validation of relational ownership boundaries (`project_id`, `parent_id`, `task_id`), and user-scoped mutations.
