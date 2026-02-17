import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { useAuth } from "../features/auth/AuthProvider";
import { useAdminStatus } from "../features/auth/useAdminStatus";
import {
  deleteAllReadNotifications,
  markNotificationAsRead,
  watchUserNotifications,
} from "../features/notifications/notifications.service";
import FarmingAssistantFab from "./FarmingAssistantFab";
import "../AppShellTheme.css";

const navItems = [
  {
    label: "Dashboard",
    to: "/app",
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3h8v8H3V3Zm10 0h8v12h-8V3ZM3 13h8v8H3v-8Zm10 4h8v4h-8v-4Z" />
      </svg>
    ),
  },
  {
    label: "Reports",
    to: "/app/reports",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h9.2L20 8.8V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm1 1.8v14.4h12.2V9.6h-4.8V4.8H6Zm2.2 6.1h7.6v1.6H8.2v-1.6Zm0 3.4h7.6v1.6H8.2v-1.6Z" />
      </svg>
    ),
  },
  {
    label: "Monitoring",
    to: "/app/monitoring",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 .2h6v1.8h-6v-1.8Zm0 3.2h6v1.8h-6v-1.8Zm-2.5-4.1L9.4 18l-2-2 1.3-1.3 1 1 1-1 1.8-1.9 1.3 1.3-2.3 2.3Z" />
      </svg>
    ),
  },
  {
    label: "Growth History",
    to: "/app/history/growth",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19h16v2H4v-2Zm2-2V7h2v10H6Zm5 0V3h2v14h-2Zm5 0v-8h2v8h-2Z" />
      </svg>
    ),
  },
  {
    label: "Irrigation History",
    to: "/app/history/irrigation",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2s6 6.4 6 10.5A6 6 0 1 1 6 12.5C6 8.4 12 2 12 2Zm0 3.1c-1.8 2-4 5-4 7.4a4 4 0 1 0 8 0c0-2.4-2.2-5.4-4-7.4Zm-2.8 9.2c0 1.6 1.3 2.9 2.8 2.9v1.8c-2.6 0-4.6-2.1-4.6-4.7h1.8Z" />
      </svg>
    ),
  },
  {
    label: "Pest History",
    to: "/app/history/pest",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a5 5 0 0 1 5 5v1.1l2.1-1.2.9 1.6-2.6 1.5c0 .3.1.6.1.9s0 .6-.1.9l2.6 1.5-.9 1.6-2.1-1.2V16a5 5 0 0 1-10 0v-1.1l-2.1 1.2-.9-1.6 2.6-1.5A5.8 5.8 0 0 1 6.5 12c0-.3 0-.6.1-.9L4 9.6l.9-1.6L7 9.1V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 1 0 6 0V8a3 3 0 0 0-3-3Z" />
      </svg>
    ),
  },
  {
    label: "Fumigation History",
    to: "/app/history/fumigation",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 8h7V5h2v3h9v2h-2v7a2 2 0 0 1-2 2h-2v2h-2v-2H7a2 2 0 0 1-2-2v-7H3V8Zm4 2v7h10v-7H7Zm2.5 2h2v3h-2v-3Zm4 0h2v3h-2v-3Z" />
      </svg>
    ),
  },
  {
    label: "Projection",
    to: "/app/projection",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2-.2v10.6h14V4.8H5Zm2.1 11.8h9.8v1.8H7.1v-1.8Zm1-8.2h2.3v5.4H8.1V8.4Zm3.8-1.6h2.3v7h-2.3v-7Zm3.8 2.2H18v4.8h-2.3V9Z" />
      </svg>
    ),
  },
  {
    label: "Weather",
    to: "/app/weather",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.5 18.8h8.2a4.3 4.3 0 0 0 .4-8.6A5.6 5.6 0 0 0 5.4 9a4.1 4.1 0 0 0 2.1 9.8Zm.1-1.8a2.3 2.3 0 1 1 .5-4.5l1 .2.2-1a3.8 3.8 0 0 1 7.4.8l.1.8h.8a2.5 2.5 0 0 1 0 5H7.6Z" />
      </svg>
    ),
  },
  {
    label: "Users",
    to: "/app/users",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2.5 19c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5V20h-11V19Zm10 1v-1c0-1.1-.4-2.1-1.1-3 .7-.3 1.5-.5 2.3-.5 3 0 5.3 1.8 5.3 4.2V20h-6.5Z" />
      </svg>
    ),
  },
];

const profileItem = {
  label: "Profile",
  to: "/app/profile",
  icon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8a5.2 5.2 0 1 1 0 10.4 5.2 5.2 0 0 1 0-10.4Zm0 12.3c4.7 0 8.5 2.5 8.5 5.6V22h-17v-1.3c0-3.1 3.8-5.6 8.5-5.6Zm0-10.5a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm0 12.3c-3.8 0-6.7 1.9-6.7 3.8v.1h13.4v-.1c0-1.9-2.9-3.8-6.7-3.8Z" />
    </svg>
  ),
};

function navClass({ isActive }) {
  return `app-nav-link ${isActive ? "app-nav-link-active" : ""}`;
}

export default function AppShell() {
  const { user } = useAuth();
  const { isAdmin } = useAdminStatus(user);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [centerOpen, setCenterOpen] = useState(false);
  const [popupNotification, setPopupNotification] = useState(null);
  const [clearingRead, setClearingRead] = useState(false);
  const panelRef = useRef(null);
  const shownPopupIdsRef = useRef(new Set());

  const unreadCount = useMemo(
    () => notifications.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
    [notifications]
  );
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => (item.to === "/app/users" ? isAdmin : true)),
    [isAdmin]
  );

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }
    const unsub = watchUserNotifications(user.uid, (rows) => {
      setNotifications(rows);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!notifications.length) return;
    const nextUnread = notifications.find((item) => !item.read && !shownPopupIdsRef.current.has(item.id));
    if (!nextUnread) return;
    shownPopupIdsRef.current.add(nextUnread.id);
    setPopupNotification(nextUnread);
    const timer = setTimeout(() => setPopupNotification((current) => (current?.id === nextUnread.id ? null : current)), 4500);
    return () => clearTimeout(timer);
  }, [notifications]);

  useEffect(() => {
    function onDocumentClick(event) {
      if (!centerOpen) return;
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target)) {
        setCenterOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [centerOpen]);

  async function onNotificationClick(item) {
    if (!user?.uid || !item?.id) return;
    if (!item.read) {
      try {
        await markNotificationAsRead(user.uid, item.id);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
  }

  async function onDeleteAllRead() {
    if (!user?.uid || clearingRead) return;
    setClearingRead(true);
    try {
      await deleteAllReadNotifications(user.uid);
    } catch (err) {
      console.error("Failed to clear read notifications:", err);
    } finally {
      setClearingRead(false);
    }
  }

  function formatNotificationTime(value) {
    if (!value) return "-";
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "app-shell-collapsed" : ""}`}>
      <header className="app-topbar-wrap">
        <div className="app-topbar">
          <div className="app-topbar-left">
            <button
              type="button"
              className="app-sidebar-toggle app-sidebar-toggle-top"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.6 5.7a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4l-6 6A1 1 0 1 1 8.6 17.7L13.9 12 8.6 6.7a1 1 0 0 1 0-1Z" />
              </svg>
            </button>
            <img src="/assets/sfLogo.png" alt="FarmTrack" className="app-topbar-logo" />
          </div>

          <div className="app-topbar-actions">
            <button type="button" className="app-icon-btn" aria-label="Search" title="Search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m19.8 18.4-4.5-4.5a6.5 6.5 0 1 0-1.4 1.4l4.5 4.5a1 1 0 0 0 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
              </svg>
            </button>
            <button
              type="button"
              className="app-icon-btn app-notification-trigger"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setCenterOpen((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3a5 5 0 0 0-5 5v2.6c0 .8-.3 1.6-.8 2.2l-1 1.3A1 1 0 0 0 6 16h12a1 1 0 0 0 .8-1.6l-1-1.3a3.5 3.5 0 0 1-.8-2.2V8a5 5 0 0 0-5-5Zm0 18a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21Z" />
              </svg>
              {unreadCount > 0 && <span className="app-notification-badge">{unreadCount}</span>}
            </button>
            <button onClick={() => signOut(auth)} className="app-btn app-btn-outline app-logout-btn">
              Logout
            </button>
          </div>
        </div>

        {popupNotification && (
          <div className="app-notification-popup" role="status" aria-live="polite">
            <strong>{popupNotification.title || "Notification"}</strong>
            <p>{popupNotification.message || "-"}</p>
            <button
              type="button"
              className="app-inline-link"
              onClick={() => {
                setCenterOpen(true);
                setPopupNotification(null);
              }}
            >
              Open notification center
            </button>
          </div>
        )}

        {centerOpen && (
          <div className="app-notification-center" ref={panelRef}>
            <div className="app-notification-center-head">
              <div>
                <h3>Notifications</h3>
                <p>{unreadCount} unread</p>
              </div>
              <button type="button" className="app-btn app-btn-outline" onClick={onDeleteAllRead} disabled={clearingRead}>
                {clearingRead ? "Deleting..." : "Delete All Read"}
              </button>
            </div>

            <div className="app-notification-list">
              {notifications.length === 0 && <p className="app-muted">No notifications yet.</p>}
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`app-notification-item ${item.read ? "" : "app-notification-item-unread"}`}
                  onClick={() => onNotificationClick(item)}
                >
                  <div className="app-notification-item-head">
                    <strong>{item.title || "Notification"}</strong>
                    {!item.read && <span className="app-pill app-pill-tight">Unread</span>}
                  </div>
                  <p>{item.message || "-"}</p>
                  <small>{formatNotificationTime(item.createdAt)}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="app-nav">
            {visibleNavItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <span className="app-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="app-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="app-sidebar-bottom">
            <NavLink to={profileItem.to} className={navClass}>
              <span className="app-nav-icon" aria-hidden="true">{profileItem.icon}</span>
              <span className="app-nav-label">{profileItem.label}</span>
            </NavLink>
          </div>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <FarmingAssistantFab />
    </div>
  );
}
