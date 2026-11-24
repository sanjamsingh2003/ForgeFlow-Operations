import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, Inbox, Loader2, Lock, X } from 'lucide-react';

const TONE_ICON = { ok: CheckCircle2, wait: Clock, bad: AlertTriangle, idle: Lock };

export function Chip({ tone = 'idle', icon, children, title }) {
  const I = icon === false ? null : icon || TONE_ICON[tone];
  return (
    <span className={`chip t-${tone}`} title={title}>
      {I && <I size={12} />}
      {children}
    </span>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}

export const LoadingState = ({ label = 'Loading…' }) => (
  <div className="state">
    <Loader2 className="spin" size={18} />
    <span>{label}</span>
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="state err">
    <AlertTriangle size={20} />
    <div>
      <b>Could not load data</b>
      <div className="muted">{message}</div>
    </div>
    {onRetry && (
      <button className="btn" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const EmptyState = ({ title, children, icon: I = Inbox }) => (
  <div className="state empty">
    <I size={22} />
    <div>
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  </div>
);

export const Notice = ({ tone = 'wait', children }) => {
  const I = tone === 'bad' ? AlertTriangle : Info;
  return (
    <div className={`notice t-${tone}`}>
      <I size={16} />
      <div>{children}</div>
    </div>
  );
};

function useEsc(onClose) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer }) {
  useEsc(onClose);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  useEsc(onClose);
  return (
    <div className="overlay right" onMouseDown={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export const Progress = ({ done, total }) => (
  <div className="prog">
    <div className="bar">
      <i style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
    </div>
    <span className="mono sm muted">
      {done}/{total}
    </span>
  </div>
);

export const Field = ({ label, hint, children, error }) => (
  <label className="field">
    <span className="fl">{label}</span>
    {children}
    {hint && !error && <span className="hint">{hint}</span>}
    {error && <span className="hint bad">{error}</span>}
  </label>
);

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {list.map((t) => (
          <div key={t.id} className={`toast t-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
