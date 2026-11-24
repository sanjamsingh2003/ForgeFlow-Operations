import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Factory,
  LayoutGrid,
  List,
  PackageCheck,
  Plus,
  Search,
} from 'lucide-react';

import { useCore } from '../hooks.jsx';
import { Chip, EmptyState, ErrorState, LoadingState } from '../ui.jsx';
import { dueState, fmtDate, workloadProgress } from '../lib.js';

import './Orders.css';

const PAGE_SIZE = 8;

const TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'production', label: 'In Production' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'completed', label: 'Completed' },
];

function getFulfilmentMethod(order) {
  const lines = order.orderedItems || [];
  if (!lines.length) return 'unavailable';

  const quantities = lines.map((line) => ({
    ordered: Number(line.quantity),
    reserved: Number(line.reservedQuantity ?? 0),
  }));

  if (quantities.some((line) =>
    !Number.isFinite(line.ordered) ||
    !Number.isFinite(line.reserved) ||
    line.ordered <= 0 ||
    line.reserved < 0
  )) {
    return 'unavailable';
  }

  const allFromStock = quantities.every(
    (line) => line.reserved >= line.ordered
  );

  const noneFromStock = quantities.every(
    (line) => line.reserved === 0
  );

  if (allFromStock) return 'stock';
  if (noneFromStock) return 'manufacturing';
  return 'mixed';
}

function getOrderCategory(order, tasks) {
  if (order.status === 'Cancelled') return 'cancelled';

  const allTasksCompleted =
    tasks.length > 0 &&
    tasks.every((task) => task.status === 'COMPLETED');

  if (order.status === 'Completed' || allTasksCompleted) {
    return 'completed';
  }

  // Any order with unfinished manufacturing tasks is In Production.
  // Blocked tasks are tracked separately in the Blocked tab.
  if (tasks.length > 0) return 'production';

  return 'pending';
}

function getCategoryLabel(category) {
  return {
    pending: 'Pending',
    production: 'In Production',
    blocked: 'Blocked',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[category] || 'Unknown';
}

function getCategoryTone(category) {
  return {
    pending: 'wait',
    production: 'info',
    blocked: 'bad',
    completed: 'ok',
    cancelled: 'idle',
  }[category] || 'idle';
}

function getOrderProgress(tasks) {
  if (!tasks.length) return null;

  const validPlanning = tasks.every((task) => {
    const quantity = Number(task.quantityRequired);
    const time = Number(task.estimatedTimePerUnit);

    return (
      task.quantityRequired !== null &&
      task.quantityRequired !== undefined &&
      task.estimatedTimePerUnit !== null &&
      task.estimatedTimePerUnit !== undefined &&
      Number.isFinite(quantity) &&
      Number.isFinite(time) &&
      quantity >= 0 &&
      time >= 0
    );
  });

  if (!validPlanning) return null;

  const result = workloadProgress(tasks);
  return result.totalWork > 0 ? result.percentage : null;
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function OrderStatus({ category }) {
  return (
    <Chip tone={getCategoryTone(category)}>
      {category === 'completed' && <CheckCircle2 size={14} />}
      {category === 'production' && <Factory size={14} />}
      {category === 'blocked' && <Clock3 size={14} />}
      {category === 'pending' && <Clock3 size={14} />}
      {category === 'cancelled' && <Clock3 size={14} />}
      {getCategoryLabel(category)}
    </Chip>
  );
}

function ProductionProgress({ tasks, category }) {
  if (category === 'completed') {
    return (
      <div className="orders-progress-covered">
        <CheckCircle2 size={17} />
        <span>Completed</span>
      </div>
    );
  }

  if (category === 'pending') {
    return <span className="orders-unavailable">Not started</span>;
  }

  if (category === 'cancelled') {
    return <span className="orders-unavailable">Cancelled</span>;
  }

  const percentage = getOrderProgress(tasks);

  if (percentage === null) {
    return <span className="orders-unavailable">Unavailable</span>;
  }

  const tone =
    percentage >= 70 ? 'green' :
    percentage >= 35 ? 'amber' : 'red';

  return (
    <div className="orders-progress">
      <div className="orders-progress-track">
        <span
          className={`orders-progress-fill ${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="orders-progress-value">{percentage}%</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, note }) {
  const graphs = {
    lime: 'M0 66 L17 58 L34 61 L51 45 L68 50 L85 36 L102 40 L119 25 L136 30 L153 14 L180 5',
    blue: 'M0 69 L17 61 L34 64 L51 48 L68 53 L85 38 L102 43 L119 27 L136 32 L153 16 L180 6',
    amber: 'M0 68 L17 60 L34 64 L51 47 L68 52 L85 37 L102 42 L119 26 L136 31 L153 15 L180 5',
    green: 'M0 67 L17 59 L34 63 L51 46 L68 51 L85 35 L102 41 L119 24 L136 29 L153 13 L180 4',
  };

  const graphId = `orders-graph-${tone}`;

  return (
    <article className={`orders-summary-card ${tone}`}>
      <div className="orders-summary-top">
        <span className="orders-summary-icon">
          <Icon size={23} strokeWidth={2.2} />
        </span>
        <span className="orders-summary-label">{label}</span>
      </div>

      <div className="orders-summary-bottom">
        <strong>{value}</strong>
        <span>{note}</span>
      </div>

      <svg
        className="orders-summary-chart"
        viewBox="0 0 180 90"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={graphId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity=".25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={`${graphs[tone]} L180 90 L0 90 Z`}
          fill={`url(#${graphId})`}
        />
        <path d={graphs[tone]} className="orders-summary-chart-line" />
      </svg>
    </article>
  );
}

export default function Orders() {
  const { orders, tasksByOrder, updatedAt, error, reload } = useCore();
  const navigate = useNavigate();
  const location = useLocation();

  const restoredView = location.state?.restoreOrdersView || location.state?.ordersView || {};
  const requestedTab = new URLSearchParams(location.search).get('status');

  // Dashboard's View all link opens the matching Orders filter directly.
  // A saved in-page view takes precedence when returning from an order detail.
  const [activeTab, setActiveTab] = useState(
    restoredView.activeTab || (requestedTab === 'production' ? 'production' : 'all')
  );
  const [query, setQuery] = useState(restoredView.query || '');
  const [orderDateFilter, setOrderDateFilter] = useState(restoredView.orderDateFilter || 'all');
  const [dueDateFilter, setDueDateFilter] = useState(restoredView.dueDateFilter || 'all');
  const [sortBy, setSortBy] = useState(restoredView.sortBy || 'due-asc');
  const [view, setView] = useState(restoredView.view || 'list');
  const [page, setPage] = useState(restoredView.page || 1);
  const [customFrom, setCustomFrom] = useState(restoredView.customFrom || '');
  const [customTo, setCustomTo] = useState(restoredView.customTo || '');

  // Persist the live Orders view in this browser-history entry so Back restores it.
  useEffect(() => {
    const ordersView = {
      activeTab,
      query,
      orderDateFilter,
      dueDateFilter,
      sortBy,
      view,
      page,
      customFrom,
      customTo,
    };

    navigate(location.pathname + location.search, {
      replace: true,
      state: {
        ...(location.state || {}),
        ordersView,
      },
    });
  }, [
    activeTab,
    query,
    orderDateFilter,
    dueDateFilter,
    sortBy,
    view,
    page,
    customFrom,
    customTo,
    location.pathname,
    location.search,
    navigate,
  ]);

  const openOrder = (orderId) => {
  navigate(`/orders/${orderId}`, {
    state: {
      returnTo: location.pathname + location.search,
      ordersView: {
        activeTab,
        query,
        orderDateFilter,
        dueDateFilter,
        sortBy,
        view,
        page,
        customFrom,
        customTo,
      },
    },
  });
};

  const orderData = useMemo(() => {
    return orders.map((order) => {
      const tasks = tasksByOrder.get(String(order._id)) || [];
      const category = getOrderCategory(order, tasks);

      return {
        order,
        tasks,
        category,
        progress: getOrderProgress(tasks),
        fulfilment: getFulfilmentMethod(order),
        due: dateValue(order.dueDate),
        created: dateValue(order.createdAt),
        dueInfo: dueState(order),
      };
    });
  }, [orders, tasksByOrder]);

  const counts = useMemo(() => {
    const result = {
      all: orderData.length,
      pending: 0,
      production: 0,
      blocked: 0,
      completed: 0,
      cancelled: 0,
      dueSoon: 0,
      stockFulfilled: 0,
    };

    orderData.forEach((entry) => {
      result[entry.category] += 1;
      // Blocked is an independent count: an order can be
// In Production and also have one or more blocked tasks.
if (entry.tasks.some((task) => task.status === 'BLOCKED')) {
  result.blocked += 1;
}

      if (
        entry.category === 'completed' &&
        entry.fulfilment === 'stock'
      ) {
        result.stockFulfilled += 1;
      }

      if (
        !['completed', 'cancelled'].includes(entry.category) &&
        entry.dueInfo.days !== null &&
        entry.dueInfo.days >= 0 &&
        entry.dueInfo.days <= 7
      ) {
        result.dueSoon += 1;
      }
    });

    return result;
  }, [orderData]);

  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = orderData.filter((entry) => {
      const { order, category, due, created } = entry;

     if (activeTab === 'blocked') {
  if (!entry.tasks.some((task) => task.status === 'BLOCKED')) {
    return false;
  }
} else if (activeTab !== 'all' && category !== activeTab) {
  return false;
}

      const searchText =
        `${order.orderId || ''} ${order.clientName || ''}`.toLowerCase();

      if (!searchText.includes(query.trim().toLowerCase())) return false;

      if (orderDateFilter !== 'all') {
        if (!created) return false;

        if (orderDateFilter === '7d') {
          const boundary = new Date(today);
          boundary.setDate(boundary.getDate() - 6);
          if (created < boundary) return false;
        }

        if (orderDateFilter === '30d') {
          const boundary = new Date(today);
          boundary.setDate(boundary.getDate() - 29);
          if (created < boundary) return false;
        }

        if (orderDateFilter === '3m') {
          const boundary = new Date(today);
          boundary.setMonth(boundary.getMonth() - 3);
          if (created < boundary) return false;
        }

        if (orderDateFilter === 'custom') {
          if (customFrom) {
            const from = new Date(`${customFrom}T00:00:00`);
            if (created < from) return false;
          }

          if (customTo) {
            const to = new Date(`${customTo}T23:59:59.999`);
            if (created > to) return false;
          }
        }
      }

      if (dueDateFilter === 'overdue') {
        if (!due || entry.dueInfo.days === null || entry.dueInfo.days >= 0) {
          return false;
        }
      }

      if (dueDateFilter === '7d') {
        if (
          !due ||
          entry.dueInfo.days === null ||
          entry.dueInfo.days < 0 ||
          entry.dueInfo.days > 7
        ) {
          return false;
        }
      }

      if (dueDateFilter === '30d') {
        if (
          !due ||
          entry.dueInfo.days === null ||
          entry.dueInfo.days < 0 ||
          entry.dueInfo.days > 30
        ) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return (b.created?.getTime() || 0) - (a.created?.getTime() || 0);
      }

      if (sortBy === 'oldest') {
        return (a.created?.getTime() || 0) - (b.created?.getTime() || 0);
      }

      if (sortBy === 'due-desc') {
        return (b.due?.getTime() || 0) - (a.due?.getTime() || 0);
      }

      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;

      return a.due - b.due;
    });

    return filtered;
  }, [
    orderData,
    activeTab,
    query,
    orderDateFilter,
    dueDateFilter,
    sortBy,
    customFrom,
    customTo,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleOrders = filteredOrders.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const resetPage = (callback) => {
    callback();
    setPage(1);
  };

  if (!updatedAt) {
    return error
      ? <ErrorState message={error} onRetry={reload} />
      : <LoadingState />;
  }

  return (
    <div className="orders-page">
      <div className="orders-heading">
        <div className="orders-heading-main">
          <button
            type="button"
            className="orders-back"
            onClick={() => navigate('/')}
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <ArrowLeft size={22} />
          </button>

          <div>
            <h1>Orders</h1>
            <p>
              Manage customer orders, track production progress,
              and ensure on-time delivery.
            </p>
          </div>
        </div>

        <div className="orders-heading-actions">
          <span className="orders-updated">
            Updated {updatedAt.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          <button
            type="button"
            className="btn primary orders-create-button"
            onClick={() => navigate('/orders/new')}
          >
            <Plus size={18} />
            Create Order
          </button>
        </div>
      </div>

      <section className="orders-summary">
        <SummaryCard
          icon={ClipboardList}
          label="Total Orders"
          value={counts.all}
          tone="lime"
          note="All customer orders"
        />

        <SummaryCard
          icon={Factory}
          label="In Production"
          value={counts.production}
          tone="blue"
          note="Orders with manufacturing tasks"
        />

        <SummaryCard
          icon={CalendarDays}
          label="Due Soon (≤ 7 days)"
          value={counts.dueSoon}
          tone="amber"
          note="Active orders approaching deadline"
        />

        <SummaryCard
          icon={PackageCheck}
          label="Stock Fulfilled"
          value={counts.stockFulfilled}
          tone="green"
          note="Completed entirely from stock"
        />
      </section>

      <nav className="orders-tabs" aria-label="Order categories">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`orders-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => resetPage(() => setActiveTab(tab.id))}
          >
            <span>{tab.label}</span>
            <span className="orders-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </nav>

      <section className="orders-workspace">
        <div className="orders-toolbar">
          <div className="orders-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) =>
                resetPage(() => setQuery(event.target.value))
              }
              placeholder="Search by order ID or customer..."
              aria-label="Search orders"
            />
          </div>

          <div className="orders-filter">
            <CalendarDays size={18} />
            <select
              value={orderDateFilter}
              onChange={(event) =>
                resetPage(() => setOrderDateFilter(event.target.value))
              }
              aria-label="Filter by order creation date"
            >
              <option value="7d">Order Date: Last 7 Days</option>
              <option value="30d">Order Date: Last 30 Days</option>
              <option value="3m">Order Date: Last 3 Months</option>
              <option value="all">Order Date: All Time</option>
              <option value="custom">Order Date: Custom Range</option>
            </select>
          </div>

          <div className="orders-filter">
            <CalendarDays size={18} />
            <select
              value={dueDateFilter}
              onChange={(event) =>
                resetPage(() => setDueDateFilter(event.target.value))
              }
              aria-label="Filter by due date"
            >
              <option value="all">Due Date: All</option>
              <option value="overdue">Overdue</option>
              <option value="7d">Due in 7 Days</option>
              <option value="30d">Due in 30 Days</option>
            </select>
          </div>

          <div className="orders-filter orders-sort">
            <ArrowDownUp size={18} />
            <select
              value={sortBy}
              onChange={(event) =>
                resetPage(() => setSortBy(event.target.value))
              }
              aria-label="Sort orders"
            >
              <option value="due-asc">Sort: Due Date ↑</option>
              <option value="due-desc">Sort: Due Date ↓</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <div className="orders-view-toggle" aria-label="Change order view">
            <button
              type="button"
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
              aria-label="List view"
              title="List view"
            >
              <List size={20} />
            </button>
            <button
              type="button"
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {orderDateFilter === 'custom' && (
          <div className="orders-custom-range">
            <strong>Order creation date:</strong>
            <label>
              From
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) =>
                  resetPage(() => setCustomFrom(event.target.value))
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) =>
                  resetPage(() => setCustomTo(event.target.value))
                }
              />
            </label>
          </div>
        )}

        {visibleOrders.length === 0 ? (
          <EmptyState
            title={orders.length ? 'No matching orders' : 'No orders yet'}
            icon={ClipboardList}
          >
            {orders.length
              ? 'Try changing your search or date filters.'
              : <Link to="/orders/new">Create your first order</Link>}
          </EmptyState>
        ) : view === 'list' ? (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Order Date</th>
                  <th>Due Date</th>
                  <th>Production Progress</th>
                  <th>Status</th>
                  <th className="orders-actions-heading">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleOrders.map(({ order, tasks, category, dueInfo }) => (
                  <tr
                    key={order._id}
                    onClick={() => openOrder(order._id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                       openOrder(order._id);
                      }
                    }}
                    tabIndex={0}
                    className="orders-table-row"
                  >
                    <td>
                      <span className="orders-id">{order.orderId}</span>
                    </td>
                    <td>
                      <span className="orders-customer">{order.clientName}</span>
                    </td>
                    <td>
                      <span className="orders-date">
                        {fmtDate(order.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="orders-due-cell">
                        <span className="orders-date">
                          {fmtDate(order.dueDate)}
                        </span>
                        {!['completed', 'cancelled'].includes(category) &&
                          dueInfo.days !== null &&
                          dueInfo.days <= 7 && (
                            <span className={`orders-due-hint ${dueInfo.days < 0 ? 'overdue' : ''}`}>
                              {dueInfo.label}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="orders-progress-cell">
                      <ProductionProgress tasks={tasks} category={category} />
                    </td>
                    <td>
                      <OrderStatus category={category} />
                    </td>
                    <td className="orders-actions-cell">
                      <button
                        type="button"
                        className="orders-open-button"
                        aria-label={`View ${order.orderId}`}
                        title="View order details"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOrder(order._id);
                        }}
                      >
                        <ArrowRight size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="orders-grid">
            {visibleOrders.map(({ order, tasks, category, dueInfo }) => (
              <button
                type="button"
                className="orders-grid-card"
                key={order._id}
                onClick={() => openOrder(order._id)}
              >
                <div className="orders-grid-card-top">
                  <span className="orders-id">{order.orderId}</span>
                  <ArrowRight size={19} />
                </div>

                <strong className="orders-grid-customer">
                  {order.clientName}
                </strong>

                <div className="orders-grid-dates">
                  <span>
                    <CalendarDays size={15} />
                    Ordered: {fmtDate(order.createdAt)}
                  </span>
                  <span>
                    <Clock3 size={15} />
                    Due: {fmtDate(order.dueDate)}
                  </span>
                </div>

                <div className="orders-grid-progress">
                  <span>Production Progress</span>
                  <ProductionProgress tasks={tasks} category={category} />
                </div>

                <div className="orders-grid-status">
                  <OrderStatus category={category} />
                  {!['completed', 'cancelled'].includes(category) &&
                    dueInfo.days !== null &&
                    dueInfo.days <= 7 && (
                      <span className={`orders-due-hint ${dueInfo.days < 0 ? 'overdue' : ''}`}>
                        {dueInfo.label}
                      </span>
                    )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="orders-pagination">
          <span>
            Showing {filteredOrders.length ? startIndex + 1 : 0}–
            {Math.min(startIndex + PAGE_SIZE, filteredOrders.length)} of{' '}
            {filteredOrders.length} orders
          </span>

          <div className="orders-pagination-controls">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={19} />
            </button>

            <span>Page {currentPage} of {totalPages}</span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}