import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { useCore } from '../hooks.jsx';
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../ui.jsx';

export default function GodownFulfilment() {
  const { orders, updatedAt, error, reload } = useCore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('rate-low');

  if (!updatedAt) {
    return error ? (
      <ErrorState message={error} onRetry={reload} />
    ) : (
      <LoadingState />
    );
  }

  // Only active orders contribute to current demand.
  const activeOrders = orders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled'
  );

  // Option A: count only the original finished-stock reservation.
  const breakdown = activeOrders.map((order) => {
    const lines = order.orderedItems || [];
    const totalDemand = lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0),
      0
    );
    const coveredQuantity = lines.reduce(
      (sum, line) => sum + (Number(line.reservedQuantity) || 0),
      0
    );
    const productionQuantity = Math.max(0, totalDemand - coveredQuantity);
    const percentage = totalDemand > 0
      ? (coveredQuantity / totalDemand) * 100
      : 0;
    const coverageStatus = totalDemand > 0 && coveredQuantity >= totalDemand
      ? 'Fully covered'
      : coveredQuantity > 0
        ? 'Partially covered'
        : 'No stock available';

    return {
      order,
      totalDemand,
      coveredQuantity,
      productionQuantity,
      percentage,
      coverageStatus,
    };
  });

  const totalDemand = breakdown.reduce((sum, row) => sum + row.totalDemand, 0);
  const totalCovered = breakdown.reduce((sum, row) => sum + row.coveredQuantity, 0);
  const totalProduction = Math.max(0, totalDemand - totalCovered);
  const overallRate = totalDemand > 0 ? (totalCovered / totalDemand) * 100 : null;

  const query = search.trim().toLowerCase();
  const filteredRows = breakdown
    .filter((row) => {
      const matchesSearch =
        !query ||
        String(row.order.orderId || '').toLowerCase().includes(query) ||
        String(row.order.clientName || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || row.coverageStatus === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'rate-high') return b.percentage - a.percentage;
      if (sortBy === 'demand-high') return b.totalDemand - a.totalDemand;
      if (sortBy === 'demand-low') return a.totalDemand - b.totalDemand;
      return a.percentage - b.percentage;
    });

  return (
    <>
      <PageHeader
        title="Godown Fulfilment"
        sub="See how much active customer demand is covered directly by finished goods stock."
        actions={<Link to="/" className="btn">Back to dashboard</Link>}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div className="lab">Overall fulfilment rate</div>
          <div className="kv mono" style={{ marginTop: 8 }}>
            {overallRate === null ? '—' : `${overallRate.toFixed(1)}%`}
          </div>
          <div className="s">Demand covered directly by finished stock</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="lab">Finished stock covered</div>
          <div className="kv mono" style={{ marginTop: 8 }}>{totalCovered}</div>
          <div className="s">Units originally reserved from the godown</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="lab">Requires production</div>
          <div className="kv mono" style={{ marginTop: 8 }}>{totalProduction}</div>
          <div className="s">Units not covered by original stock allocation</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div
          className="card-h"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 650 }}>Order-wise coverage</div>
            <div className="sm muted" style={{ marginTop: 4 }}>
              {breakdown.length} active orders · {totalCovered} of {totalDemand} units covered
            </div>
          </div>
          <div className="sm muted">Based on original finished-stock reservation</div>
        </div>

        <div
          className="toolbar"
          style={{
            padding: '14px 18px',
            margin: 0,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div className="search" style={{ flex: '1 1 240px' }}>
            <Search size={15} />
            <input
              className="input"
              placeholder="Search order ID or customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="All">All coverage statuses</option>
            <option value="Fully covered">Fully covered</option>
            <option value="Partially covered">Partially covered</option>
            <option value="No stock available">No stock available</option>
          </select>
          <select
            className="input"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            style={{ width: 'auto', minWidth: 170 }}
          >
            <option value="rate-low">Lowest coverage first</option>
            <option value="rate-high">Highest coverage first</option>
            <option value="demand-high">Highest demand first</option>
            <option value="demand-low">Lowest demand first</option>
          </select>
        </div>

        {filteredRows.length === 0 ? (
          <EmptyState title="No matching orders">
            {breakdown.length
              ? 'Try changing your search or coverage filter.'
              : 'There are no active orders to calculate godown fulfilment.'}
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Demand</th>
                  <th>Godown covered</th>
                  <th>Requires production</th>
                  <th>Fulfilment rate</th>
                  <th>Coverage status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.order._id}
                    className="link"
                    onClick={() => navigate(`/orders/${row.order._id}`)}
                  >
                    <td className="mono" style={{ fontWeight: 650 }}>{row.order.orderId}</td>
                    <td>{row.order.clientName || '—'}</td>
                    <td className="mono">{row.totalDemand}</td>
                    <td className="mono">{row.coveredQuantity}</td>
                    <td className="mono">{row.productionQuantity}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{row.percentage.toFixed(1)}%</div>
                      <div
                        style={{
                          height: 5,
                          width: 100,
                          maxWidth: '100%',
                          background: 'var(--border)',
                          borderRadius: 99,
                          overflow: 'hidden',
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, row.percentage)}%`,
                            background: 'var(--accent)',
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <Chip
                        tone={
                          row.coverageStatus === 'Fully covered'
                            ? 'ok'
                            : row.coverageStatus === 'Partially covered'
                              ? 'wait'
                              : 'bad'
                        }
                      >
                        {row.coverageStatus}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            padding: '14px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
          }}
        >
          <span className="muted">Showing {filteredRows.length} of {breakdown.length} active orders</span>
          <strong>
            Overall: {totalCovered} / {totalDemand} units ·{' '}
            {overallRate === null ? '—' : `${overallRate.toFixed(1)}%`}
          </strong>
        </div>
      </div>

      <div className="sm muted" style={{ marginTop: 8 }}>
        Coverage counts only finished stock reserved when the order was created. Stock produced later is not counted as direct godown fulfilment.
      </div>
    </>
  );
}
