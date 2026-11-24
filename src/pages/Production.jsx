
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CheckCircle2, Factory, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { useCore } from '../hooks.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  Notice,
  PageHeader,
  useToast
} from '../ui.jsx';
import { blockReason, shortComponents } from '../lib.js';

const orderLabel = (t) => t.orderId?.orderId || '—';
const orderLink = (t) =>
  t.orderId?._id ? `/orders/${t.orderId._id}` : '/orders';

function CompleteModal({ task, onClose, onDone }) {
  const toast = useToast();
  const [produced, setProduced] = useState('');
  const [defective, setDefective] = useState('0');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const p = Number(produced);
    const d = Number(defective);

    if (produced === '' || !Number.isInteger(p) || p < 0) {
      return setErr('Produced quantity must be a whole number, 0 or more.');
    }

    if (!Number.isInteger(d) || d < 0) {
      return setErr('Defective quantity must be a whole number, 0 or more.');
    }

    if (p + d < 1) {
      return setErr('Enter at least one produced or defective unit.');
    }

    if (p + d > task.quantityRequired) {
      return setErr(
        `Produced + defective cannot exceed the required quantity (${task.quantityRequired}).`
      );
    }

    setBusy(true);

    try {
      await api.completeTask(task._id, {
        producedQuantity: p,
        defectiveQuantity: d
      });

      toast('Task completed');
      await onDone();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Complete task"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Completing…' : 'Complete task'}
          </button>
        </>
      }
    >
      <p style={{ margin: '0 0 14px' }}>
        <b>{task.operationName}</b> · {task.item?.name}
        <br />
        <span className="muted sm">
          Order {orderLabel(task)} · required {task.quantityRequired}
        </span>
      </p>

      <div className="form-grid">
        <Field label="Produced (good units)">
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            autoFocus
            value={produced}
            onChange={(e) => setProduced(e.target.value)}
          />
        </Field>

        <Field label="Defective units">
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            value={defective}
            onChange={(e) => setDefective(e.target.value)}
          />
        </Field>
      </div>

      <p className="hint" style={{ marginTop: 10 }}>
        Material for produced + defective units is consumed.
        Only good units are added to stock. Completing may unlock
        dependent tasks.
      </p>

      <div style={{ marginTop: 12 }}>
        <Notice tone="wait">
          Known backend issue: BOM consumption and stock increase
          currently happen on every operation of an item, not once.
          Check inventory after completing multi-operation items.
        </Notice>
      </div>

      {err && (
        <div style={{ marginTop: 12 }}>
          <Notice tone="bad">{err}</Notice>
        </div>
      )}
    </Modal>
  );
}

function Tabs() {
  return (
    <div className="tabs">
      <NavLink
        to="/production"
        end
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Task queue
      </NavLink>

      <NavLink
        to="/production/blocked"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Blocked tasks
      </NavLink>

      <NavLink
        to="/production/machines"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        Machines
      </NavLink>
    </div>
  );
}

function TaskTable({ tasks, onComplete, showQueue = true }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {showQueue && <th>Queue</th>}
            <th>Order</th>
            <th>Item</th>
            <th>Operation</th>
            <th className="num">Qty</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {tasks.map((t) => (
            <tr key={t._id}>
              {showQueue && (
                <td className="mono">{t.queuePosition ?? '—'}</td>
              )}
              <td>
                <Link className="mono" to={orderLink(t)}>
                  {orderLabel(t)}
                </Link>
              </td>
              <td>{t.item?.name}</td>
              <td>{t.operationName}</td>
              <td className="num mono">{t.quantityRequired}</td>
              <td className="num">
                {onComplete && (
                  <button
                    className="btn sm primary"
                    onClick={() => onComplete(t)}
                  >
                    Complete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Production({ view }) {
  const {
    tasks,
    machines,
    taskById,
    itemsById,
    updatedAt,
    error,
    reload
  } = useCore();

  const [completing, setCompleting] = useState(null);

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  const byQueue = (a, b) =>
    (a.queuePosition ?? 1e9) - (b.queuePosition ?? 1e9) ||
    new Date(a.queuedAt || a.createdAt) -
      new Date(b.queuedAt || b.createdAt);

  let body;

  if (view === 'queue') {
    const pending = tasks.filter((t) => t.status === 'PENDING');

    // Only tasks belonging to registered machines appear in machine queues.
    const registeredMachineIds = new Set(
      machines.map((m) => String(m.machineId || '').trim())
    );

    const assignedTasks = pending.filter((t) =>
      registeredMachineIds.has(String(t.machineId || '').trim())
    );

    // Tasks without a valid registered machine remain visible separately.
    const unassignedTasks = pending
      .filter((t) =>
        !registeredMachineIds.has(String(t.machineId || '').trim())
      )
      .sort(byQueue);

    const machinesWithTasks = machines.filter((m) =>
      assignedTasks.some((t) => t.machineId === m.machineId)
    );

    body = pending.length === 0 ? (
      <div className="card">
        <EmptyState title="No pending tasks" icon={CheckCircle2}>
          All production work is up to date.
        </EmptyState>
      </div>
    ) : (
      <div className="stack">

        {unassignedTasks.length > 0 && (
          <div className="card">
            <div className="card-h">
              <span>
                <AlertTriangle
                  size={16}
                  style={{
                    display: 'inline',
                    verticalAlign: 'middle',
                    marginRight: 8
                  }}
                />
                Unassigned Tasks
              </span>

              <Chip tone="wait" icon={false}>
                {unassignedTasks.length} tasks
              </Chip>
            </div>

            <div className="card-b">
              <Notice tone="wait">
                These tasks do not have a valid registered machine
                assignment. Assign the appropriate machine before
                processing them.
              </Notice>
            </div>

            <TaskTable tasks={unassignedTasks} />
          </div>
        )}

        {machinesWithTasks.map((m) => {
          const list = assignedTasks
            .filter((t) => t.machineId === m.machineId)
            .sort(byQueue);

          return (
            <div className="card" key={m._id}>
              <div className="card-h">
                <span>
                  <span className="mono">{m.machineId}</span>
                  {' · '}
                  {m.machineName}
                  {m.workerName && (
                    <span
                      className="muted"
                      style={{ fontWeight: 400 }}
                    >
                      {' · '}{m.workerName}
                    </span>
                  )}
                </span>

                <Chip tone="wait" icon={false}>
                  {list.length} queued
                </Chip>
              </div>

              <TaskTable
                tasks={list}
                onComplete={setCompleting}
              />
            </div>
          );
        })}
      </div>
    );
  } else if (view === 'blocked') {
    const blocked = tasks
      .filter((t) => t.status === 'BLOCKED')
      .sort(
        (a, b) =>
          new Date(a.createdAt) - new Date(b.createdAt)
      );

    body = blocked.length === 0 ? (
      <div className="card">
        <EmptyState title="No blocked tasks" icon={CheckCircle2}>
          Nothing is waiting on material or a dependency.
        </EmptyState>
      </div>
    ) : (
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Item</th>
                <th>Operation</th>
                <th className="num">Qty</th>
                <th>Why it is blocked</th>
              </tr>
            </thead>

            <tbody>
              {blocked.map((t) => {
                const r = blockReason(t, taskById);
                const sh =
                  r.kind === 'mat'
                    ? shortComponents(t, itemsById)
                    : [];

                return (
                  <tr key={t._id}>
                    <td>
                      <Link className="mono" to={orderLink(t)}>
                        {orderLabel(t)}
                      </Link>
                    </td>
                    <td>{t.item?.name}</td>
                    <td>{t.operationName}</td>
                    <td className="num mono">
                      {t.quantityRequired}
                    </td>
                    <td>
                      <Chip tone={r.kind === 'mat' ? 'bad' : 'idle'}>
                        {r.kind === 'mat'
                          ? 'Material shortage'
                          : r.text}
                      </Chip>

                      {sh.length > 0 && (
                        <div
                          className="sm muted"
                          style={{ marginTop: 4 }}
                        >
                          {sh.map((s) =>
                            `${s.name}: stock ${s.stock}, needs ${s.need}`
                          ).join(' · ')}
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
    );
  } else {
    body = machines.length === 0 ? (
      <div className="card">
        <EmptyState title="No machines" icon={Factory}>
          Machines are defined in the backend.
        </EmptyState>
      </div>
    ) : (
      <div className="grid2">
        {machines.map((m) => {
          const q = tasks
            .filter(
              (t) =>
                t.status === 'PENDING' &&
                t.machineId === m.machineId
            )
            .sort(byQueue);

          const waiting = tasks.filter(
            (t) =>
              t.status === 'BLOCKED' &&
              t.machineId === m.machineId
          ).length;

          return (
            <div className="card" key={m._id}>
              <div className="card-h">
                <span>
                  <span className="mono">{m.machineId}</span>
                  {' · '}{m.machineName}
                </span>

                <Chip
                  tone={q.length ? 'wait' : 'idle'}
                  icon={false}
                >
                  {q.length} queued
                </Chip>
              </div>

              <div className="card-b">
                <div className="lab">Worker</div>
                <div style={{ marginBottom: 12 }}>
                  {m.workerName || 'Not assigned'}
                </div>

                <div className="lab">Next task</div>
                <div style={{ marginBottom: 12 }}>
                  {q[0]
                    ? `${q[0].operationName} · ${q[0].item?.name} (${q[0].quantityRequired})`
                    : 'Idle'}
                </div>

                <div className="lab">Tasks waiting to unlock</div>
                <div className="mono">{waiting}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Production"
        sub="Task queues, blocked work and machines."
      />

      <Tabs />

      {body}

      {completing && (
        <CompleteModal
          task={completing}
          onClose={() => setCompleting(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
