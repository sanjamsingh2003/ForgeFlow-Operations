// All backend calls live here. Shapes match the controllers: { success, data, ... }.
const BASE = import.meta.env.VITE_API_URL || '/api';

async function req(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the backend. Check that the server is running.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `Request failed (${res.status})`);
  return json;
}

export const api = {
  items: () => req('/items').then((r) => r.data),
  createItem: (body) => req('/items', { method: 'POST', body }),
  updateItem: (id, body) => req(`/items/${id}`, { method: 'PUT', body }),
  orders: () => req('/orders').then((r) => r.data),
  createOrder: (body) => req('/orders', { method: 'POST', body }),
  tasks: () => req('/tasks').then((r) => r.data),
  completeTask: (id, body) => req(`/tasks/complete/${id}`, { method: 'POST', body }),
  machines: () => req('/machines').then((r) => r.data),
  movements: () => req('/inventory-movements').then((r) => r.data),
};
