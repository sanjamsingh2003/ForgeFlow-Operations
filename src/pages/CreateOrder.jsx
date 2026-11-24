import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useCore } from '../hooks.jsx';
import { Chip, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, useToast } from '../ui.jsx';
import { oid } from '../lib.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function CreateOrder() {
  const { items, itemsById, updatedAt, error, reload } = useCore();
  const toast = useToast();
  const [client, setClient] = useState('');
  const [due, setDue] = useState('');
  const [alertDays, setAlertDays] = useState(2);
  const [lines, setLines] = useState([{ item: '', quantity: '' }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);

  if (!updatedAt) return error ? <ErrorState message={error} onRetry={reload} /> : <LoadingState />;
  const finished = items.filter((i) => i.itemNature === 'FINISHED_PRODUCT');

  const setLine = (i, patch) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  function validate() {
    if (!client.trim()) return 'Enter the client name.';
    if (!due) return 'Choose a due date.';
    if (due < today()) return 'The due date cannot be in the past.';
    const used = new Set();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.item) return `Line ${i + 1}: choose a finished product.`;
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q < 1) return `Line ${i + 1}: quantity must be a whole number of at least 1.`;
      if (used.has(l.item)) return `Line ${i + 1}: this product is already on another line.`;
      used.add(l.item);
    }
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    setErr(v);
    if (v) return;
    setBusy(true);
    try {
      const res = await api.createOrder({
        clientName: client.trim(),
        dueDate: due,
        alertBeforeDays: Number(alertDays),
        orderedItems: lines.map((l) => ({ item: l.item, quantity: Number(l.quantity) })),
      });
      setResult(res);
      toast('Order created');
      reload();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const order = result.data;
    const shortages = result.materialShortages || [];
    return (
      <>
        <PageHeader title="Order created" sub={order.orderId} actions={<Link className="btn primary" to={`/orders/${order._id}`}>Open order</Link>} />
        <div className="stack">
          <Notice tone="ok"><b>{order.orderId}</b> was saved. Stock was reserved and production tasks were generated for anything stock could not cover.</Notice>
          <div className="card">
            <div className="card-h">Stock coverage</div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Product</th><th className="num">Ordered</th><th className="num">From stock</th><th className="num">To produce</th></tr></thead>
                <tbody>
                  {order.orderedItems.map((l, i) => (
                    <tr key={i}>
                      <td>{itemsById.get(oid(l.item))?.name || oid(l.item)}</td>
                      <td className="num mono">{l.quantity}</td>
                      <td className="num mono">{l.reservedQuantity ?? 0}</td>
                      <td className="num mono">{l.quantity - (l.reservedQuantity ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {shortages.length > 0 && (
            <div className="card">
              <div className="card-h">Material shortages <Chip tone="bad">{shortages.length}</Chip></div>
              <div className="card-b muted sm" style={{ paddingBottom: 0 }}>This list is only returned now. It is not stored by the backend.</div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Material</th><th className="num">Required</th><th className="num">Available</th><th className="num">Short by</th></tr></thead>
                  <tbody>
                    {shortages.map((s, i) => (
                      <tr key={i}>
                        <td>{s.itemName}</td>
                        <td className="num mono">{s.requiredQuantity}</td>
                        <td className="num mono">{s.availableQuantity}</td>
                        <td className="num mono" style={{ color: 'var(--bad)', fontWeight: 600 }}>{s.shortageQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Create order" sub="Stock check, shortage calculation and production planning run on the backend when you submit." />
      {finished.length === 0 ? (
        <div className="card"><EmptyState title="No finished products yet">Add an item with nature "Finished product" in <Link to="/inventory">Inventory</Link> first.</EmptyState></div>
      ) : (
        <form className="card" onSubmit={submit}>
          <div className="card-b">
            <div className="form-grid">
              <Field label="Client name"><input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Kapoor Fabricators" /></Field>
              <Field label="Due date"><input className="input" type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
              <Field label="Alert before due date" hint="Orders are highlighted amber inside this window.">
                <select className="select" value={alertDays} onChange={(e) => setAlertDays(e.target.value)}>
                  <option value={2}>2 days</option><option value={5}>5 days</option><option value={7}>7 days</option>
                </select>
              </Field>
            </div>
            <div className="sect">Ordered products</div>
            {lines.map((l, i) => {
              const it = itemsById.get(l.item);
              return (
                <div key={i} className="rowline" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 36px' }}>
                  <Field label="Finished product" hint={it ? `In stock: ${it.currentStock} ${it.unit || ''}` : undefined}>
                    <select className="select" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })}>
                      <option value="">Select a product</option>
                      {finished.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Quantity"><input className="input" type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></Field>
                  <button type="button" className="icon-btn" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
                </div>
              );
            })}
            <button type="button" className="btn sm" onClick={() => setLines([...lines, { item: '', quantity: '' }])}><Plus size={14} /> Add product</button>
            {err && <div style={{ marginTop: 14 }}><Notice tone="bad">{err}</Notice></div>}
          </div>
          <div className="mf"><button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create order'}</button></div>
        </form>
      )}
    </>
  );
}
