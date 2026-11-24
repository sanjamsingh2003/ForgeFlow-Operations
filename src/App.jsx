
import { Link, Route, Routes } from 'react-router-dom';
import { DataProvider } from './hooks.jsx';
import { ToastProvider, EmptyState } from './ui.jsx';
import Shell from './Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import CreateOrder from './pages/CreateOrder.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Flow from './pages/Flow.jsx';
import ProductionTracker from './pages/ProductionTracker.jsx';
import Inventory from './pages/Inventory.jsx';
import InventoryFlow from './pages/InventoryFlow.jsx';
import Movements from './pages/Movements.jsx';
import Production from './pages/Production.jsx';
import GodownFulfilment from './pages/GodownFulfilment.jsx';

const NotFound = () => (
  <EmptyState title="Page not found">
    <Link to="/">Back to the dashboard</Link>
  </EmptyState>
);

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />

            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />

            <Route
              path="orders/:id/flow/:line"
              element={<Flow />}
            />

            <Route
              path="orders/:id/track/:line"
              element={<ProductionTracker />}
            />

            <Route path="inventory" element={<Inventory />} />

            <Route
              path="inventory/:id/flow"
              element={<InventoryFlow />}
            />

            <Route
              path="inventory/movements"
              element={<Movements />}
            />

            <Route
              path="production"
              element={<Production view="queue" />}
            />

            <Route
              path="production/blocked"
              element={<Production view="blocked" />}
            />

            <Route
              path="production/machines"
              element={<Production view="machines" />}
            />

            <Route
              path="godown-fulfilment"
              element={<GodownFulfilment />}
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </DataProvider>
    </ToastProvider>
  );
}
