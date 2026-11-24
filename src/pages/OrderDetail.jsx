
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  GitBranch,
  PackageCheck,
  Factory,
  ClipboardList,
} from 'lucide-react';
import { useCore } from '../hooks.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Progress,
} from '../ui.jsx';
import {
  blockReason,
  buildFlow,
  dueState,
  flowTasks,
  fmtDate,
  nodeState,
  oid,
  shortComponents,
  taskProgress,
} from '../lib.js';

function getFulfilmentMethod(lines = []) {
  if (!lines.length) return 'Unavailable';

  const quantities = lines.map((line) => ({
    ordered: Number(line.quantity),
    reserved: Number(line.reservedQuantity ?? 0),
  }));

  if (
    quantities.some((line) =>
      !Number.isFinite(line.ordered) ||
      !Number.isFinite(line.reserved) ||
      line.ordered <= 0 ||
      line.reserved < 0
    )
  ) {
    return 'Unavailable';
  }

  const allStock = quantities.every(
    (line) => line.reserved >= line.ordered
  );

  const noStock = quantities.every(
    (line) => line.reserved === 0
  );

  if (allStock) return 'Existing stock';
  if (noStock) return 'Manufacturing';
  return 'Stock + Manufacturing';
}

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();

  const {
    orders,
    tasks,
    tasksByOrder,
    taskById,
    itemsById,
    updatedAt,
    error,
    reload,
  } = useCore();

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  const order = orders.find((o) => String(o._id) === id);

  if (!order) {
    return (
      <EmptyState title="Order not found">
        <Link to="/orders">Back to orders</Link>
      </EmptyState>
    );
  }

  const ts = (tasksByOrder.get(String(order._id)) || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
    );

  const p = taskProgress(ts);
  const open = p.done < p.total;
  const d = dueState(order);
  const fulfilmentMethod = getFulfilmentMethod(
    order.orderedItems
  );

  return (
    <>
      <Link
        to={location.state?.returnTo || '/orders'}
        state={
          location.state?.ordersView
            ? { restoreOrdersView: location.state.ordersView }
            : undefined
        }
        className="btn sm"
        style={{ marginBottom: 14 }}
      >
        <ArrowLeft size={14} /> Orders
      </Link>

      <PageHeader
        title={order.orderId}
        sub={`${order.clientName} · created ${fmtDate(order.createdAt)}`}
      />

      <div className="strip">
        <div>
          <div className="lab">Order status</div>
          <div className="v">
            <Chip
              tone={
                order.status === 'Completed'
                  ? 'ok'
                  : order.status === 'Cancelled'
                    ? 'idle'
                    : 'wait'
              }
            >
              {order.status || 'Pending'}
            </Chip>
          </div>
        </div>

        <div>
          <div className="lab">Due</div>
          <div className="v">
            <span className="mono">{fmtDate(order.dueDate)}</span>
            {open && d.key !== 'ok' && (
              <Chip tone={d.tone}>{d.label}</Chip>
            )}
          </div>
        </div>

        <div>
          <div className="lab">Fulfilment method</div>
          <div className="v">
            {fulfilmentMethod === 'Existing stock' && (
              <PackageCheck size={18} />
            )}
            {fulfilmentMethod === 'Manufacturing' && (
              <Factory size={18} />
            )}
            {fulfilmentMethod === 'Stock + Manufacturing' && (
              <PackageCheck size={18} />
            )}
            <span>{fulfilmentMethod}</span>
          </div>
        </div>

        <div>
          <div className="lab">Alert window</div>
          <div className="v mono">
            {order.alertBeforeDays} days
          </div>
        </div>

        <div>
          <div className="lab">Production tasks</div>
          <div className="v">
            {ts.length ? (
              <Progress done={p.done} total={p.total} />
            ) : (
              <Chip tone="ok">None needed</Chip>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">Ordered items</div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Ordered</th>
                <th className="num">From stock</th>
                <th className="num">To produce</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {order.orderedItems.map((line, i) => {
                const flow = buildFlow(
                  order,
                  i,
                  tasks,
                  itemsById
                );

                const st = nodeState(flow.root, taskById);
                const lineTasks = flowTasks(flow.root);
                const lp = taskProgress(lineTasks);

                const covered =
                  Number(flow.reserved) >= Number(line.quantity);

                let lineStatus;

                if (covered) {
                  lineStatus = (
                    <Chip tone="ok">
                      Fully covered by stock
                    </Chip>
                  );
                } else if (lineTasks.length) {
                  lineStatus = (
                    <Chip tone={st.tone}>
                      {lp.done} of {lp.total} operations done
                    </Chip>
                  );
                } else {
                  lineStatus = (
                    <Chip tone="wait">
                      Production not generated
                    </Chip>
                  );
                }

                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>
                      {line.item?.name ||
                        itemsById.get(oid(line.item))?.name}
                    </td>

                    <td className="num mono">
                      {line.quantity}
                    </td>

                    <td className="num mono">
                      {flow.reserved}
                    </td>

                    <td className="num mono">
                      {Math.max(
                        0,
                        Number(line.quantity) -
                          Number(flow.reserved)
                      )}
                    </td>

                    <td>{lineStatus}</td>

                    <td className="num">
                      {!covered && lineTasks.length > 0 && (
                        <div
                          style={{
                            display: 'inline-flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Link
                            className="btn sm"
                            to={`/orders/${order._id}/flow/${i}`}
                          >
                            <GitBranch size={13} />
                            Production flow
                          </Link>

                          <Link
                            className="btn sm primary"
                            to={`/orders/${order._id}/track/${i}`}
                          >
                            <ClipboardList size={13} />
                            Track Production
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          Production Overview{' '}
          <Chip tone="idle" icon={false}>
            {ts.length}
          </Chip>
        </div>

        {ts.length === 0 ? (
          <EmptyState title="No production tasks">
            Existing stock may have covered this order.
            Check the fulfilment method above.
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Operation</th>
                  <th className="num">Qty</th>
                  <th>Machine</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {ts.map((task) => {
                  const reason =
                    task.status === 'BLOCKED'
                      ? blockReason(task, taskById)
                      : null;

                  const shortages =
                    reason?.kind === 'mat'
                      ? shortComponents(task, itemsById)
                      : [];

                  return (
                    <tr key={task._id}>
                      <td>{task.item?.name}</td>

                      <td>{task.operationName}</td>

                      <td className="num mono">
                        {task.quantityRequired}
                      </td>

                      <td className="mono sm">
                        {task.machineId}
                        {task.workerName &&
                        task.workerName !== 'UNASSIGNED'
                          ? ` · ${task.workerName}`
                          : ''}
                      </td>

                      <td>
                        {task.status === 'COMPLETED' && (
                          <Chip tone="ok">
                            Completed · {task.producedQuantity} ok,
                            {' '}{task.defectiveQuantity} defective
                          </Chip>
                        )}

                        {task.status === 'IN_PROGRESS' && (
                          <Chip tone="wait">
                            In progress
                          </Chip>
                        )}

                        {task.status === 'PENDING' && (
                          <Chip tone="wait">
                            Pending
                            {task.queuePosition != null
                              ? ` · queue ${task.queuePosition}`
                              : ''}
                          </Chip>
                        )}

                        {reason && (
                          <Chip
                            tone={
                              reason.kind === 'mat'
                                ? 'bad'
                                : 'idle'
                            }
                          >
                            {reason.kind === 'mat'
                              ? `Material shortage${
                                  shortages.length
                                    ? ': ' +
                                      shortages
                                        .map((item) => item.name)
                                        .join(', ')
                                    : ''
                                }`
                              : reason.text}
                          </Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
