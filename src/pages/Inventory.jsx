
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { useCore } from '../hooks.jsx';
import ItemDrawer from '../components/ItemDrawer.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader
} from '../ui.jsx';
import { NATURE, stockCondition } from '../lib.js';

export default function Inventory() {
  const navigate = useNavigate();
  const { items, updatedAt, error, reload } = useCore();

  const [q, setQ] = useState('');
  const [cond, setCond] = useState('');
  const [drawer, setDrawer] = useState(null);

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  const rows = items
    .filter((i) => i.itemNature === 'FINISHED_PRODUCT')
    .filter((i) =>
      `${i.name} ${i.sku || ''} ${i.category}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
    .filter((i) => !cond || stockCondition(i).key === cond)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Inventory"
        sub="Raw materials, components, sub-assemblies and finished products."
        actions={
          <button
            className="btn primary"
            onClick={() => setDrawer({})}
          >
            <Plus size={15} /> Add item
          </button>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Search size={15} />
          <input
            className="input"
            placeholder="Search name, SKU or category"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="select"
          value={cond}
          onChange={(e) => setCond(e.target.value)}
          aria-label="Filter by stock condition"
        >
          <option value="">All stock levels</option>
          <option value="out">Out of stock</option>
          <option value="low">Low stock</option>
          <option value="ok">In stock</option>
        </select>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            title={items.length ? 'No matching items' : 'No items yet'}
            icon={Package}
          >
            {items.length
              ? 'Try different filters.'
              : 'Use "Add item" to create the first one.'}
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Nature</th>
                  <th>Category</th>
                  <th className="num">Stock</th>
                  <th className="num">Minimum</th>
                  <th>Condition</th>
                  <th className="num">Cost / unit</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((i) => {
                  const c = stockCondition(i);

                  return (
                    <tr
                      key={i._id}
                      className="link"
                      onClick={() => setDrawer({ item: i })}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {i.name}
                        </div>
                        {i.sku && (
                          <div className="mono sm muted">
                            {i.sku}
                          </div>
                        )}
                      </td>

                      <td>{NATURE[i.itemNature]}</td>
                      <td>{i.category}</td>

                      <td className="num mono">
                        {i.currentStock}{' '}
                        <span className="muted">{i.unit}</span>
                      </td>

                      <td className="num mono">
                        {i.minimumStock}
                      </td>

                      <td>
                        <Chip tone={c.tone}>{c.label}</Chip>
                      </td>

                      <td className="num mono">
                        {i.costPerUnit != null
                          ? i.costPerUnit
                          : '—'}
                      </td>

                      <td className="num">
                        <button
                          className="btn primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/inventory/${i._id}/flow`);
                          }}
                        >
                          View Stock Flow
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && (
        <ItemDrawer
          key={drawer.item?._id || 'new'}
          item={drawer.item}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}
