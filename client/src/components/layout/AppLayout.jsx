import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';
import ActivityDrawer from './ActivityDrawer.jsx';

export default function AppLayout() {
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' }}>
      <Navbar onToggleActivity={() => setActivityOpen(!activityOpen)} />
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 52px)' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundColor: '#fafafa' }}>
          <Outlet />
        </main>
      </div>
      <ActivityDrawer isOpen={activityOpen} onClose={() => setActivityOpen(false)} />
    </div>
  );
}
