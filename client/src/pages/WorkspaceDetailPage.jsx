import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Layout,
  Folder,
  Plus,
  Users,
  Share2,
  Clock,
  ArrowRight,
  Shield,
  Settings
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import Avatar from '../components/common/Avatar.jsx';
import TemplatePickerModal from '../components/workspace/TemplatePickerModal.jsx';
import InviteModal from '../components/workspace/InviteModal.jsx';
import { api } from '../utils/api.js';

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams();
  const { currentWorkspace, refreshCurrentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [creatingWb, setCreatingWb] = useState(false);

  const workspace = currentWorkspace?.workspace;
  const documents = currentWorkspace?.documents || [];
  const whiteboards = currentWorkspace?.whiteboards || [];
  const members = currentWorkspace?.members || [];
  const projects = currentWorkspace?.projects || [];

  const handleCreateWhiteboard = async () => {
    try {
      setCreatingWb(true);
      const res = await api.post('/whiteboards', {
        workspaceId,
        title: 'Sprint Brainstorm & Architecture'
      });
      await refreshCurrentWorkspace();
      navigate(`/workspace/${workspaceId}/whiteboard/${res.whiteboard.id}`);
    } catch (err) {
      console.error('Failed to create whiteboard:', err);
    } finally {
      setCreatingWb(false);
    }
  };

  if (!workspace) {
    return (
      <div style={{ padding: '40px 32px', color: '#888888', fontSize: '14px' }}>
        Loading workspace overview...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 32px 64px' }}>
      {/* Workspace Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e5e5'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
              {workspace.name}
            </h1>
            <span className="badge badge-default">{workspace.myRole || 'member'}</span>
          </div>
          <p style={{ fontSize: '13.5px', color: '#666666', maxWidth: '600px' }}>
            {workspace.description || 'Collaborative workspace for real-time document drafting and whiteboard brainstorming.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setInviteModalOpen(true)} className="btn btn-secondary">
            <Share2 size={14} />
            <span>Invite Team</span>
          </button>
          <button onClick={() => navigate(`/workspace/${workspaceId}/settings`)} className="btn btn-ghost" title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Quick Launch Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '36px' }}>
        <div
          onClick={() => setTemplatePickerOpen(true)}
          style={{
            padding: '16px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          className="btn-ghost"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: '#111111',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>New Document</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>From templates (Notes, Proposal, Report)</div>
            </div>
          </div>
          <Plus size={16} color="#888888" />
        </div>

        <div
          onClick={handleCreateWhiteboard}
          style={{
            padding: '16px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          className="btn-ghost"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: '#2b2b2b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Layout size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>
                {creatingWb ? 'Opening...' : 'New Whiteboard'}
              </div>
              <div style={{ fontSize: '12px', color: '#666666' }}>Shapes, sticky notes & freehand drawings</div>
            </div>
          </div>
          <Plus size={16} color="#888888" />
        </div>
      </div>

      {/* Documents Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>
            Workspace Documents ({documents.length})
          </h2>
          <button onClick={() => setTemplatePickerOpen(true)} className="btn btn-ghost btn-sm">
            <Plus size={13} />
            <span>Add Document</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #eeeeee' }}>
            <FileText size={24} color="#aaaaaa" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#666666' }}>No documents created in this workspace yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/workspace/${workspaceId}/doc/${doc.id}`)}
                style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#111111';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e5e5';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="#111111" />
                    <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: '#111111' }}>{doc.title}</h3>
                  </div>
                  <span className="badge badge-default" style={{ fontSize: '9.5px' }}>
                    {doc.template_type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#888888', marginTop: '12px' }}>
                  <span>{doc.section_count || 0} sections</span>
                  <span>•</span>
                  <span>Created by {doc.creator_name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whiteboards Section */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>
            Collaborative Whiteboards ({whiteboards.length})
          </h2>
          <button onClick={handleCreateWhiteboard} className="btn btn-ghost btn-sm">
            <Plus size={13} />
            <span>Add Whiteboard</span>
          </button>
        </div>

        {whiteboards.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#ffffff', borderRadius: '8px', border: '1px solid #eeeeee' }}>
            <Layout size={24} color="#aaaaaa" style={{ margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#666666' }}>No whiteboards created yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {whiteboards.map((wb) => (
              <div
                key={wb.id}
                onClick={() => navigate(`/workspace/${workspaceId}/whiteboard/${wb.id}`)}
                style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#111111';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e5e5';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Layout size={16} color="#111111" />
                  <h3 style={{ fontSize: '14.5px', fontWeight: 600, color: '#111111' }}>{wb.title}</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#888888', marginTop: '12px' }}>
                  <span>Created by {wb.creator_name}</span>
                  <span>•</span>
                  <span>Live sync ready</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Members */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>
            Team Members ({members.length})
          </h2>
          <button onClick={() => setInviteModalOpen(true)} className="btn btn-secondary btn-sm">
            <Share2 size={13} />
            <span>Invite Collaborators</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {members.map((m) => (
            <div
              key={m.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e5e5',
                borderRadius: '6px'
              }}
            >
              <Avatar name={m.name} color={m.avatar_color} size={24} />
              <div>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#111111' }}>{m.name}</span>
                <span style={{ fontSize: '10.5px', color: '#888888', marginLeft: '6px' }}>({m.role})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <TemplatePickerModal
        isOpen={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
      />
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        workspace={workspace}
      />
    </div>
  );
}
