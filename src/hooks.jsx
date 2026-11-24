import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { indexTasks } from './lib.js';

const Ctx = createContext(null);

// One shared load of items, orders, tasks and machines. Pages read from here and call reload() after any action.
export function DataProvider({ children }) {
  const [s, set] = useState({ items: [], orders: [], tasks: [], machines: [], loading: true, error: null, updatedAt: null });

  const reload = useCallback(async () => {
    set((x) => ({ ...x, loading: true, error: null }));
    try {
      const [items, orders, tasks, machines] = await Promise.all([api.items(), api.orders(), api.tasks(), api.machines()]);
      set({ items, orders, tasks, machines, loading: false, error: null, updatedAt: new Date() });
    } catch (e) {
      set((x) => ({ ...x, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const derived = useMemo(
    () => ({ itemsById: new Map(s.items.map((i) => [String(i._id), i])), ...indexTasks(s.tasks) }),
    [s.items, s.tasks]
  );
  return <Ctx.Provider value={{ ...s, ...derived, reload }}>{children}</Ctx.Provider>;
}

export const useCore = () => useContext(Ctx);

export function useFetch(fn) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    set((x) => ({ ...x, loading: true, error: null }));
    fn()
      .then((data) => set({ data, error: null, loading: false }))
      .catch((e) => set({ data: null, error: e.message, loading: false }));
  }, [fn]);
  useEffect(load, [load]);
  return { ...s, reload: load };
}
