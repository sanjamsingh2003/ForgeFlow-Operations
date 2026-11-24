
 // Pure helpers. Everything here only reads real backend fields; no planning logic is duplicated.
export const oid = (v) => (v && typeof v === 'object' ? String(v._id) : v ? String(v) : '');

export const NATURE = {
  RAW_MATERIAL: 'Raw material',
  PROCESSED_ITEM: 'Processed item',
  COMPONENT: 'Component',
  SUB_ASSEMBLY: 'Sub-assembly',
  FINISHED_PRODUCT: 'Finished product',
};

// Out of stock = 0. Low stock = above 0 and at or below minimumStock.
export function stockCondition(item) {
  const s = Number(item.currentStock) || 0;
  const m = Number(item.minimumStock) || 0;
  if (s === 0) return { key: 'out', label: 'Out of stock', tone: 'bad' };
  if (s <= m) return { key: 'low', label: 'Low stock', tone: 'wait' };
  return { key: 'ok', label: 'In stock', tone: 'ok' };
}

// Format a date safely, without displaying "Invalid Date".
export const fmtDate = (d) => {
  if (d == null || d === '') return 'Date unavailable';

  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Format a date and time safely.
export const fmtDateTime = (d) => {
  if (d == null || d === '') return 'Date unavailable';

  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Uses the order's own alertBeforeDays (2, 5 or 7).
// Invalid or missing dates are reported as unknown, not overdue.
export function dueState(order) {
  const dueDate = order?.dueDate;

  if (dueDate == null || dueDate === '') {
    return {
      key: 'unknown',
      tone: 'idle',
      days: null,
      label: 'Date unavailable',
    };
  }

  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) {
    return {
      key: 'unknown',
      tone: 'idle',
      days: null,
      label: 'Date unavailable',
    };
  }

  due.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Math.round((due - today) / 86400000);
  const win = order.alertBeforeDays || 2;

  if (days < 0) {
    return {
      key: 'overdue',
      tone: 'bad',
      days,
      label: `Overdue by ${-days} day${-days > 1 ? 's' : ''}`,
    };
  }

  if (days <= win) {
    return {
      key: 'soon',
      tone: 'wait',
      days,
      label:
        days === 0
          ? 'Due today'
          : `Due in ${days} day${days > 1 ? 's' : ''}`,
    };
  }

  return {
    key: 'ok',
    tone: 'idle',
    days,
    label: `Due in ${days} days`,
  };
}

export function indexTasks(tasks) {
  const taskById = new Map();
  const tasksByOrder = new Map();

  for (const t of tasks) {
    taskById.set(String(t._id), t);

    const k = oid(t.orderId);

    if (!tasksByOrder.has(k)) {
      tasksByOrder.set(k, []);
    }

    tasksByOrder.get(k).push(t);
  }

  return { taskById, tasksByOrder };
}

// BLOCKED with unfinished dependency tasks = waiting on them.
// BLOCKED with none = material shortage.
export function blockReason(task, taskById) {
  const deps = (task.dependsOnTaskIds || [])
    .map((i) => taskById.get(String(i)))
    .filter(Boolean);

  const unmet = deps.filter((d) => d.status !== 'COMPLETED');

  if (unmet.length) {
    return {
      kind: 'dep',
      text:
        'Waiting on ' +
        unmet
          .map((d) => `${d.operationName} (${d.item?.name || 'item'})`)
          .join(', '),
    };
  }

  return { kind: 'mat', text: 'Material shortage' };
}

export const isMatBlocked = (t, taskById) =>
  t.status === 'BLOCKED' &&
  blockReason(t, taskById).kind === 'mat';

// Components of the task's item whose current stock is below what this task needs.
export function shortComponents(task, itemsById) {
  const item = itemsById.get(oid(task.item));

  return (item?.bom || [])
    .map((b) => {
      const c = itemsById.get(oid(b.component));
      const need = task.quantityRequired * b.quantityPerUnit;
      const stock = Number(c?.currentStock) || 0;

      return c && stock < need
        ? { name: c.name, need, stock }
        : null;
    })
    .filter(Boolean);
}

export const taskProgress = (list) => ({
  done: list.filter((t) => t.status === 'COMPLETED').length,
  total: list.length,
});

// Progress is based on planned workload:
// quantityRequired × estimatedTimePerUnit.
export function workloadProgress(list) {
  const workload = (task) =>
    Math.max(0, Number(task.quantityRequired) || 0) *
    Math.max(0, Number(task.estimatedTimePerUnit) || 0);

  const totalWork = list.reduce(
    (sum, task) => sum + workload(task),
    0
  );

  const completedWork = list.reduce(
    (sum, task) =>
      sum +
      (task.status === 'COMPLETED' ? workload(task) : 0),
    0
  );

  if (totalWork === 0) {
    return {
      percentage: null,
      completedWork: 0,
      totalWork: 0,
      completedTasks: list.filter(
        (t) => t.status === 'COMPLETED'
      ).length,
      totalTasks: list.length,
    };
  }

  return {
    percentage: Math.round((completedWork / totalWork) * 100),
    completedWork,
    totalWork,
    completedTasks: list.filter(
      (t) => t.status === 'COMPLETED'
    ).length,
    totalTasks: list.length,
  };
}

// Builds the production tree for one order line from REAL tasks
// and their dependsOnTaskIds edges.
export function buildFlow(order, lineIdx, tasks, itemsById) {
  const line = order.orderedItems[lineIdx];
  const rootId = oid(line.item);

  const list = tasks.filter(
    (t) => oid(t.orderId) === String(order._id)
  );

  const byId = new Map(list.map((t) => [String(t._id), t]));
  const dependedOn = new Set();

  list.forEach((t) =>
    (t.dependsOnTaskIds || []).forEach((d) =>
      dependedOn.add(String(d))
    )
  );

  const sameBefore = order.orderedItems
    .slice(0, lineIdx)
    .filter((l) => oid(l.item) === rootId).length;

  const tops = list
    .filter(
      (t) =>
        oid(t.item) === rootId &&
        !dependedOn.has(String(t._id))
    )
    .sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

  const ordered = line.quantity;
  const reserved = line.reservedQuantity || 0;
  const rootItem = itemsById.get(rootId) || line.item;
  const top = tops[sameBefore] || null;

  const seen = new Set();

  const itemNode = (last) => {
    const chain = [last];
    let cur = last;

    for (let g = 0; g < 60; g++) {
      const prev = (cur.dependsOnTaskIds || [])
        .map((i) => byId.get(String(i)))
        .find(
          (d) => d && oid(d.item) === oid(cur.item)
        );

      if (!prev || chain.includes(prev)) break;

      chain.unshift(prev);
      cur = prev;
    }

    const first = chain[0];
    const item = itemsById.get(oid(last.item)) || last.item;

    const kidTasks = (first.dependsOnTaskIds || [])
      .map((i) => byId.get(String(i)))
      .filter(
        (d) => d && oid(d.item) !== oid(first.item)
      );

    const children = [];
    const covered = new Set();

    for (const kt of kidTasks) {
      if (seen.has(String(kt._id))) continue;

      seen.add(String(kt._id));
      covered.add(oid(kt.item));
      children.push(itemNode(kt));
    }

    for (const b of item.bom || []) {
      const cid = oid(b.component);

      if (covered.has(cid)) continue;

      const ci = itemsById.get(cid);

      if (ci) {
        children.push({
          kind: 'leaf',
          item: ci,
          need: first.quantityRequired * b.quantityPerUnit,
        });
      }
    }

    return {
      kind: 'item',
      item,
      tasks: chain,
      children,
      make: first.quantityRequired,
    };
  };

  // A finished product may be an assembly with a BOM but no operations of
  // its own. In that case, the production flow starts at its BOM components.
  // Find the final task for each direct component and build that component's
  // real dependency tree instead of incorrectly rendering the finished
  // product as a stock-covered leaf.
  if (!top) {
    const children = [];

    for (const b of rootItem.bom || []) {
      const componentId = oid(b.component);
      const component = itemsById.get(componentId) || b.component;

      const componentTops = list
        .filter(
          (t) =>
            oid(t.item) === componentId &&
            !dependedOn.has(String(t._id))
        )
        .sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

      const componentTop = componentTops[0] || null;

      if (componentTop) {
        seen.add(String(componentTop._id));
        children.push(itemNode(componentTop));
      } else {
        children.push({
          kind: 'leaf',
          item: component,
          need: ordered * Number(b.quantityPerUnit || 0),
        });
      }
    }

    // No operations on the root does not mean the order is stock-covered.
    // Keep it as an assembly node so the UI can display its component flow.
    if (children.length > 0) {
      return {
        ordered,
        reserved,
        root: {
          kind: 'item',
          item: rootItem,
          tasks: [],
          children,
          make: ordered,
        },
      };
    }

    // A true terminal item (no BOM and no generated tasks) is a leaf.
    return {
      ordered,
      reserved,
      root: {
        kind: 'leaf',
        item: rootItem,
        need: ordered,
        covered: true,
      },
    };
  }

  return {
    ordered,
    reserved,
    root: itemNode(top),
  };
}

export function nodeState(n, taskById) {
  if (n.kind === 'leaf') {
    if (n.covered) {
      return { tone: 'ok', label: 'Covered by stock' };
    }

    const s = Number(n.item.currentStock) || 0;

    if (s >= n.need) {
      return {
        tone: 'ok',
        label:
          n.item.itemNature === 'RAW_MATERIAL'
            ? 'In stock'
            : 'Covered by stock',
      };
    }

    return {
      tone: 'bad',
      label: `Short by ${n.need - s}`,
    };
  }

  // Assembly wrapper nodes can have no operations of their own; their
  // state is therefore derived from the component nodes underneath them.
  if (!n.tasks || n.tasks.length === 0) {
    const childStates = (n.children || []).map((child) =>
      nodeState(child, taskById)
    );

    if (childStates.some((state) => state.tone === 'bad')) {
      return { tone: 'bad', label: 'Material short' };
    }

    if (childStates.some((state) => state.tone === 'wait' || state.tone === 'idle')) {
      return { tone: 'wait', label: 'Pending' };
    }

    if (childStates.length > 0 && childStates.every((state) => state.tone === 'ok')) {
      return { tone: 'ok', label: 'Completed' };
    }

    return { tone: 'idle', label: 'Waiting' };
  }

  if (n.tasks.some((t) => isMatBlocked(t, taskById))) {
    return { tone: 'bad', label: 'Material short' };
  }

  if (
    n.tasks.some(
      (t) =>
        t.status === 'PENDING' ||
        t.status === 'IN_PROGRESS'
    )
  ) {
    return { tone: 'wait', label: 'Pending' };
  }

  if (n.tasks.every((t) => t.status === 'COMPLETED')) {
    return { tone: 'ok', label: 'Completed' };
  }

  return { tone: 'idle', label: 'Waiting' };
}

export const flowTasks = (n) =>
  n.kind === 'leaf'
    ? []
    : [...n.tasks, ...n.children.flatMap(flowTasks)];

// BOM cycle guard for the item form.
export function wouldCycle(selfId, componentIds, itemsById) {
  const seen = new Set();
  const stack = [...componentIds];

  while (stack.length) {
    const id = stack.pop();

    if (selfId && id === selfId) return true;
    if (seen.has(id)) continue;

    seen.add(id);

    (itemsById.get(id)?.bom || []).forEach(
      (b) => stack.push(oid(b.component))
    );
  }

  return false;
}
