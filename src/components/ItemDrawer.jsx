import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useCore } from '../hooks.jsx';
import { Drawer, Field, Notice, useToast } from '../ui.jsx';
import { NATURE, oid, wouldCycle } from '../lib.js';

const blank = { name: '', sku: '', category: '', unit: 'pcs', itemNature: 'COMPONENT', currentStock: 0, minimumStock: 10, costPerUnit: '', bom: [], operations: [] };

function fromItem(it) {
  return {
    name: it.name, sku: it.sku || '', category: it.category || '', unit: it.unit || 'pcs', itemNature: it.itemNature,
    currentStock: it.currentStock, minimumStock: it.minimumStock, costPerUnit: it.costPerUnit ?? '',
    bom: (it.bom || []).map((b) => ({ component: oid(b.component), quantityPerUnit: b.quantityPerUnit })),
    operations: (it.operations || []).slice().sort((a, b) => a.sequence - b.sequence)
      .map((o) => ({ operationName: o.operationName, machineId: o.machineId, estimatedTimePerUnit: o.estimatedTimePerUnit })),
  };
}

export default function ItemDrawer({ item, onClose }) {
  const { items, itemsById, machines, reload } = useCore();
  const toast = useToast();
  const edit = !!item;
  const [f, setF] = useState(edit ? fromItem(item) : blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const raw = f.itemNature === 'RAW_MATERIAL';
  const set = (patch) => setF({ ...f, ...patch });
  const usedIn = edit ? items.filter((i) => (i.bom || []).some((b) => oid(b.component) === String(item._id))) : [];

  const setBom = (i, patch) => set({ bom: f.bom.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const setOp = (i, patch) => set({ operations: f.operations.map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const moveOp = (i, d) => {
    const a = f.operations.slice(), j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ operations: a });
  };

  function validate() {
    if (!f.name.trim()) return 'Enter the item name.';
    if (!f.category.trim()) return 'Enter a category.';
    if (!f.unit.trim()) return 'Enter a unit.';
    if (!(Number(f.currentStock) >= 0) || f.currentStock === '') return 'Stock must be 0 or more.';
    if (!(Number(f.minimumStock) >= 0) || f.minimumStock === '') return 'Minimum stock must be 0 or more.';
    if (raw) {
      if (f.costPerUnit === '' || !(Number(f.costPerUnit) >= 0)) return 'Raw materials need a cost per unit (0 or more).';
      return '';
    }
    const ids = new Set();
    for (let i = 0; i < f.bom.length; i++) {
      const b = f.bom[i];
      if (!b.component) return `BOM row ${i + 1}: choose a component.`;
      if (!(Number(b.quantityPerUnit) > 0)) return `BOM row ${i + 1}: quantity per unit must be above 0.`;
      if (ids.has(b.component)) return `BOM row ${i + 1}: this component is already listed.`;
      ids.add(b.component);
    }
    if (wouldCycle(edit ? String(item._id) : null, [...ids], itemsById)) return 'This BOM would contain the item inside itself (circular).';
    
    for (let i = 0; i < f.operations.length; i++) {
      const o = f.operations[i];
      if (!o.operationName.trim()) return `Operation ${i + 1}: enter a name.`;
      if (!o.machineId) return `Operation ${i + 1}: choose a machine.`;
      if (!(Number(o.estimatedTimePerUnit) > 0)) return `Operation ${i + 1}: time per unit must be above 0.`;
    }
    return '';
  }

  async function save() {
    const v = validate();
    setErr(v);
    if (v) return;
    const body = {
      name: f.name.trim(), category: f.category.trim(), unit: f.unit.trim(), itemNature: f.itemNature,
      currentStock: Number(f.currentStock), minimumStock: Number(f.minimumStock),
      bom: raw ? [] : f.bom.map((b) => ({ component: b.component, quantityPerUnit: Number(b.quantityPerUnit) })),
      operations: raw ? [] : f.operations.map((o, i) => ({ sequence: i + 1, operationName: o.operationName.trim(), machineId: o.machineId, estimatedTimePerUnit: Number(o.estimatedTimePerUnit) })),
    };
    if (f.sku.trim()) body.sku = f.sku.trim();
    if (raw) body.costPerUnit = Number(f.costPerUnit);
    setBusy(true);
    try {
      if (edit) await api.updateItem(item._id, body);
      else await api.createItem(body);
      toast(edit ? 'Item updated' : 'Item added');
      await reload();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const compOptions = items.filter((i) => !edit || String(i._id) !== String(item._id));

  return (
    <Drawer
      title={edit ? item.name : 'Add item'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Add item'}</button></>}
    >
      <div className="form-grid">
        <Field label="Item name"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Item nature">
          <select className="select" value={f.itemNature} onChange={(e) => set({ itemNature: e.target.value })}>
            {Object.entries(NATURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Category"><input className="input" value={f.category} onChange={(e) => set({ category: e.target.value })} /></Field>
        <Field label="SKU (optional)"><input className="input" value={f.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        <Field label="Unit"><input className="input" value={f.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
        <Field label={edit ? 'Current stock' : 'Opening stock'} hint={edit ? 'Manual change. No movement record is created. Restocking a raw material unblocks waiting tasks.' : undefined}>
          <input className="input" type="number" min="0" value={f.currentStock} onChange={(e) => set({ currentStock: e.target.value })} />
        </Field>
        <Field label="Minimum stock" hint="Low stock when stock is at or below this."><input className="input" type="number" min="0" value={f.minimumStock} onChange={(e) => set({ minimumStock: e.target.value })} /></Field>
        {raw && <Field label="Cost per unit"><input className="input" type="number" min="0" value={f.costPerUnit} onChange={(e) => set({ costPerUnit: e.target.value })} /></Field>}
      </div>

      {!raw && (
        <>
          <div className="sect">Bill of materials</div>
          {f.bom.map((b, i) => (
            <div key={i} className="rowline" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 36px' }}>
              <Field label="Component">
                <select className="select" value={b.component} onChange={(e) => setBom(i, { component: e.target.value })}>
                  <option value="">Select</option>
                  {compOptions.map((c) => <option key={c._id} value={c._id}>{c.name} · {NATURE[c.itemNature]}</option>)}
                </select>
              </Field>
              <Field label="Qty / unit"><input className="input" type="number" min="0" step="any" value={b.quantityPerUnit} onChange={(e) => setBom(i, { quantityPerUnit: e.target.value })} /></Field>
              <button className="icon-btn" aria-label="Remove component" onClick={() => set({ bom: f.bom.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn sm" onClick={() => set({ bom: [...f.bom, { component: '', quantityPerUnit: 1 }] })}><Plus size={14} /> Add component</button>

          <div className="sect">Operations (in order)</div>
          {f.operations.map((o, i) => (
            <div key={i} className="rowline" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 90px auto' }}>
              <Field label={`Step ${i + 1}`}><input className="input" placeholder="e.g. Cutting" value={o.operationName} onChange={(e) => setOp(i, { operationName: e.target.value })} /></Field>
              <Field label="Machine">
                <select className="select" value={o.machineId} onChange={(e) => setOp(i, { machineId: e.target.value })}>
                  <option value="">Select</option>
                  {machines.map((m) => <option key={m._id} value={m.machineId}>{m.machineId} · {m.machineName}</option>)}
                  {o.machineId && !machines.some((m) => m.machineId === o.machineId) && <option value={o.machineId}>{o.machineId} (unknown)</option>}
                </select>
              </Field>
              <Field label="Time / unit"><input className="input" type="number" min="0" step="any" value={o.estimatedTimePerUnit} onChange={(e) => setOp(i, { estimatedTimePerUnit: e.target.value })} /></Field>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="icon-btn" aria-label="Move up" onClick={() => moveOp(i, -1)}><ArrowUp size={14} /></button>
                <button className="icon-btn" aria-label="Move down" onClick={() => moveOp(i, 1)}><ArrowDown size={14} /></button>
                <button className="icon-btn" aria-label="Remove operation" onClick={() => set({ operations: f.operations.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
          <button className="btn sm" onClick={() => set({ operations: [...f.operations, { operationName: '', machineId: '', estimatedTimePerUnit: '' }] })}><Plus size={14} /> Add operation</button>
          {f.bom.length === 0 && f.operations.length === 0 && <p className="hint" style={{ marginTop: 10 }}>No BOM and no operations: this item is treated as purchased. A shortage is reported as a material shortage.</p>}
        </>
      )}

      {usedIn.length > 0 && (
        <>
          <div className="sect">Used in</div>
          <div className="sm">{usedIn.map((u) => u.name).join(', ')}</div>
        </>
      )}
      {err && <div style={{ marginTop: 16 }}><Notice tone="bad">{err}</Notice></div>}
    </Drawer>
  );
}
