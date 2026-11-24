import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Menu,
  Package,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCore } from './hooks.jsx';

const NAV = [
  {
    key: 'dash',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/',
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: ClipboardList,
    base: '/orders',
    subs: [
      { to: '/orders', label: 'All orders', end: true },
      { to: '/orders/new', label: 'Create order' },
    ],
  },
  {
    key: 'inv',
    label: 'Inventory',
    icon: Package,
    base: '/inventory',
    subs: [
      { to: '/inventory', label: 'Stock overview', end: true },
      { to: '/inventory/movements', label: 'Movement history' },
    ],
  },
  {
    key: 'prod',
    label: 'Production',
    icon: Factory,
    base: '/production',
    subs: [
      { to: '/production', label: 'Task queue', end: true },
      {
        to: '/production/blocked',
        label: 'Blocked tasks',
        badge: 'blocked',
      },
      { to: '/production/machines', label: 'Machines' },
    ],
  },
];

function titleFor(path) {
  if (path === '/') return 'Dashboard';
  if (path.includes('/flow/')) return 'Production flow';
  if (path === '/orders/new') return 'Create order';
  if (path.startsWith('/orders')) return 'Orders';
  if (path.startsWith('/inventory/movements')) {
    return 'Inventory · Movements';
  }
  if (path.startsWith('/inventory')) return 'Inventory';
  if (path.startsWith('/production/blocked')) return 'Blocked tasks';
  if (path.startsWith('/production/machines')) return 'Machines';
  if (path.startsWith('/production')) return 'Production';
  return 'ForgeFlow';
}

function BrandMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 3 29 9.2v12.1L18 27.5 7 21.3V9.2L18 3Z"
        fill="#A3E635"
        fillOpacity=".16"
        stroke="#A3E635"
        strokeWidth="1.4"
      />
      <path
        d="M18 3v12.2m0 0L7 21.3m11-6.1 11 6.1"
        stroke="#A3E635"
        strokeWidth="1.4"
      />
      <path
        d="m18 8 6 3.4v6.8l-6 3.4-6-3.4v-6.8L18 8Z"
        fill="#A3E635"
      />
    </svg>
  );
}

export default function Shell() {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();

  // Preserve the Orders filters when navigating back from an order detail page.
  const ordersRestoreState = location.state?.ordersView
    ? { restoreOrdersView: location.state.ordersView }
    : undefined;

  const {
    tasks,
    loading,
    updatedAt,
    reload,
    error,
  } = useCore();

  const [mobile, setMobile] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches
  );
  const [open, setOpen] = useState({});

  // Keep the navigation mode in sync when the browser crosses the mobile breakpoint.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)');

    const handleViewportChange = (event) => {
      setIsMobileViewport(event.matches);
      if (!event.matches) setMobile(false);
    };

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  const blocked = tasks.filter(
    (task) => task.status === 'BLOCKED'
  ).length;

  const closeMobileMenu = () => setMobile(false);

  const handleMenuToggle = () => {
    if (isMobileViewport) {
      setMobile((current) => !current);
      return;
    }

    setDesktopCollapsed((current) => !current);
  };

  const handleSectionClick = (section) => {
    // In icon-only mode, selecting a section opens its landing page.
    if (desktopCollapsed && !isMobileViewport) {
      navigate(
        section.subs[0].to,
        section.base === '/orders' ? { state: ordersRestoreState } : undefined
      );
      return;
    }

    const active = pathname.startsWith(section.base);
    const isOpen = open[section.key] ?? active;
    const nextOpen = !isOpen;

    setOpen((previous) => ({
      ...previous,
      [section.key]: nextOpen,
    }));

    if (nextOpen && !active) {
      navigate(
        section.subs[0].to,
        section.base === '/orders' ? { state: ordersRestoreState } : undefined
      );
      closeMobileMenu();
    }
  };

  const updatedTime = updatedAt
    ? updatedAt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={`app${desktopCollapsed && !isMobileViewport ? ' sidebar-collapsed' : ''}`}
    >
      {mobile && (
        <button
          type="button"
          className="scrim"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        id="forgeflow-sidebar"
        className={`side${mobile ? ' open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand-row">
          <Link
            to="/"
            className="brand"
            onClick={closeMobileMenu}
          >
            <BrandMark />

            <span>
              <b>ForgeFlow</b>
              <small>OPERATIONS</small>
            </span>
          </Link>

          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section-label">
          WORKSPACE
        </div>

        <nav className="sidebar-nav">
          {NAV.map((section) => {
            const Icon = section.icon;

            if (!section.subs) {
              return (
                <NavLink
                  key={section.key}
                  to={section.to}
                  end
                  className={({ isActive }) =>
                    `nav-s${isActive ? ' active' : ''}`
                  }
                  title={desktopCollapsed && !isMobileViewport ? section.label : undefined}
                  onClick={closeMobileMenu}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{section.label}</span>
                </NavLink>
              );
            }

            const active = pathname.startsWith(section.base);
            const isOpen = open[section.key] ?? active;

            return (
              <div
                key={section.key}
                className={`nav-group${active ? ' current' : ''}`}
              >
                <button
                  type="button"
                  className={`nav-s${active ? ' active' : ''}`}
                  title={desktopCollapsed && !isMobileViewport ? section.label : undefined}
                  aria-label={desktopCollapsed && !isMobileViewport ? section.label : undefined}
                  onClick={() => handleSectionClick(section)}
                  aria-expanded={isOpen && !(desktopCollapsed && !isMobileViewport)}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{section.label}</span>

                  {isOpen ? (
                    <ChevronDown
                      className="chev"
                      size={15}
                    />
                  ) : (
                    <ChevronRight
                      className="chev"
                      size={15}
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="subs">
                    {section.subs.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end={sub.end}
                        state={sub.to === '/orders' ? ordersRestoreState : undefined}
                        className={({ isActive }) =>
                          `sub${isActive ? ' active' : ''}`
                        }
                        onClick={closeMobileMenu}
                      >
                        <span>{sub.label}</span>

                        {sub.badge === 'blocked' &&
                          blocked > 0 && (
                            <span className="count bad">
                              {blocked}
                            </span>
                          )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-mark">
            <Factory size={18} />
          </div>

          <div className="sidebar-footer-copy">
            <strong>From Orders to Output</strong>
            <span>Keep production moving.</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button
            type="button"
            className="icon-btn burger"
            onClick={handleMenuToggle}
            aria-label={
              isMobileViewport
                ? mobile ? 'Close navigation menu' : 'Open navigation menu'
                : desktopCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'
            }
            aria-controls="forgeflow-sidebar"
            aria-expanded={isMobileViewport ? mobile : !desktopCollapsed}
          >
            <Menu size={19} />
          </button>

          <div className="top-page">
            <span className="top-eyebrow">FORGEFLOW</span>
            <strong className="top-title">
              {titleFor(pathname)}
            </strong>
          </div>

          <span className="grow" />

          {error && (
            <span
              className="sm top-error"
              role="status"
            >
              Refresh failed
            </span>
          )}

          {updatedTime && (
            <span className="mono sm muted hide-sm">
              Updated {updatedTime}
            </span>
          )}

          <button
            type="button"
            className="btn refresh-btn"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              className={loading ? 'spin' : ''}
            />
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
