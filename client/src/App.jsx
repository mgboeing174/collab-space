import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { DialogProvider } from './context/DialogContext.jsx';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorkspacesPage from './pages/WorkspacesPage.jsx';
import WorkspaceDetailPage from './pages/WorkspaceDetailPage.jsx';
import DocumentEditorPage from './pages/DocumentEditorPage.jsx';
import WhiteboardPage from './pages/WhiteboardPage.jsx';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage.jsx';
import InviteAcceptPage from './pages/InviteAcceptPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AppLayout from './components/layout/AppLayout.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888888' }}>
        Loading CollabSpace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <WorkspaceProvider>
            <DialogProvider>
              <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/join/:inviteCode" element={<InviteAcceptPage />} />

              {/* Protected Workspace Independent Routes */}
              <Route
                path="/workspaces"
                element={
                  <ProtectedRoute>
                    <WorkspacesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Workspace Context Routes (with AppLayout Navbar & Sidebar) */}
              <Route
                path="/workspace/:workspaceId"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<WorkspaceDetailPage />} />
                <Route path="doc/:docId" element={<DocumentEditorPage />} />
                <Route path="whiteboard/:whiteboardId" element={<WhiteboardPage />} />
                <Route path="settings" element={<WorkspaceSettingsPage />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/workspaces" replace />} />
            </Routes>
          </DialogProvider>
        </WorkspaceProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
