
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCore } from '../hooks.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '../ui.jsx';

import {
  NATURE,
  blockReason,
  buildFlow,
  dueState,
  fmtDate,
  nodeState,
  oid,
  shortComponents,
} from '../lib.js';

import {
  collectFlowLeafNeeds,
  createProductionFlowLayout,
} from '../flowLayout.js';

import './Flow.css';

const numberLabel = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—';
};

function leafState(node, totalNeed) {
  const stock = Math.max(
    0,
    Number(node.item?.currentStock) || 0
  );

  const need = Math.max(
    0,
    Number(totalNeed ?? node.need) || 0
  );

  if (stock >= need) {
    return {
      tone: 'ok',
      label:
        node.item?.itemNature === 'RAW_MATERIAL'
          ? 'In stock'
          : 'Covered',
      metric: `In stock ${numberLabel(stock)}`,
    };
  }

  const shortage = Math.max(0, need - stock);

  return {
    tone: 'bad',
    label: stock === 0 ? 'Out of stock' : 'Material short',
    metric:
      stock === 0
        ? `Out of stock · Need ${numberLabel(need)}`
        : `Short ${numberLabel(shortage)} · In stock ${numberLabel(stock)}`,
  };
}

function itemMetric(node) {
  const tasks = [...(node.tasks || [])].sort(
    (a, b) =>
      (Number(a.sequence) || 0) -
      (Number(b.sequence) || 0)
  );

  const lastTask = tasks[tasks.length - 1];

  const completed =
    tasks.length > 0 &&
    tasks.every((task) => task.status === 'COMPLETED');

  if (
    completed &&
    lastTask &&
    lastTask.producedQuantity !== undefined
  ) {
    return `Made ${numberLabel(lastTask.producedQuantity)}`;
  }

  return `To make ${numberLabel(node.make)}`;
}

function machineMeta(task) {
  const machine =
    task.machineName && task.machineName !== 'UNASSIGNED'
      ? task.machineName
      : task.machineId && task.machineId !== 'UNASSIGNED'
        ? task.machineId
        : '';

  const queue =
    task.queuePosition != null
      ? `Queue ${task.queuePosition}`
      : '';

  return [machine, queue].filter(Boolean).join(' · ');
}

function operationState(task, taskById, itemsById) {
  if (task.status === 'COMPLETED') {
    const produced =
      task.producedQuantity == null
        ? null
        : `Produced ${numberLabel(task.producedQuantity)}`;

    const defective =
      task.defectiveQuantity == null
        ? null
        : `Defective ${numberLabel(task.defectiveQuantity)}`;

    return {
      tone: 'ok',
      label: 'Done',
      meta:
        [produced, defective].filter(Boolean).join(' · ') ||
        'Operation completed',
    };
  }

  if (task.status === 'BLOCKED') {
    const reason = blockReason(task, taskById);

    if (reason.kind === 'dep') {
      return {
        tone: 'idle',
        label: 'Waiting',
        meta: reason.text,
      };
    }

    const shortages = shortComponents(task, itemsById);

    return {
      tone: 'bad',
      label: 'Material short',
      meta: shortages.length
        ? `Material shortage: ${shortages.map((item) => item.name).join(', ')}`
        : 'Material shortage · exact material not available from current task data',
    };
  }

  if (task.status === 'IN_PROGRESS') {
    return {
      tone: 'wait',
      label: 'In progress',
      meta: machineMeta(task) || 'Operation started',
    };
  }

  return {
    tone: 'wait',
    label: 'Pending',
    meta: machineMeta(task) || 'Awaiting machine assignment',
  };
}

/* ==========================================
   INTERACTIVE ITEM CARD
========================================== */

function OutputCard({
  node,
  state,
  metric,
  onSelect,
  embeddedTask,
  taskById,
  itemsById,
}) {
  const item = node.item || {};
  const embeddedState = embeddedTask
    ? operationState(embeddedTask, taskById || new Map(), itemsById || new Map())
    : null;
  const embeddedMachine = embeddedTask ? machineMeta(embeddedTask) : '';

  return (
    <div
      className={`pf-card pf-output-card t-${state.tone}`}
      title={`View details for ${item.name || 'item'}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${item.name || 'item'}`}
      onClick={() =>
        onSelect?.({ kind: 'item', data: item })
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.({ kind: 'item', data: item });
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="pf-output-heading">
        <strong className="pf-item-name">
          {item.name || 'Unnamed item'}
        </strong>
      </div>

      <div className="pf-output-footer">
        <strong className={`pf-metric pf-state-${state.tone}`}>
          {metric}
        </strong>
      </div>

      {embeddedTask && (
        <div
          className="pf-embedded-operation"
          role="button"
          tabIndex={0}
          title={`View details for ${embeddedTask.operationName || 'operation'}`}
          aria-label={`View details for ${embeddedTask.operationName || 'operation'}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.({ kind: 'task', data: embeddedTask });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onSelect?.({ kind: 'task', data: embeddedTask });
            }
          }}
        >
          <strong>
            {embeddedTask.operationName || 'Operation'}
            {embeddedMachine ? ` (${embeddedMachine.split(' · ')[0]})` : ''}
          </strong>
          <span className={`pf-state-${embeddedState.tone}`}>
            {embeddedState.label}
            {embeddedMachine.includes(' · ')
              ? ` · ${embeddedMachine.split(' · ').slice(1).join(' · ')}`
              : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   INTERACTIVE OPERATION CARD
========================================== */

function OperationCard({
  task,
  taskById,
  itemsById,
  onSelect,
}) {
  const state = operationState(task, taskById, itemsById);

  return (
    <div
      className={`pf-card pf-operation-card t-${state.tone}`}
      title={`View details for ${task.operationName || 'operation'}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${task.operationName || 'operation'}`}
      onClick={() =>
        onSelect?.({ kind: 'task', data: task })
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.({ kind: 'task', data: task });
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      <strong className="pf-operation-name">
        {task.operationName || 'Operation'}
      </strong>

      <span className={`pf-operation-state pf-state-${state.tone}`}>
        {state.label}
      </span>

      {state.meta && (
        <div className="pf-operation-meta">
          {state.meta}
        </div>
      )}
    </div>
  );
}

function parentMaterialBlock(parentNode, taskById) {
  const firstTask = [...(parentNode?.tasks || [])].sort(
    (a, b) =>
      (Number(a.sequence) || 0) -
      (Number(b.sequence) || 0)
  )[0];

  return Boolean(
    firstTask?.status === 'BLOCKED' &&
    blockReason(firstTask, taskById).kind === 'mat'
  );
}

function inputState(node, totalNeed, parentNode, taskById) {
  if (parentMaterialBlock(parentNode, taskById)) {
    return leafState(node, totalNeed);
  }

  const stock = Math.max(
    0,
    Number(node.item?.currentStock) || 0
  );

  return {
    tone: stock > 0 ? 'ok' : 'idle',
    label: stock > 0 ? 'In stock' : 'On hand 0',
    metric: stock > 0
      ? `In stock ${numberLabel(stock)}`
      : 'On hand 0',
  };
}

/* ==========================================
   INTERACTIVE MATERIAL CARD
========================================== */

function MaterialCard({
  node,
  leafNeeds,
  taskById,
  onSelect,
}) {
  const materials = node.materials || [];

  const rows = materials.map((material) => {
    const id = oid(material.item);
    const totalNeed = leafNeeds.get(id) ?? material.need;

    return {
      node: material,
      state: inputState(
        material,
        totalNeed,
        node.parentNode,
        taskById
      ),
      totalNeed,
    };
  });

  const hasShortage = rows.some(
    (row) => row.state.tone === 'bad'
  );

  const tone = hasShortage
    ? 'bad'
    : rows.every((row) => row.state.tone === 'ok')
      ? 'ok'
      : 'idle';

  return (
    <div className={`pf-card pf-material-card t-${tone}`}>
      {rows.length > 1 && (
        <div className="pf-material-heading">
          Raw material inputs
        </div>
      )}

      <div
        className={`pf-material-rows ${
          rows.length === 1 ? 'is-single' : ''
        }`}
      >
        {rows.map(({ node: material, state, totalNeed }, index) => (
          <div
            className="pf-material-row"
            key={`${oid(material.item)}-${index}`}
            role="button"
            tabIndex={0}
            aria-label={`View details for ${material.item?.name || 'material'}`}
            onClick={() =>
              onSelect?.({
                kind: 'item',
                data: material.item || {},
              })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.({
                  kind: 'item',
                  data: material.item || {},
                });
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="pf-material-copy">
              <strong title={material.item?.name}>
                {material.item?.name || 'Unnamed material'}
              </strong>

              {rows.length > 1 && (
                <small>
                  {NATURE[material.item?.itemNature] || 'Input material'}
                </small>
              )}
            </div>

            <div className={`pf-material-stock pf-state-${state.tone}`}>
              <span>{state.metric}</span>

              {rows.length > 1 && (
                <small>
                  Total required: {numberLabel(totalNeed)}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================
   LEAF CARD
========================================== */

function LeafCard({
  node,
  leafNeeds,
  taskById,
  parentNode,
  onSelect,
}) {
  const totalNeed = leafNeeds.get(oid(node.item)) ?? node.need;

  const state = inputState(
    node,
    totalNeed,
    parentNode,
    taskById
  );

  return (
    <OutputCard
      node={node}
      state={state}
      metric={state.metric}
      onSelect={onSelect}
    />
  );
}

/* ==========================================
   DETAILS MODAL
========================================== */

function DetailModal({ selection, onClose }) {
  if (!selection) return null;

  const isTask = selection.kind === 'task';
  const data = selection.data || {};

  const details = isTask
    ? [
        ['Operation', data.operationName],
        ['Status', data.status],
        ['Quantity', data.quantity ?? data.requiredQuantity ?? data.qty],
        ['Sequence', data.sequence],
        ['Machine', data.machineName || data.machineId],
        ['Queue position', data.queuePosition],
        ['Produced quantity', data.producedQuantity],
        ['Defective quantity', data.defectiveQuantity],
        ['Task ID', data._id],
      ]
    : [
        ['Item name', data.name],
        ['Nature', NATURE[data.itemNature] || data.itemNature],
        ['Category', data.category],
        ['SKU', data.sku],
        ['Unit', data.unit],
        ['Current stock', data.currentStock],
        ['Minimum stock', data.minimumStock],
        ['Item ID', data._id],
      ];

  const visibleDetails = details.filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== ''
  );

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.68)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-detail-title"
        style={{
          width: 'min(520px, 100%)',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--panel, #151d22)',
          color: 'var(--text, #f4f7f8)',
          border: '1px solid var(--border, #34414a)',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,.45)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <h2
            id="pf-detail-title"
            style={{ margin: 0, fontSize: 18 }}
          >
            {isTask ? 'Operation details' : 'Item details'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            style={{
              border: '1px solid var(--border, #34414a)',
              borderRadius: 8,
              background: 'transparent',
              color: 'inherit',
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <h3 style={{ margin: '18px 0 12px', fontSize: 16 }}>
          {isTask
            ? data.operationName || 'Operation'
            : data.name || 'Unnamed item'}
        </h3>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 1fr) 2fr',
            gap: '10px 16px',
            margin: 0,
          }}
        >
          {visibleDetails.map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--muted, #9aa8b1)' }}>
                {label}
              </dt>

              <dd
                style={{
                  margin: 0,
                  overflowWrap: 'anywhere',
                }}
              >
                {typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>

        {isTask && (
          <p
            style={{
              margin: '16px 0 0',
              color: 'var(--muted, #9aa8b1)',
              fontSize: 13,
            }}
          >
            This panel is read-only. Completing or changing a task
            is not performed here.
          </p>
        )}
      </section>
    </div>
  );
}

/* ==========================================
   PRODUCTION FLOW CANVAS
========================================== */

function FlowCanvas({ root, taskById, itemsById }) {
  const [selection, setSelection] = useState(null);

  const layout = useMemo(
    () => createProductionFlowLayout(root),
    [root]
  );

  const leafNeeds = useMemo(
    () => collectFlowLeafNeeds(root),
    [root]
  );

  return (
    <section
      className="pf-shell"
      aria-label="Manufacturing production flow"
    >
      <div className="pf-scroll-hint">
        <span>Manufacturing structure</span>
        <span>
          Scroll horizontally to view every lane when required
        </span>
      </div>

      <div className="pf-scroll">
        <div
          className="pf-stage"
          style={{
            width: layout.width,
            height: layout.height,
          }}
        >
          {layout.lanes.map((lane) => (
            <div
              className="pf-lane-outline"
              key={lane.key}
              style={{
                left: lane.x,
                top: lane.y,
                width: lane.width,
                height: lane.height,
              }}
            />
          ))}

          <svg
            className="pf-connectors"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="pf-arrow-up"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path
                  d="M0 0 L8 4 L0 8"
                  fill="none"
                  stroke="#84919a"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>

              <marker
                id="pf-arrow-right"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path
                  d="M0 0 L8 4 L0 8"
                  fill="none"
                  stroke="#84919a"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>

            {layout.verticalLinks.map((link, index) => (
              <line
                key={`vertical-${index}`}
                className="pf-link"
                x1={link.x}
                y1={link.lowerTop - 2}
                x2={link.x}
                y2={link.upperBottom + 3}
                markerEnd="url(#pf-arrow-up)"
              />
            ))}

            {layout.horizontalLinks.map((link, index) => (
              <line
                key={`horizontal-${index}`}
                className="pf-link"
                x1={link.x1}
                y1={link.y}
                x2={link.x2}
                y2={link.y}
                markerEnd={
                  link.arrow
                    ? 'url(#pf-arrow-right)'
                    : undefined
                }
              />
            ))}

            {layout.joins.map((join, index) => (
              <g
                key={`join-${index}`}
                className="pf-join"
              >
                <circle
                  cx={join.x}
                  cy={join.y}
                  r={join.radius}
                />

                <text
                  x={join.x}
                  y={join.y + 1}
                >
                  +
                </text>
              </g>
            ))}
          </svg>

          {layout.nodes.map((node) => {
            const style = {
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
            };

            if (node.type === 'operation') {
              return (
                <div
                  className="pf-positioned-node"
                  key={node.id}
                  style={style}
                >
                  <OperationCard
                    task={node.task}
                    taskById={taskById}
                    itemsById={itemsById}
                    onSelect={setSelection}
                  />
                </div>
              );
            }

            if (node.type === 'materials') {
              return (
                <div
                  className="pf-positioned-node"
                  key={node.id}
                  style={style}
                >
                  <MaterialCard
                    node={node}
                    leafNeeds={leafNeeds}
                    taskById={taskById}
                    onSelect={setSelection}
                  />
                </div>
              );
            }

            if (node.type === 'leaf') {
              return (
                <div
                  className="pf-positioned-node"
                  key={node.id}
                  style={style}
                >
                  <LeafCard
                    node={node.node}
                    leafNeeds={leafNeeds}
                    taskById={taskById}
                    parentNode={node.parentNode}
                    onSelect={setSelection}
                  />
                </div>
              );
            }

            const state = nodeState(node.node, taskById);

            return (
              <div
                className="pf-positioned-node"
                key={node.id}
                style={style}
              >
                <OutputCard
                  node={node.node}
                  state={state}
                  metric={itemMetric(node.node)}
                  onSelect={setSelection}
                  embeddedTask={node.embeddedTask}
                  taskById={taskById}
                  itemsById={itemsById}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected item or operation details */}
      <DetailModal
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </section>
  );
}

/* ==========================================
   NO PRODUCTION FLOW
========================================== */

function NoProductionFlow({ item, orderLine, fullyCovered }) {
  const reserved = Math.max(
    0,
    Number(orderLine.reservedQuantity) || 0
  );

  const quantity = Math.max(
    0,
    Number(orderLine.quantity) || 0
  );

  const short = Math.max(0, quantity - reserved);

  const state = fullyCovered
    ? { tone: 'ok', label: 'Covered by stock' }
    : { tone: 'bad', label: 'Procurement / planning required' };

  return (
    <div className="pf-no-flow-wrap">
      <div className="pf-no-flow-card">
        <OutputCard
          node={{ item }}
          state={state}
          metric={
            fullyCovered
              ? `Reserved from stock ${numberLabel(reserved)} of ${numberLabel(quantity)}`
              : `Reserved ${numberLabel(reserved)} · Uncovered ${numberLabel(short)}`
          }
        />

        <div className="pf-no-flow-copy">
          {fullyCovered
            ? 'The requested quantity was covered by existing finished-item stock. No manufacturing operations were required.'
            : 'No production tasks were generated for the uncovered quantity. Check whether this item is configured as a purchased input or whether its BOM and manufacturing operations need to be defined.'}
        </div>
      </div>
    </div>
  );
}

/* ==========================================
   MAIN FLOW PAGE
========================================== */

export default function Flow() {
  const { id, line } = useParams();
  const location = useLocation();

  const {
    orders,
    tasks,
    itemsById,
    taskById,
    updatedAt,
    error,
    reload,
  } = useCore();

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  const order = orders.find(
    (candidate) => String(candidate._id) === id
  );

  const lineIndex = Number(line);

  if (!order || !order.orderedItems?.[lineIndex]) {
    return (
      <EmptyState title="Order line not found">
        <Link to="/orders">Back to orders</Link>
      </EmptyState>
    );
  }

  const orderLine = order.orderedItems[lineIndex];

  const flow = buildFlow(
    order,
    lineIndex,
    tasks,
    itemsById
  );

  const item =
    itemsById.get(oid(orderLine.item)) || orderLine.item;

  const due = dueState(order);

  const fullyCovered =
    flow.root.kind === 'leaf' &&
    Number(flow.reserved) >= Number(flow.ordered);

  return (
    <>
      <Link
      to={`/orders/${order._id}`}
    state={location.state}
    className="btn sm"
    style={{ marginBottom: 14 }}
    >
    <ArrowLeft size={14} /> {order.orderId}
  </Link>

      <PageHeader
        title={item?.name || 'Production flow'}
        sub={`Production flow · ${order.clientName}`}
      />

      <div className="strip">
        <div>
          <div className="lab">Ordered</div>
          <div className="v mono">
            {numberLabel(flow.ordered)}
          </div>
        </div>

        <div>
          <div className="lab">From stock</div>
          <div className="v mono">
            {numberLabel(flow.reserved)}
          </div>
        </div>

        <div>
          <div className="lab">To produce</div>
          <div className="v mono">
            {numberLabel(
              Math.max(0, flow.ordered - flow.reserved)
            )}
          </div>
        </div>

        <div>
          <div className="lab">Due</div>
          <div className="v">
            <span className="mono">
              {fmtDate(order.dueDate)}
            </span>
            <Chip tone={due.tone}>{due.label}</Chip>
          </div>
        </div>
      </div>

      {flow.root.kind !== 'leaf' && (
        <Notice tone="wait">
          Task completion still has a backend inventory-consumption
          limitation: the current completion endpoint consumes the
          item's BOM and adds output stock on every operation of
          that item. This flow is read-only and does not change
          that behaviour.
        </Notice>
      )}

      <div className="legend pf-legend">
        <span><i className="sw t-ok" /> Covered / done</span>
        <span><i className="sw t-wait" /> Pending / queued</span>
        <span><i className="sw t-bad" /> Material shortage</span>
        <span><i className="sw t-idle" /> Waiting</span>
        <span className="muted">
          Up = next stage in the same lane · + = combine · right arrow = feeds the next lane
        </span>
      </div>

      {flow.root.kind === 'leaf' ? (
        <NoProductionFlow
          item={item}
          orderLine={orderLine}
          fullyCovered={fullyCovered}
        />
      ) : (
        <FlowCanvas
          root={flow.root}
          taskById={taskById}
          itemsById={itemsById}
        />
      )}
    </>
  );
}
