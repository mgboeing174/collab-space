import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import ActivityDrawer from './ActivityDrawer.jsx';

export default function AppLayout() {
  const [activityOpen, setActivityOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' }}>
      <Navbar
        onToggleActivity={() => setActivityOpen(!activityOpen)}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 52px)', position: 'relative' }}>
        {mobileSidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <Sidebar
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: '#fafafa' }}>
          <Outlet />
        </main>
      </div>
      <ActivityDrawer isOpen={activityOpen} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
