
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarX,
  ChevronRight,
  Clock,
  Layers,
  ShoppingCart,
  Lock,
  Package,
  Factory,
} from 'lucide-react';

import { useCore } from '../hooks.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../ui.jsx';

import {
  dueState,
  isMatBlocked,
  fmtDate,
  oid,
  shortComponents,
  workloadProgress,
} from '../lib.js';

export default function Dashboard() {
  const {
    orders,
    tasks,
    machines,
    itemsById,
    taskById,
    tasksByOrder,
    updatedAt,
    error,
    reload,
  } = useCore();

  if (!updatedAt) {
    return error ? (
      <ErrorState message={error} onRetry={reload} />
    ) : (
      <LoadingState />
    );
  }

 
// Keep this definition identical to Orders.jsx's "In Production" category:
// an order must have production tasks, must not be completed/cancelled,
// must not have all tasks completed, and must not be classified as Blocked.
const activeOrders = orders
  .filter((order) => {
    if (['Completed', 'Cancelled'].includes(order.status)) return false;

    const orderTasks = tasksByOrder.get(String(order._id)) || [];
    if (orderTasks.length === 0) return false;
    if (orderTasks.every((task) => task.status === 'COMPLETED')) return false;
    if (orderTasks.some((task) => task.status === 'BLOCKED')) return false;

    return true;
  })
  .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));


  // Blocked task calculations.
  const blocked = tasks.filter((task) => task.status === 'BLOCKED');

  const matBlocked = blocked.filter((task) =>
    isMatBlocked(task, taskById)
  );

  // Godown Fulfillable Rate:
  // Original finished-stock allocation / total demand
  // across active orders. Later production is not counted.
  const fulfillmentOrders = orders.filter(
    (order) =>
      order.status !== 'Completed' &&
      order.status !== 'Cancelled'
  );

  const godownBreakdown =  fulfillmentOrders.map((order) => {
    const totalDemand = (order.orderedItems || []).reduce(
      (sum, line) => sum + (Number(line.quantity) || 0),
      0
    );

    const coveredQuantity = (order.orderedItems || []).reduce(
      (sum, line) =>
        sum + (Number(line.reservedQuantity) || 0),
      0
    );

    return { totalDemand, coveredQuantity };
  });

  const totalGodownDemand = godownBreakdown.reduce(
    (sum, row) => sum + row.totalDemand,
    0
  );

  const totalGodownCovered = godownBreakdown.reduce(
    (sum, row) => sum + row.coveredQuantity,
    0
  );

  const totalGodownProduction = Math.max(
    0,
    totalGodownDemand - totalGodownCovered
  );

  const godownRate =
    totalGodownDemand > 0
      ? (totalGodownCovered / totalGodownDemand) * 100
      : null;

  const godownPercentage =
    godownRate === null ? 0 : Math.round(godownRate);

  // Other KPI values.
  const dueSoon = activeOrders.filter(
    (order) => dueState(order).key !== 'ok'
  ).length;

  const orderProgress = (order) =>
    workloadProgress(tasksByOrder.get(String(order._id)) || []);

  // Build top material shortages from actual blocked-task BOM shortages.
  // Count each component once per affected order.
  const shortageMap = new Map();

  for (const task of matBlocked) {
    const shortages = shortComponents(task, itemsById);
    const orderId = oid(task.orderId);

    for (const shortage of shortages) {
      const key = shortage.name;

      if (!shortageMap.has(key)) {
        shortageMap.set(key, {
          name: shortage.name,
          affectedOrders: new Set(),
          blockedTasks: new Set(),
        });
      }

      const entry = shortageMap.get(key);

      if (orderId) entry.affectedOrders.add(orderId);
      entry.blockedTasks.add(String(task._id));
    }
  }

  const topShortages = [...shortageMap.values()]
    .sort(
      (a, b) =>
        b.affectedOrders.size - a.affectedOrders.size ||
        b.blockedTasks.size - a.blockedTasks.size ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 3);

  // Total distinct materials/components with a shortage (not blocked-task count).
  const totalShortages = shortageMap.size;

  // Needs Attention list.
  const attention = [];

  for (const order of activeOrders) {
    const orderTasks = tasksByOrder.get(String(order._id)) || [];
    const due = dueState(order);

    const materialBlocked = orderTasks.filter((task) =>
      isMatBlocked(task, taskById)
    );

    const dependencyBlocked = orderTasks.filter(
      (task) =>
        task.status === 'BLOCKED' &&
        !isMatBlocked(task, taskById)
    );

    const lines = [];

    if (due.key !== 'ok' && due.key !== 'unknown') {
      lines.push(due.label);
    }

    if (materialBlocked.length) {
      lines.push(
        `${materialBlocked.length} task${
          materialBlocked.length > 1 ? 's' : ''
        } blocked by material shortage`
      );
    }

    if (dependencyBlocked.length) {
      lines.push(`${dependencyBlocked.length} waiting on a dependency`);
    }

    if (!lines.length) continue;

    const tone =
      due.key === 'overdue' || materialBlocked.length
        ? 'bad'
        : due.key === 'soon'
          ? 'wait'
          : 'idle';

    if (tone === 'idle') continue;

    attention.push({
      order,
      tone,
      lines,
      icon:
        due.key === 'overdue'
          ? CalendarX
          : materialBlocked.length
            ? AlertTriangle
            : Clock,
      days: due.days,
    });
  }

  attention.sort((a, b) =>
    a.tone === b.tone
      ? (a.days ?? 9999) - (b.days ?? 9999)
      : a.tone === 'bad'
        ? -1
        : 1
  );

  return (
    <>
      <PageHeader
        title="Overview"
        sub="What needs attention across the factory right now."
      />

      {/* KPI CARDS */}
      <div className="kpis">

        {/* GODOWN FULFILLABLE RATE */}
        <Link
          to="/godown-fulfilment"
          className="kpi"
          style={{
            borderTop: '2px solid var(--accent)',
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="lab">Godown fulfillable rate</div>
            <Layers size={18} color="var(--accent)" />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: 100,
                height: 100,
                minWidth: 100,
                borderRadius: '50%',
                background:
                  godownRate === null
                    ? 'var(--border)'
                    : `conic-gradient(var(--accent) ${godownPercentage}%, var(--border) ${godownPercentage}% 100%)`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div
                style={{
                  width: 65,
                  height: 65,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 19,
                  fontWeight: 750,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {godownRate === null ? '—' : `${godownPercentage}%`}
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 650 }}>
                Finished stock coverage
              </div>

              <div className="sm muted" style={{ marginTop: 5 }}>
                {godownRate === null
                  ? 'No active demand'
                  : `${totalGodownCovered} of ${totalGodownDemand} units covered`}
              </div>

              <div className="sm muted" style={{ marginTop: 5 }}>
                {godownRate === null
                  ? 'No production requirement'
                  : `${totalGodownProduction} units require production`}
              </div>
            </div>
          </div>

          <div className="sm muted" style={{ marginTop: 6, fontSize: 10 }}>
            Click to view full breakdown
          </div>
        </Link>

        {/* ACTIVE ORDERS */}
        <div
          className="kpi"
          style={{ borderTop: '2px solid var(--accent)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="lab">Open orders</div>
            <ShoppingCart size={18} color="var(--accent)" />
          </div>

          <div className="kv mono">{activeOrders.length}</div>

          <div className="s">
            {dueSoon} overdue or due within their alert window
          </div>
        </div>

        {/* MATERIAL SHORTAGES */}
        <div
          className="kpi"
          style={{ borderTop: '2px solid var(--bad)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="lab">Material shortages</div>
            <AlertTriangle size={18} color="var(--bad)" />
          </div>

          <div
            className="kv mono"
            style={{
              color: totalShortages ? 'var(--bad)' : undefined,
            }}
          >
            {totalShortages}
          </div>

          <div className="s">Distinct materials below required stock</div>
        </div>

        {/* BLOCKED TASKS */}
        <div
          className="kpi"
          style={{ borderTop: '2px solid var(--wait)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="lab">Blocked tasks</div>
            <Lock size={18} color="var(--wait)" />
          </div>

          <div className="kv mono">{blocked.length}</div>

          <div className="s">
            {blocked.length - matBlocked.length} on a dependency ·{' '}
            {matBlocked.length} on material
          </div>
        </div>
      </div>

      {/* ACTIVE ORDERS AND MATERIAL SHORTAGES */}
      <div
        className="grid2"
        style={{
          alignItems: 'stretch',
          marginTop: 16,
          marginBottom: 16,
        }}
      >

        {/* ACTIVE ORDERS */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h">
            <span>Active Orders ({activeOrders.length})</span>

            <Link
              to="/orders?status=production"
              className="sm"
              style={{ color: 'var(--accent)' }}
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {activeOrders.length === 0 ? (
            <EmptyState title="No open orders">
              All orders with production tasks are complete.
            </EmptyState>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.25fr 1fr 0.75fr 1.1fr',
                  gap: 10,
                  padding: '11px 14px',
                  background: 'var(--surface2)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--muted)',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <span>Order ID</span>
                <span>Customer</span>
                <span>Due</span>
                <span>Production</span>
              </div>

              <div
                style={{
                  height: 275,
                  overflowY: 'auto',
                  msOverflowX: 'hidden',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--border) transparent',
                }}
              >
                {activeOrders.slice(0, 5).map((order) => {
                  const progress = orderProgress(order);
                  const due = dueState(order);
                  const pct = progress.percentage ?? 0;

                  const progressColor =
                    progress.percentage === null
                      ? 'var(--border)'
                      : pct >= 70
                        ? 'var(--accent)'
                        : pct >= 35
                          ? 'var(--wait)'
                          : 'var(--bad)';

                  return (
                    <Link
                      key={order._id}
                      to={`/orders/${order._id}`}
                      className="it"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.25fr 1fr 0.75fr 1.1fr',
                        gap: 10,
                        alignItems: 'center',
                        padding: '28px 14px',
                        textDecoration: 'none',
                        color: 'inherit',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 15,
                          fontWeight: 650,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {order.orderId}
                      </span>

                      <span
                        title={order.clientName || ''}
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}
                      >
                        {order.clientName || '—'}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          color:
                            due.key === 'overdue'
                              ? 'var(--bad)'
                              : due.key === 'soon'
                                ? 'var(--wait)'
                                : 'var(--muted)',
                        }}
                      >
                        {fmtDate(order.dueDate)}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 5,
                            marginBottom: 6,
                            fontSize: 11,
                          }}
                        >
                          <b style={{ color: progressColor }}>
                            {progress.percentage === null
                              ? '—'
                              : `${progress.percentage}%`}
                          </b>

                          <span className="muted">
                            {progress.completedTasks}/{progress.totalTasks}
                          </span>
                        </div>

                        <div
                          style={{
                            height: 6,
                            borderRadius: 99,
                            background: 'var(--border)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: progressColor,
                              borderRadius: 99,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* MATERIAL SHORTAGES */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h">
            <span>Material Shortages (Top)</span>

            <Link
              to="/production/blocked"
              className="sm"
              style={{ color: 'var(--accent)' }}
            >
              View blocked tasks <ChevronRight size={14} />
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 0.8fr 0.75fr',
              gap: 10,
              padding: '11px 14px',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Material / Component</span>
            <span>Affected orders</span>
            <span>Impact</span>
          </div>

          {topShortages.length === 0 ? (
            <EmptyState title="No material shortages">
              No blocked production tasks are currently waiting for material.
            </EmptyState>
          ) : (
            <div>
              {topShortages.map((item, index) => (
                <div
                  key={item.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.35fr 0.8fr 0.75fr',
                    gap: 10,
                    alignItems: 'center',
                    padding: '16px 14px',
                    borderBottom:
                      index === topShortages.length - 1
                        ? 'none'
                        : '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        minWidth: 28,
                        borderRadius: 7,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--surface2)',
                        color: 'var(--muted)',
                      }}
                    >
                      <Package size={15} />
                    </span>

                    <b
                      style={{
                        fontSize: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </b>
                  </div>

                  <span className="sm">
                    {item.affectedOrders.size}{' '}
                    {item.affectedOrders.size === 1 ? 'order' : 'orders'}
                  </span>

                  <span>
                    <Chip
                      tone={index === 0 ? 'bad' : 'wait'}
                      icon={false}
                    >
                      {index === 0 ? 'Highest' : 'High'}
                    </Chip>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              padding: '9px 14px',
              borderTop: '1px solid var(--border)',
              fontSize: 10,
              color: 'var(--muted)',
            }}
          >
            Ranked by number of distinct affected orders.
          </div>
        </div>
      </div>

      {/* NEEDS ATTENTION AND PRODUCTION OVERVIEW */}
      <div className="grid2" style={{ alignItems: 'start' }}>

        {/* NEEDS ATTENTION */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-h">
            <span>Needs attention</span>

            <Chip tone="idle" icon={false}>
              {attention.length}
            </Chip>
          </div>

          {attention.length === 0 ? (
            <EmptyState title="Nothing needs attention">
              No overdue, due-soon or blocked orders.
            </EmptyState>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
              }}
            >
              {attention.map(({ order, tone, lines, icon: Icon }) => (
                <Link
                  key={order._id}
                  to={`/orders/${order._id}`}
                  className="it"
                >
                  <span className={`bx t-${tone}`}>
                    <Icon size={15} />
                  </span>

                  <div className="grow">
                    <div className="ttl">
                      <span className="mono">{order.orderId}</span>
                      {' · '}
                      {order.clientName}
                    </div>

                    <div className="sub2">
                      {lines.join(' · ')} · due {fmtDate(order.dueDate)}
                    </div>
                  </div>

                  <ChevronRight size={16} className="muted" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCTION OVERVIEW */}
        <div className="card">
          <div className="card-h">
            <span>
              <Factory
                size={15}
                style={{ marginRight: 7, verticalAlign: 'middle' }}
              />
              Production overview
            </span>

            <Link
              to="/production"
              className="sm"
              style={{
                color: 'var(--accent)',
                fontWeight: 650,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              View Production <ChevronRight size={14} />
            </Link>
          </div>

          {machines.length === 0 ? (
            <EmptyState title="No machines">
              Machines come from the backend.
            </EmptyState>
          ) : (
            <div
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
              }}
            >
              {machines.map((machine) => {
                const queue = tasks
                  .filter(
                    (task) =>
                      task.status === 'PENDING' &&
                      task.machineId === machine.machineId
                  )
                  .sort(
                    (a, b) =>
                      (a.queuePosition ?? 1e9) -
                      (b.queuePosition ?? 1e9)
                  );

                const next = queue[0];

                return (
                  <Link
                    key={machine._id}
                    to="/production"
                    className="it"
                  >
                    <span
                      className="mono"
                      style={{ width: 44, fontWeight: 600 }}
                    >
                      {machine.machineId}
                    </span>

                    <div className="grow">
                      <div className="ttl">{machine.machineName}</div>

                      <div className="sub2">
                        {machine.workerName} ·{' '}
                        {next
                          ? `next: ${next.operationName} (${next.item?.name})`
                          : 'idle'}
                      </div>
                    </div>

                    <Chip
                      tone={queue.length ? 'wait' : 'idle'}
                      icon={false}
                    >
                      {queue.length} queued
                    </Chip>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
