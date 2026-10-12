import type { TaskTreeNode, TaskWithProgress } from '@/types/database';

export const MAX_NESTING_DEPTH = 5;

export interface HierarchyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates whether setting `newParentId` for `targetTaskId` would violate
 * self-parenting, create a circular reference, or exceed maximum depth.
 */
export function validateHierarchyTransition(
  targetTaskId: string,
  newParentId: string | null,
  allTasks: { id: string; parent_id: string | null; depth?: number }[]
): HierarchyValidationResult {
  if (newParentId === null) {
    return { valid: true };
  }

  // Guard against direct self-parenting
  if (targetTaskId === newParentId) {
    return {
      valid: false,
      error: 'Cannot set a task as its own parent.',
    };
  }

  // Detect circular dependency by traversing up from newParentId
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  let currentParentId: string | null = newParentId;
  const visited = new Set<string>([targetTaskId]);

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return {
        valid: false,
        error: 'Circular task hierarchy detected. Cannot move task inside itself or one of its descendants.',
      };
    }
    visited.add(currentParentId);

    const parentNode = taskMap.get(currentParentId);
    if (!parentNode) {
      break;
    }
    currentParentId = parentNode.parent_id;
  }

  // Calculate new depth
  const parent = taskMap.get(newParentId);
  const parentDepth = parent?.depth ?? 0;
  if (parentDepth + 1 > MAX_NESTING_DEPTH) {
    return {
      valid: false,
      error: `Maximum task nesting depth (${MAX_NESTING_DEPTH}) exceeded.`,
    };
  }

  return { valid: true };
}

/**
 * Constructs a hierarchical tree from a flat list of tasks.
 */
export function buildTaskTree(flatTasks: TaskWithProgress[]): TaskTreeNode[] {
  const nodeMap = new Map<string, TaskTreeNode>();
  const roots: TaskTreeNode[] = [];

  // Initialize nodes
  flatTasks.forEach((task) => {
    nodeMap.set(task.id, { ...task, children: [] });
  });

  // Attach children to parents
  flatTasks.forEach((task) => {
    const node = nodeMap.get(task.id);
    if (!node) return;

    if (task.parent_id && nodeMap.has(task.parent_id)) {
      const parent = nodeMap.get(task.parent_id)!;
      parent.children = parent.children ?? [];
      parent.children.push(node);
      // Sort children by sort_order
      parent.children.sort((a, b) => a.sort_order - b.sort_order);
    } else {
      roots.push(node);
    }
  });

  // Sort root tasks by sort_order
  roots.sort((a, b) => a.sort_order - b.sort_order);
  return roots;
}
