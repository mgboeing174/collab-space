import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Users, Share2 } from 'lucide-react';
import { api } from '../utils/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas.jsx';
import Avatar from '../components/common/Avatar.jsx';
import ShareResourceModal from '../components/common/ShareResourceModal.jsx';

export default function WhiteboardPage() {
  const { workspaceId, whiteboardId } = useParams();
  const { socket } = useSocket();
  const { refreshCurrentWorkspace } = useWorkspace();
  const { confirm, toast } = useDialog();
  const navigate = useNavigate();

  const [whiteboard, setWhiteboard] = useState(null);
  const [activeBoardUsers, setActiveBoardUsers] = useState([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWhiteboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/whiteboards/${whiteboardId}`);
      setWhiteboard(res.whiteboard);
    } catch (err) {
      console.error('Failed to load whiteboard:', err);
      setError(err.message || 'Failed to load whiteboard.');
    } finally {
      setLoading(false);
    }
  }, [whiteboardId]);

  useEffect(() => {
    fetchWhiteboard();
  }, [fetchWhiteboard]);

  // Socket whiteboard room presence
  useEffect(() => {
    if (!socket || !whiteboardId) return;

    socket.emit('join_whiteboard', { whiteboardId });

    const handlePresence = (data) => {
      if (data.whiteboardId === whiteboardId) {
        setActiveBoardUsers(data.activeUsers || []);
      }
    };

    socket.on('whiteboard_presence_update', handlePresence);

    return () => {
      socket.emit('leave_whiteboard', { whiteboardId });
      socket.off('whiteboard_presence_update', handlePresence);
    };
  }, [socket, whiteboardId]);

  const handleTitleBlur = async (newTitle) => {
    if (!newTitle.trim() || newTitle === whiteboard?.title) return;
    try {
      setWhiteboard((prev) => ({ ...prev, title: newTitle.trim() }));
      await api.put(`/whiteboards/${whiteboardId}`, { title: newTitle.trim() });
      await refreshCurrentWorkspace();
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${whiteboard?.title}"?`,
      message: 'This collaborative whiteboard and all its elements will be permanently deleted.',
      confirmText: 'Delete Whiteboard',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await api.delete(`/whiteboards/${whiteboardId}`);
      await refreshCurrentWorkspace();
      toast({ title: 'Whiteboard deleted', type: 'info' });
      navigate(`/workspace/${workspaceId}`);
    } catch (err) {
      console.error('Failed to delete whiteboard:', err);
      toast({ title: 'Delete failed', message: err.message, type: 'error' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#888888', fontSize: '14px' }}>
        Loading whiteboard canvas...
      </div>
    );
  }

  if (error || !whiteboard) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <button onClick={() => navigate(`/workspace/${workspaceId}`)} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          <ArrowLeft size={13} />
          <span>Back to Workspace</span>
        </button>
        <div style={{ color: '#111111', fontSize: '15px' }}>{error || 'Whiteboard not found'}</div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column' }}>
      {/* Whiteboard Top Navigation Bar */}
      <div
        style={{
          height: '46px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 6px' }}
            title="Back to workspace"
          >
            <ArrowLeft size={15} />
          </button>

          <input
            type="text"
            defaultValue={whiteboard.title}
            onBlur={(e) => handleTitleBlur(e.target.value)}
            style={{
              fontSize: '14.5px',
              fontWeight: 600,
              color: '#111111',
              border: 'none',
              background: 'transparent',
              padding: '2px 6px',
              outline: 'none',
              width: '260px'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active Collaborators on Whiteboard */}
          {activeBoardUsers.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f5f5f5',
                padding: '2px 8px 2px 4px',
                borderRadius: '16px'
              }}
              title="Active on this whiteboard"
            >
              <div style={{ display: 'flex', marginLeft: '2px' }}>
                {activeBoardUsers.slice(0, 3).map((u, i) => (
                  <div key={u.userId || i} style={{ marginLeft: i > 0 ? '-6px' : 0 }}>
                    <Avatar name={u.userName} color={u.avatarColor} icon={u.avatarIcon} size={20} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#444444', marginLeft: '4px' }}>
                {activeBoardUsers.length} on board
              </span>
            </div>
          )}

          <button onClick={() => setShareModalOpen(true)} className="btn btn-secondary btn-sm" title="Share only this whiteboard">
            <Share2 size={13} />
            <span>Share</span>
          </button>

          <button onClick={handleDelete} className="btn btn-ghost btn-sm" title="Delete whiteboard">
            <Trash2 size={13} color="#888888" />
          </button>
        </div>
      </div>

      {/* Main Whiteboard Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <WhiteboardCanvas
          whiteboardId={whiteboardId}
          initialElements={whiteboard.canvasElements || []}
          title={whiteboard.title}
        />
      </div>

      {/* Share Whiteboard Modal */}
      <ShareResourceModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={whiteboard.title}
        resourceType="whiteboard"
        resourceId={whiteboardId}
        shareCode={whiteboard.share_code || whiteboard.shareCode}
      />
    </div>
  );
}
