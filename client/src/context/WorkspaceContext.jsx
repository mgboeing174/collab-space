import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => localStorage.getItem('collabspace_ws_id') || null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all workspaces
  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/workspaces');
      setWorkspaces(res.workspaces || []);

      if (res.workspaces?.length > 0) {
        // If currentWorkspaceId is valid, keep it; otherwise set to first workspace
        const exists = res.workspaces.find(w => w.id === currentWorkspaceId);
        if (!exists) {
          const firstId = res.workspaces[0].id;
          setCurrentWorkspaceId(firstId);
          localStorage.setItem('collabspace_ws_id', firstId);
        }
      } else {
        setCurrentWorkspaceId(null);
        localStorage.removeItem('collabspace_ws_id');
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentWorkspaceId]);

  // Fetch current workspace details
  const fetchCurrentWorkspace = useCallback(async () => {
    if (!user || !currentWorkspaceId) {
      setCurrentWorkspace(null);
      return;
    }
    try {
      const res = await api.get(`/workspaces/${currentWorkspaceId}`);
      setCurrentWorkspace(res);
    } catch (err) {
      console.error('Failed to fetch workspace details:', err);
    }
  }, [user, currentWorkspaceId]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!user || !currentWorkspaceId) return;
    try {
      const res = await api.get(`/activity/workspace/${currentWorkspaceId}`);
      setActivities(res.activities || []);
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    }
  }, [user, currentWorkspaceId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    if (currentWorkspaceId) {
      localStorage.setItem('collabspace_ws_id', currentWorkspaceId);
      fetchCurrentWorkspace();
      fetchActivities();
    }
  }, [currentWorkspaceId, fetchCurrentWorkspace, fetchActivities]);

  // Handle Socket.IO presence for current workspace
  useEffect(() => {
    if (!socket || !connected || !currentWorkspaceId) return;

    socket.emit('join_workspace', { workspaceId: currentWorkspaceId });

    const handlePresence = (data) => {
      if (data.workspaceId === currentWorkspaceId) {
        setOnlineMembers(data.onlineMembers || []);
      }
    };

    socket.on('workspace_presence_update', handlePresence);

    return () => {
      socket.emit('leave_workspace', { workspaceId: currentWorkspaceId });
      socket.off('workspace_presence_update', handlePresence);
    };
  }, [socket, connected, currentWorkspaceId]);

  const switchWorkspace = (wsId) => {
    setCurrentWorkspaceId(wsId);
  };

  const createWorkspace = async (name, description) => {
    const res = await api.post('/workspaces', { name, description });
    await fetchWorkspaces();
    if (res.workspace?.id) {
      switchWorkspace(res.workspace.id);
    }
    return res.workspace;
  };

  const joinWorkspaceByCode = async (inviteCode) => {
    const res = await api.post(`/workspaces/join/${inviteCode}`);
    await fetchWorkspaces();
    if (res.workspaceId) {
      switchWorkspace(res.workspaceId);
    }
    return res;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspaceId,
        currentWorkspace,
        onlineMembers,
        activities,
        loading,
        switchWorkspace,
        createWorkspace,
        joinWorkspaceByCode,
        refreshWorkspaces: fetchWorkspaces,
        refreshCurrentWorkspace: fetchCurrentWorkspace,
        refreshActivities: fetchActivities
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
