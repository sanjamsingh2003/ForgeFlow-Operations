import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { useCore, useFetch } from '../hooks.jsx';
import { Chip, EmptyState, ErrorState, LoadingState, PageHeader } from '../ui.jsx';
import { fmtDateTime, oid } from '../lib.js';

export default function Movements() {
  const { data, error, loading, reload } = useFetch(api.movements);
  const { orders } = useCore();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(100);
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const rows = data
    .filter((m) => (m.item?.name || '').toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !type || m.movementType === type);
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  return (
    <>
      <PageHeader title="Movement history" sub="Every stock change the system recorded: consumption (−) and production (+)." />
      <div className="toolbar">
        <div className="search"><Search size={15} /><input className="input" placeholder="Search item" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option><option value="CONSUMPTION">Consumption</option><option value="PRODUCTION">Production</option>
        </select>
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No movements">Movements appear when orders reserve stock or tasks are completed.</EmptyState>
        ) : (
          <>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>When</th><th>Item</th><th>Type</th><th className="num">Quantity</th><th>Source</th></tr></thead>
                <tbody>
                  {rows.slice(0, limit).map((m) => {
                    const o = m.orderId ? orderById.get(oid(m.orderId)) || m.orderId : m.taskId?.orderId ? orderById.get(oid(m.taskId.orderId)) : null;
                    const pos = m.movementType === 'PRODUCTION';
                    return (
                      <tr key={m._id}>
                        <td className="mono sm">{fmtDateTime(m.createdAt)}</td>
                        <td style={{ fontWeight: 600 }}>{m.item?.name}</td>
                        <td><Chip tone={pos ? 'ok' : 'idle'} icon={false}>{pos ? 'Production' : 'Consumption'}</Chip></td>
                        <td className="num mono" style={{ fontWeight: 600, color: pos ? 'var(--ok)' : undefined }}>{pos ? '+' : '−'}{Math.abs(m.quantity)}</td>
                        <td className="sm">
                          {m.taskId?.operationName ? `Task: ${m.taskId.operationName}` : 'Order stock reservation'}
                          {o && o._id ? <> · <Link to={`/orders/${o._id}`} className="mono">{o.orderId}</Link></> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit(limit + 100)}>Show more</button></div>}
          </>
        )}
      </div>
    </>
  );
}
