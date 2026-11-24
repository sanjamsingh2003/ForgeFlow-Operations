
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, GitBranch } from 'lucide-react';
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
  flowTasks,
  fmtDate,
  oid,
  shortComponents,
  taskProgress,
} from '../lib.js';

function getTaskStatus(task, taskById, itemsById) {
  if (task.status === 'COMPLETED') {
    return (
      <div>
        <Chip tone="ok">Completed</Chip>
        <div className="sm" style={{ marginTop: 5 }}>
          {task.producedQuantity ?? 0} good
          {' · '}
          {task.defectiveQuantity ?? 0} defective
        </div>
      </div>
    );
  }

  if (task.status === 'IN_PROGRESS') {
    return <Chip tone="wait">In progress</Chip>;
  }

  if (task.status === 'BLOCKED') {
    const reason = blockReason(task, taskById);

    if (!reason) {
      return <Chip tone="bad">Blocked</Chip>;
    }

    if (reason.kind === 'mat') {
      const shortages = shortComponents(task, itemsById);

      return (
        <div>
          <Chip tone="bad">Material shortage</Chip>
          {shortages.length > 0 && (
            <div className="sm" style={{ marginTop: 5 }}>
              {shortages.map((item) => item.name).join(', ')}
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <Chip tone="idle">Waiting for dependency</Chip>
        {reason.text && (
          <div className="sm" style={{ marginTop: 5 }}>
            {reason.text}
          </div>
        )}
      </div>
    );
  }

  if (task.status === 'PENDING') {
    return (
      <div>
        <Chip tone="wait">Pending</Chip>
        {task.queuePosition != null && (
          <div className="sm" style={{ marginTop: 5 }}>
            Queue position: {task.queuePosition}
          </div>
        )}
      </div>
    );
  }

  return (
    <Chip tone="idle">
      {task.status || 'Unknown'}
    </Chip>
  );
}

export default function ProductionTracker() {
  const { id, line } = useParams();

  const {
    orders,
    tasks,
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

  const order = orders.find(
    (entry) => String(entry._id) === id
  );

  if (!order) {
    return (
      <EmptyState title="Order not found">
        <Link to="/orders">Back to orders</Link>
      </EmptyState>
    );
  }

  const lineIndex = Number(line);

  if (
    !Number.isInteger(lineIndex) ||
    lineIndex < 0 ||
    lineIndex >= order.orderedItems.length
  ) {
    return (
      <EmptyState title="Ordered item not found">
        <Link to={`/orders/${order._id}`}>
          Back to order
        </Link>
      </EmptyState>
    );
  }

  const orderLine = order.orderedItems[lineIndex];

  const item =
    orderLine.item?.name
      ? orderLine.item
      : itemsById.get(oid(orderLine.item));

  const flow = buildFlow(
    order,
    lineIndex,
    tasks,
    itemsById
  );

  const operations = flowTasks(flow.root)
    .slice()
    .sort((a, b) => {
      const sequenceA = Number(a.sequence ?? 0);
      const sequenceB = Number(b.sequence ?? 0);

      if (sequenceA !== sequenceB) {
        return sequenceA - sequenceB;
      }

      return (
        new Date(a.createdAt || 0) -
        new Date(b.createdAt || 0)
      );
    });

  const progress = taskProgress(operations);
  const remainingToProduce = Math.max(
    0,
    Number(orderLine.quantity) - Number(flow.reserved)
  );

  const itemName =
    item?.name ||
    `Ordered item ${lineIndex + 1}`;

  return (
    <>
      <Link
        to={`/orders/${order._id}`}
        className="btn sm"
        style={{ marginBottom: 14 }}
      >
        <ArrowLeft size={14} />
        Back to order
      </Link>

      <PageHeader
        title="Production Tracker"
        sub={`${order.orderId} · ${order.clientName} · ${itemName}`}
      />

      <div className="strip">
        <div>
          <div className="lab">Ordered quantity</div>
          <div className="v mono">
            {orderLine.quantity}
          </div>
        </div>

        <div>
          <div className="lab">Reserved from stock</div>
          <div className="v mono">
            {flow.reserved}
          </div>
        </div>

        <div>
          <div className="lab">To manufacture</div>
          <div className="v mono">
            {remainingToProduce}
          </div>
        </div>

        <div>
          <div className="lab">Due date</div>
          <div className="v mono">
            {fmtDate(order.dueDate)}
          </div>
        </div>

        <div>
          <div className="lab">Operations completed</div>
          <div className="v">
            {progress.done} of {progress.total}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          Overall operation progress
        </div>

        {operations.length > 0 ? (
          <Progress
            done={progress.done}
            total={progress.total}
          />
        ) : (
          <EmptyState title="No manufacturing operations">
            No production operations have been generated
            for this item.
          </EmptyState>
        )}

        <div className="sm" style={{ marginTop: 10 }}>
          Progress is calculated from completed manufacturing
          operations, not from the number of physical units
          manufactured.
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          Manufacturing Operations{' '}
          <Chip tone="idle" icon={false}>
            {operations.length}
          </Chip>
        </div>

        {operations.length === 0 ? (
          <EmptyState title="No operations to track">
            Check the item's fulfilment and production generation.
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Item / Component</th>
                  <th>Operation</th>
                  <th>Machine / Worker</th>
                  <th className="num">Required</th>
                  <th className="num">Good</th>
                  <th className="num">Defective</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {operations.map((task, index) => (
                  <tr key={task._id}>
                    <td className="num mono">
                      {index + 1}
                    </td>

                    <td style={{ fontWeight: 600 }}>
                      {task.item?.name ||
                        itemsById.get(oid(task.item))?.name ||
                        '—'}
                    </td>

                    <td>{task.operationName || '—'}</td>

                    <td className="mono sm">
                      {task.machineId || 'Unassigned'}
                      {task.workerName &&
                      task.workerName !== 'UNASSIGNED'
                        ? ` · ${task.workerName}`
                        : ''}
                    </td>

                    <td className="num mono">
                      {task.quantityRequired ?? '—'}
                    </td>

                    <td className="num mono">
                      {task.producedQuantity ?? 0}
                    </td>

                    <td className="num mono">
                      {task.defectiveQuantity ?? 0}
                    </td>

                    <td>
                      {getTaskStatus(
                        task,
                        taskById,
                        itemsById
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Link
          className="btn"
          to={`/orders/${order._id}/flow/${lineIndex}`}
        >
          <GitBranch size={14} />
          View Production Flow
        </Link>
      </div>
    </>
  );
}
