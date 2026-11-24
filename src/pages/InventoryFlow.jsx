
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCore } from '../hooks.jsx';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
} from '../ui.jsx';
import { NATURE, oid, stockCondition } from '../lib.js';
import { createProductionFlowLayout } from '../flowLayout.js';
import './Flow.css';

function buildInventoryTree(rootItem, itemsById) {
  const missing = [];
  const build = (item, ancestors = new Set()) => {
    const id = oid(item);
    const nextAncestors = new Set(ancestors);

    if (id) nextAncestors.add(id);

    const children = [];

    for (const entry of item.bom || []) {
      const componentId = oid(entry.component);
      const component =
        itemsById.get(componentId) ||
        (typeof entry.component === 'object' ? entry.component : null);

      if (!component) {
        missing.push(componentId || 'Unknown component');
        continue;
      }

      if (componentId && nextAncestors.has(componentId)) {
        children.push({
          kind: 'item',
          item: component,
          tasks: [],
          children: [],
          cycle: true,
        });
        continue;
      }

      children.push(build(component, nextAncestors));
    }

    return {
      kind: 'item',
      item,
      tasks: [],
      children,
    };
  };

  return {
    root: build(rootItem),
    missing: [...new Set(missing)],
  };
}

function StockCard({ node }) {
  const item = node.item || {};
  const condition = stockCondition(item);
  const stock = Number(item.currentStock);

  const stockLabel = Number.isFinite(stock)
    ? `${stock.toLocaleString('en-IN')} ${item.unit || 'units'}`
    : 'Stock unavailable';

  return (
    <div
      className={`pf-card pf-output-card t-${condition.tone}`}
      title={item.name || 'Inventory item'}
    >
      <div className="pf-output-heading">
        <strong className="pf-item-name">
          {item.name || 'Unnamed item'}
        </strong>
      </div>

      <div className="pf-output-footer">
        <strong className={`pf-metric pf-state-${condition.tone}`}>
          Current Stock: {stockLabel}
        </strong>
      </div>

      <div className="pf-item-nature">
        {NATURE[item.itemNature] || 'Inventory item'}
        {node.cycle ? ' · BOM cycle detected' : ''}
      </div>
    </div>
  );
}

function InventoryCanvas({ root }) {
  const layout = useMemo(
    () => createProductionFlowLayout(root),
    [root]
  );

  return (
    <section className="pf-shell" aria-label="Inventory stock flow">
      <div className="pf-scroll-hint">
        <span>Inventory structure</span>
        <span>Scroll horizontally to view every branch</span>
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
                id="inventory-arrow-up"
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
                id="inventory-arrow-right"
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
                key={`v-${index}`}
                className="pf-link"
                x1={link.x}
                y1={link.lowerTop - 2}
                x2={link.x}
                y2={link.upperBottom + 3}
                markerEnd="url(#inventory-arrow-up)"
              />
            ))}

            {layout.horizontalLinks.map((link, index) => (
              <line
                key={`h-${index}`}
                className="pf-link"
                x1={link.x1}
                y1={link.y}
                x2={link.x2}
                y2={link.y}
                markerEnd={
                  link.arrow
                    ? 'url(#inventory-arrow-right)'
                    : undefined
                }
              />
            ))}

            {layout.joins.map((join, index) => (
              <g key={`join-${index}`} className="pf-join">
                <circle
                  cx={join.x}
                  cy={join.y}
                  r={join.radius}
                />
                <text x={join.x} y={join.y + 1}>+</text>
              </g>
            ))}
          </svg>

          {layout.nodes.map((positioned) => (
            <div
              className="pf-positioned-node"
              key={positioned.id}
              style={{
                left: positioned.x,
                top: positioned.y,
                width: positioned.width,
                height: positioned.height,
              }}
            >
              <StockCard
                node={
                  positioned.type === 'leaf'
                    ? positioned.node
                    : positioned.node
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function InventoryFlow() {
  const { id } = useParams();
  const {
    items,
    itemsById,
    updatedAt,
    error,
    reload,
  } = useCore();

  const item = itemsById.get(String(id));

  const inventory = useMemo(
    () => item
      ? buildInventoryTree(item, itemsById)
      : { root: null, missing: [] },
    [item, itemsById]
  );

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  if (!item) {
    return (
      <EmptyState title="Inventory item not found">
        <Link to="/inventory">Back to Inventory</Link>
      </EmptyState>
    );
  }

  const hasBom = (item.bom || []).length > 0;

  return (
    <>
      <Link
        to="/inventory"
        className="btn sm"
        style={{ marginBottom: 14 }}
      >
        <ArrowLeft size={14} /> Back to Inventory
      </Link>

      <PageHeader
        title={item.name}
        sub="Inventory stock flow · Current stock at every manufacturing stage"
      />

      <div className="strip">
        <div>
          <div className="lab">Item nature</div>
          <div className="v">
            {NATURE[item.itemNature] || 'Inventory item'}
          </div>
        </div>

        <div>
          <div className="lab">Current stock</div>
          <div className="v mono">
            {Number(item.currentStock || 0).toLocaleString('en-IN')} {item.unit || 'units'}
          </div>
        </div>

        <div>
          <div className="lab">Minimum stock</div>
          <div className="v mono">
            {Number(item.minimumStock || 0).toLocaleString('en-IN')} {item.unit || 'units'}
          </div>
        </div>

        <div>
          <div className="lab">BOM components</div>
          <div className="v mono">
            {(item.bom || []).length}
          </div>
        </div>
      </div>

      <div className="legend pf-legend">
        <span><i className="sw t-ok" /> In stock</span>
        <span><i className="sw t-wait" /> Low stock</span>
        <span><i className="sw t-bad" /> Out of stock</span>
        <span className="muted">
          Every card shows the actual current stock of that item.
        </span>
      </div>

      {inventory.missing.length > 0 && (
        <Notice tone="wait">
          Some BOM component references could not be resolved:
          {' '}{inventory.missing.join(', ')}.
          Check these item records before relying on this structure.
        </Notice>
      )}

      {hasBom ? (
        <InventoryCanvas root={inventory.root} />
      ) : (
        <Notice tone="wait">
          This item has no BOM components configured. Its current stock is
          shown above, but there is no manufacturing structure to display.
        </Notice>
      )}
    </>
  );
}
