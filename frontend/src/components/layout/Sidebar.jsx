import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  {
    label: "Dashboard",
    icon: <IconGrid />,
    to: "/dashboard",
  },
  {
    label: "Monitoring",
    icon: <IconMonitor />,
    children: [
      { label: "Destination Monitor", to: "/monitoring/destinations", icon: <IconGlobe /> },
      { label: "Local Device Monitor", to: "/monitoring/local-devices", icon: <IconServer /> },
    ],
  },
  {
    label: "Routers",
    icon: <IconRouter />,
    children: [
      { label: "Source Routers", to: "/routers", icon: <IconRouter /> },
    ],
  },
  {
    label: "Management",
    icon: <IconSettings2 />,
    children: [
      { label: "Router Management", to: "/management/routers", icon: <IconRouter /> },
      { label: "Destination Mgmt", to: "/management/destinations", icon: <IconGlobe /> },
      { label: "Local Device Mgmt", to: "/management/local-devices", icon: <IconServer /> },
      { label: "Bulk Import", to: "/management/bulk-import", icon: <IconUpload /> },
      { label: "User Management", to: "/management/users", icon: <IconUsers /> },
      { label: "Audit Log", to: "/management/audit-log", icon: <IconLog /> },
    ],
  },
  {
    label: "Reports",
    icon: <IconChart />,
    children: [
      { label: "Destination Reports", to: "/reports/destinations", icon: <IconGlobe /> },
      { label: "Local Device Reports", to: "/reports/local-devices", icon: <IconServer /> },
      { label: "Uptime Reports", to: "/reports/uptime", icon: <IconClock /> },
      { label: "Alert Reports", to: "/reports/alerts", icon: <IconBell /> },
    ],
  },
  {
    label: "Settings",
    icon: <IconSettings />,
    to: "/settings",
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isGroupActive = (children) =>
    children?.some((c) => location.pathname.startsWith(c.to));

  return (
    <aside style={styles.aside}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div>
          <div style={styles.logoTitle}>Monitoring</div>
          <div style={styles.logoSub}>Panel</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {NAV.map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} isActive={isGroupActive(item.children)} />
          ) : (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navActive : {}) })}>
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* User */}
      <div style={styles.userArea}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div style={{ overflow: "hidden" }}>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userRole}>{user?.role?.replace("_", " ")}</div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn} title="Logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ item, isActive }) {
  const [open, setOpen] = React.useState(isActive);
  const location = useLocation();

  React.useEffect(() => {
    if (item.children?.some((c) => location.pathname.startsWith(c.to))) setOpen(true);
  }, [location.pathname]);

  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ ...styles.navItem, width: "100%", justifyContent: "space-between", ...(isActive ? styles.navGroupActive : {}) }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={styles.navIcon}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={styles.subNav}>
          {item.children.map((child) => (
            <NavLink key={child.to} to={child.to} style={({ isActive }) => ({ ...styles.subItem, ...(isActive ? styles.subActive : {}) })}>
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";

const styles = {
  aside: {
    width: "var(--sidebar-width)",
    background: "var(--sidebar-bg)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "sticky",
    top: 0,
    flexShrink: 0,
    overflowY: "auto",
    overflowX: "hidden",
  },
  logo: {
    padding: "18px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  logoIcon: {
    width: 34,
    height: 34,
    background: "var(--primary)",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoTitle: { fontSize: "0.9rem", fontWeight: 700, color: "#fff", lineHeight: 1.1 },
  logoSub: { fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" },
  nav: { flex: 1, padding: "8px 8px", overflowY: "auto" },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: "0.82rem",
    color: "var(--sidebar-text)",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    marginBottom: 1,
    transition: "background 0.15s, color 0.15s",
  },
  navActive: {
    background: "var(--primary)",
    color: "#fff",
  },
  navGroupActive: {
    color: "#fff",
  },
  navIcon: { width: 16, height: 16, flexShrink: 0, opacity: 0.7 },
  subNav: { paddingLeft: 26, marginBottom: 4 },
  subItem: {
    display: "block",
    padding: "6px 10px",
    borderRadius: 5,
    fontSize: "0.78rem",
    color: "rgba(203,213,225,0.7)",
    cursor: "pointer",
    marginBottom: 1,
    transition: "background 0.15s, color 0.15s",
  },
  subActive: {
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
  },
  userArea: {
    padding: "12px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  userInfo: { flex: 1, display: "flex", alignItems: "center", gap: 8, overflow: "hidden" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--primary)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: { fontSize: "0.8rem", color: "#e2e8f0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", textTransform: "capitalize" },
  logoutBtn: { color: "rgba(203,213,225,0.5)", padding: 4, borderRadius: 4, cursor: "pointer", flexShrink: 0, "&:hover": { color: "#fff" } },
};

function IconGrid() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function IconMonitor() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>; }
function IconGlobe() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>; }
function IconServer() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>; }
function IconRouter() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="20" height="8" rx="2"/><line x1="6" y1="13" x2="6.01" y2="13"/><line x1="10" y1="13" x2="10.01" y2="13"/><path d="M15 9V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2"/><line x1="18" y1="9" x2="18" y2="17"/></svg>; }
function IconDoc() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function IconSettings2() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>; }
function IconUpload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>; }
function IconUsers() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>; }
function IconLog() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>; }
function IconChart() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IconClock() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconBell() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>; }
function IconSettings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>; }
