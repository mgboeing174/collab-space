import React from 'react';
import { X, FileText, Layout, UserPlus, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import Avatar from '../common/Avatar.jsx';

function formatRelativeTime(dateString) {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch (e) {
    return '';
  }
}

export default function ActivityDrawer({ isOpen, onClose }) {
  const { activities, currentWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getActivityIcon = (type, action) => {
    if (type === 'document' || type === 'section') {
      return <FileText size={14} color="#333333" />;
    }
    if (type === 'whiteboard') {
      return <Layout size={14} color="#333333" />;
    }
    if (action.includes('member') || type === 'member') {
      return <UserPlus size={14} color="#333333" />;
    }
    return <Clock size={14} color="#333333" />;
  };

  const handleItemClick = (activity) => {
    onClose();
    if (activity.entity_type === 'document') {
      navigate(`/workspace/${currentWorkspaceId}/doc/${activity.entity_id}`);
    } else if (activity.entity_type === 'whiteboard') {
      navigate(`/workspace/${currentWorkspaceId}/whiteboard/${activity.entity_id}`);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.2)',
          zIndex: 900
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          maxWidth: '90vw',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e0e0e0',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          zIndex: 950,
          display: 'flex',
          flexDirection: 'column',
          animation: 'drawerSlide 0.2s ease-out'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #eeeeee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#111111" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111111' }}>Workspace Activity</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#888888', fontSize: '13px' }}>
              No recorded activity yet in this workspace.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.map((a) => (
                <div
                  key={a.id}
                  onClick={() => handleItemClick(a)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0',
                    background: '#fafafa',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: a.entity_type === 'document' || a.entity_type === 'whiteboard' ? 'pointer' : 'default',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#e0e0e0')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f0f0f0')}
                >
                  <Avatar name={a.user_name} color={a.avatar_color} icon={a.avatar_icon} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111111' }}>{a.user_name}</span>
                      <span style={{ fontSize: '11px', color: '#888888' }}>{formatRelativeTime(a.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#333333', marginBottom: '2px' }}>
                      {a.details || a.action.replace('_', ' ')}
                    </div>
                    {a.entity_title && (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#666666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: a.entity_type === 'document' || a.entity_type === 'whiteboard' ? 'underline' : 'none'
                        }}
                      >
                        {getActivityIcon(a.entity_type, a.action)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.entity_title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
