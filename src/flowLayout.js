
/**
 * Pure layout helpers for the ForgeFlow Production Flow.
 *
 * Layout principles:
 * 1. Sequential one-child manufacturing chains share one vertical lane.
 * 2. Genuine parallel/multi-input branches receive separate lanes.
 * 3. Sibling outputs feeding the same operation align horizontally.
 * 4. The consuming item's lane is placed to the right of its input branches.
 * 5. All coordinates are calculated from the actual manufacturing tree.
 *
 * This module does not modify BOMs, tasks, inventory or dependencies.
 */

export const FLOW_METRICS = Object.freeze({
  cardWidth: 184,
  itemHeight: 78,
  embeddedItemHeight: 104,
  operationHeight: 74,
  laneGap: 44,
  verticalGap: 34,
  padding: 24,
  laneInset: 12,
  plusRadius: 12,
  materialRowHeight: 36,
  materialHeaderHeight: 30,
});

const isRawMaterialLeaf = (node) =>
  node?.kind === 'leaf' &&
  node?.item?.itemNature === 'RAW_MATERIAL';

const numericSequence = (task) => {
  const value = Number(task?.sequence);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Calculate horizontal lane requirements.
 *
 * A simple sequential chain occupies one lane.
 * A genuine branch occupies the combined width of its
 * children plus one lane for the resulting manufactured item.
 */
export function flowLaneSpan(node, ancestors = new Set()) {
  if (!node) return 1;

  if (node.kind === 'leaf') return 1;

  if (ancestors.has(node)) return 1;

  ancestors.add(node);

  const children = (node.children || []).filter(
    (child) => !isRawMaterialLeaf(child)
  );

  const rawMaterials = (node.children || []).filter(
    isRawMaterialLeaf
  );

  if (!children.length) {
    ancestors.delete(node);
    return 1;
  }

  const childSpans = children.map((child) =>
    flowLaneSpan(child, ancestors)
  );

  const totalChildSpan = childSpans.reduce(
    (sum, span) => sum + span,
    0
  );

  const needsOwnLane =
    children.length > 1 ||
    childSpans[0] > 1 ||
    children[0]?.kind !== 'item' ||
    rawMaterials.length > 0;

  ancestors.delete(node);

  return needsOwnLane
    ? totalChildSpan + 1
    : 1;
}

/**
 * Aggregate repeated leaf-item demand across the order-line tree.
 */
export function collectFlowLeafNeeds(root) {
  const totals = new Map();

  const visit = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return;

    seen.add(node);

    if (node.kind === 'leaf') {
      const id = String(node.item?._id || '');
      const need = Math.max(0, Number(node.need) || 0);

      if (id) {
        totals.set(
          id,
          (totals.get(id) || 0) + need
        );
      }

      return;
    }

    for (const child of node.children || []) {
      visit(child, seen);
    }
  };

  visit(root);

  return totals;
}

function embeddedOperationFor(node) {
  // Embed the final producing operation for this output item.
  // This keeps each manufactured item card self-contained while
  // earlier operations remain visible as separate operation cards.
  const tasks = [...(node?.tasks || [])].sort(
    (a, b) => numericSequence(a) - numericSequence(b)
  );

  if (tasks.length === 0) return null;

  return tasks[tasks.length - 1];
}

function itemCardHeight(node) {
  return embeddedOperationFor(node)
    ? FLOW_METRICS.embeddedItemHeight
    : FLOW_METRICS.itemHeight;
}

function materialGroupHeight(materials) {
  if (materials.length <= 1) {
    return FLOW_METRICS.itemHeight;
  }

  return (
    FLOW_METRICS.materialHeaderHeight +
    materials.length * FLOW_METRICS.materialRowHeight +
    12
  );
}

/**
 * Create the complete Production Flow layout.
 *
 * Returned interface remains compatible with Flow.jsx:
 * - width
 * - height
 * - laneCount
 * - nodes
 * - lanes
 * - verticalLinks
 * - horizontalLinks
 * - joins
 */
export function createProductionFlowLayout(root) {
  const metrics = FLOW_METRICS;

  const nodes = [];
  const verticalLinks = [];
  const horizontalLinks = [];
  const joins = [];

  const laneBounds = new Map();

  if (!root) {
    return {
      width: metrics.padding * 2,
      height: metrics.padding * 2,
      laneCount: 0,
      nodes,
      lanes: [],
      verticalLinks,
      horizontalLinks,
      joins,
    };
  }

  const laneCount = flowLaneSpan(root);
  const lanePitch = metrics.cardWidth + metrics.laneGap;

  const laneX = (index) =>
    metrics.padding + index * lanePitch;

  const cardCentre = (left) =>
    left + metrics.cardWidth / 2;

  /**
   * Record the occupied vertical area of a lane.
   * Multiple sequential stages can share the same lane.
   */
  function registerLane(laneIndex, top, bottom) {
    const existing = laneBounds.get(laneIndex);

    if (!existing) {
      laneBounds.set(laneIndex, {
        top,
        bottom,
      });
      return;
    }

    existing.top = Math.min(existing.top, top);
    existing.bottom = Math.max(existing.bottom, bottom);
  }

  function addPositionedNode(node) {
    nodes.push(node);

    const laneIndex = node.laneIndex;

    registerLane(
      laneIndex,
      node.y,
      node.y + node.height
    );
  }

  /**
   * Place one manufacturing tree.
   *
   * When a node has exactly one sequential manufactured child,
   * both stages share the same lane and are stacked vertically.
   *
   * At a genuine branch, child branches occupy separate lanes
   * and their output cards align with the consuming operation.
   */
  function place(
    node,
    firstLane,
    outputTop,
    depth = 0,
    parentNode = null
  ) {
    if (!node || depth > 100) return null;

    const children = (node.children || []).filter(
      (child) => !isRawMaterialLeaf(child)
    );

    const rawMaterials = (node.children || []).filter(
      isRawMaterialLeaf
    );

    const childSpans = children.map((child) =>
      flowLaneSpan(child)
    );

    const totalChildSpan = childSpans.reduce(
      (sum, span) => sum + span,
      0
    );

    const needsOwnLane =
      children.length > 1 ||
      (children.length === 1 && (
        childSpans[0] > 1 ||
        children[0]?.kind !== 'item'
      )) ||
      (rawMaterials.length > 0 && children.length > 0);

    /*
     * Leaf nodes represent stock-covered/purchased components.
     */
    if (node.kind === 'leaf') {
      const left = laneX(firstLane);

      const leafNode = {
        id: `leaf-${nodes.length}`,
        type: 'leaf',
        node,
        parentNode,
        laneIndex: firstLane,
        x: left,
        y: outputTop,
        width: metrics.cardWidth,
        height: metrics.itemHeight,
      };

      addPositionedNode(leafNode);

      return {
        id: leafNode.id,
        laneIndex: firstLane,
        x: left,
        right: left + metrics.cardWidth,
        y: outputTop,
        centreY: outputTop + metrics.itemHeight / 2,
      };
    }

    /*
     * Determine this item's horizontal position.
     *
     * Sequential chain:
     *   child and parent share a lane.
     *
     * Parallel branches:
     *   child branches occupy the lanes on the left;
     *   resulting item occupies the lane on the right.
     */
    const ownLane = needsOwnLane
      ? firstLane + totalChildSpan
      : firstLane;

    const ownLeft = laneX(ownLane);
    const ownCentre = cardCentre(ownLeft);

    const tasks = [...(node.tasks || [])].sort(
      (a, b) => numericSequence(a) - numericSequence(b)
    );

    /*
     * Higher sequence numbers appear closer to the output.
     * Manufacturing progresses upward.
     */
    const embeddedTask = embeddedOperationFor(node);
    const displayTasks = tasks
      .filter((task) => task !== embeddedTask)
      .reverse();
    const itemHeight = itemCardHeight(node);

    const itemNode = {
      id: `item-${nodes.length}`,
      type: 'item',
      node,
      parentNode,
      laneIndex: ownLane,
      x: ownLeft,
      y: outputTop,
      width: metrics.cardWidth,
      height: itemHeight,
      embeddedTask,
    };

    addPositionedNode(itemNode);

    /*
     * Place operation cards vertically beneath the output item.
     */
    const operationNodes = displayTasks.map(
      (task, index) => {
        const operation = {
          id: `operation-${String(
            task._id || `${nodes.length}-${index}`
          )}`,
          type: 'operation',
          task,
          parentNode: node,
          laneIndex: ownLane,
          x: ownLeft,
          y:
            outputTop +
            itemHeight +
            metrics.verticalGap +
            index * (
              metrics.operationHeight +
              metrics.verticalGap
            ),
          width: metrics.cardWidth,
          height: metrics.operationHeight,
        };

        addPositionedNode(operation);

        return operation;
      }
    );

    /*
     * Connect the output item to its closest operation.
     */
    if (operationNodes.length) {
      verticalLinks.push({
        x: ownCentre,
        lowerTop: operationNodes[0].y,
        upperBottom: outputTop + itemHeight,
      });

      /*
       * Connect consecutive operations.
       */
      for (
        let index = 1;
        index < operationNodes.length;
        index += 1
      ) {
        verticalLinks.push({
          x: ownCentre,
          lowerTop: operationNodes[index].y,
          upperBottom:
            operationNodes[index - 1].y +
            operationNodes[index - 1].height,
        });
      }
    }

    /*
     * The lowest operation is the input point for the
     * item's components.
     */
    const lowestOperation = operationNodes.length
      ? operationNodes[operationNodes.length - 1]
      : null;

    const operationBottom = lowestOperation
      ? lowestOperation.y + lowestOperation.height
      : outputTop + itemHeight;

    const inputCentreY = lowestOperation
      ? lowestOperation.y + lowestOperation.height / 2
      : outputTop + itemHeight / 2;

    /*
     * For a true branch, child output cards align with the
     * consuming operation.
     *
     * For a sequential one-child chain, the child is stacked
     * below the parent's operations in the SAME lane.
     */
    const childOutputTop = needsOwnLane
      ? inputCentreY - metrics.itemHeight / 2
      : operationBottom + metrics.verticalGap;

    const childPlacements = [];

    let childLane = firstLane;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];

      const childTop = needsOwnLane
        ? inputCentreY - itemCardHeight(child) / 2
        : childOutputTop;

      const childResult = place(
        child,
        childLane,
        childTop,
        depth + 1,
        node
      );

      if (childResult) {
        childPlacements.push(childResult);
      }

      childLane += childSpans[index];
    }

    /*
     * Connect child branches to the consuming operation.
     */
    if (childPlacements.length && needsOwnLane) {
      /*
       * Multiple sibling inputs:
       * add a plus marker between each adjacent pair.
       */
      if (childPlacements.length > 1) {
        for (
          let index = 0;
          index < childPlacements.length - 1;
          index += 1
        ) {
          const current = childPlacements[index];
          const next = childPlacements[index + 1];

          const joinX = (current.right + next.x) / 2;

          horizontalLinks.push({
            x1: current.right,
            x2: joinX - metrics.plusRadius - 1,
            y: inputCentreY,
          });

          horizontalLinks.push({
            x1: joinX + metrics.plusRadius + 1,
            x2: next.x,
            y: inputCentreY,
          });

          joins.push({
            x: joinX,
            y: inputCentreY,
            radius: metrics.plusRadius,
          });
        }
      }

      /*
       * Connect the rightmost input branch to the
       * consuming operation.
       */
      const lastChild =
        childPlacements[childPlacements.length - 1];

      if (lastChild.right < ownLeft) {
        horizontalLinks.push({
          x1: lastChild.right,
          x2: ownLeft - 2,
          y: inputCentreY,
          arrow: true,
        });
      }
    }

    /*
     * For a sequential chain, connect the child output
     * vertically to the operation above it.
     */
    if (
      childPlacements.length === 1 &&
      !needsOwnLane
    ) {
      verticalLinks.push({
        x: ownCentre,
        lowerTop: childOutputTop,
        upperBottom: operationBottom,
      });
    }

    /*
     * Raw materials remain displayed as material inputs.
     */
    let laneBottom = Math.max(
      outputTop + itemHeight,
      operationBottom
    );

    if (rawMaterials.length) {
      const rawTop = laneBottom + metrics.verticalGap;
      const groupHeight = materialGroupHeight(rawMaterials);

      const materialNode = {
        id: `materials-${nodes.length}`,
        type: 'materials',
        materials: rawMaterials,
        parentNode: node,
        laneIndex: ownLane,
        x: ownLeft,
        y: rawTop,
        width: metrics.cardWidth,
        height: groupHeight,
      };

      addPositionedNode(materialNode);

      verticalLinks.push({
        x: ownCentre,
        lowerTop: rawTop,
        upperBottom: laneBottom,
      });

      laneBottom = rawTop + groupHeight;
    }

    registerLane(
      ownLane,
      outputTop,
      laneBottom
    );

    return {
      id: itemNode.id,
      laneIndex: ownLane,
      x: ownLeft,
      right: ownLeft + metrics.cardWidth,
      y: outputTop,
      centreY: outputTop + itemHeight / 2,
    };
  }

  place(root, 0, metrics.padding);

  /*
   * Convert accumulated lane bounds into lane outlines.
   */
  const lanes = [...laneBounds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([laneIndex, bounds]) => ({
      key: `lane-${laneIndex}`,
      x: laneX(laneIndex) - metrics.laneInset,
      y: bounds.top - metrics.laneInset,
      width:
        metrics.cardWidth +
        metrics.laneInset * 2,
      height:
        Math.max(
          metrics.itemHeight,
          bounds.bottom - bounds.top
        ) +
        metrics.laneInset * 2,
    }));

  const right =
    metrics.padding +
    (laneCount - 1) * lanePitch +
    metrics.cardWidth;

  const bottom = lanes.reduce(
    (max, lane) => Math.max(
      max,
      lane.y + lane.height
    ),
    metrics.padding
  );

  return {
    width: right + metrics.padding,
    height: bottom + metrics.padding,
    laneCount,
    nodes,
    lanes,
    verticalLinks,
    horizontalLinks,
    joins,
  };
}
