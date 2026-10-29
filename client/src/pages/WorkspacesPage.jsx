import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Plus,
  ArrowRight,
  Users,
  FileText,
  Layout,
  KeyRound,
  Shield,
  Clock,
  LogOut,
  User
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import Modal from '../components/common/Modal.jsx';
import Avatar from '../components/common/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function WorkspacesPage() {
  const { workspaces, createWorkspace, joinWorkspaceByCode, switchWorkspace, loading } = useWorkspace();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!wsName.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      const ws = await createWorkspace(wsName.trim(), wsDesc.trim());
      setCreateModalOpen(false);
      setWsName('');
      setWsDesc('');
      navigate(`/workspace/${ws.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      const res = await joinWorkspaceByCode(inviteCode.trim());
      setJoinModalOpen(false);
      setInviteCode('');
      if (res.targetType === 'document' || res.type === 'document') {
        navigate(`/workspace/${res.workspaceId}/doc/${res.documentId}`);
      } else if (res.targetType === 'whiteboard' || res.type === 'whiteboard') {
        navigate(`/workspace/${res.workspaceId}/whiteboard/${res.whiteboardId}`);
      } else {
        navigate(`/workspace/${res.workspaceId}`);
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired invitation code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectWorkspace = (wsId) => {
    switchWorkspace(wsId);
    navigate(`/workspace/${wsId}`);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          height: '54px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        {/* Brand */}
        <div
          onClick={() => navigate('/workspaces')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.03em',
            color: '#111111'
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              background: '#111111',
              borderRadius: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Layers size={15} />
          </div>
          <span>CollabSpace</span>
        </div>

        {/* Right User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              padding: '4px 6px',
              borderRadius: '6px'
            }}
          >
            <Avatar name={user?.name} color={user?.avatarColor} icon={user?.avatarIcon} size={28} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
              {user?.name}
            </span>
          </button>

          {userDropdownOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setUserDropdownOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '210px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '6px'
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #eeeeee' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{user?.name}</div>
                  <div style={{ fontSize: '11px', color: '#888888' }}>{user?.email}</div>
                </div>

                <div style={{ padding: '4px 0' }}>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      gap: '8px',
                      color: '#333333'
                    }}
                  >
                    <User size={14} />
                    <span>Account Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="btn-ghost"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      gap: '8px',
                      color: '#333333'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Page Body */}
      <div style={{ maxWidth: '960px', margin: '36px auto', padding: '0 24px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: '#111111' }}>
              Workspaces
            </h1>
            <p style={{ fontSize: '13.5px', color: '#666666', marginTop: '4px' }}>
              Select a collaborative space or create one for your team
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setJoinModalOpen(true)} className="btn btn-secondary">
              <KeyRound size={14} />
              <span>Join via Code</span>
            </button>
            <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
              <Plus size={14} />
              <span>New Workspace</span>
            </button>
          </div>
        </div>

      {/* Workspaces List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888888', fontSize: '14px' }}>
          Loading workspaces...
        </div>
      ) : workspaces.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Layers size={22} color="#111111" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            No workspaces yet
          </h3>
          <p style={{ fontSize: '13.5px', color: '#666666', maxWidth: '360px', margin: '0 auto 20px' }}>
            Create your first workspace to start collaborating on multi-section documents and whiteboards.
          </p>
          <button onClick={() => setCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={14} />
            <span>Create Workspace</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws.id)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#111111';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>{ws.name}</h3>
                  <span className="badge badge-default" style={{ fontSize: '10px' }}>
                    {ws.my_role || 'member'}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: '#666666', marginBottom: '16px', lineHeight: 1.4, minHeight: '36px' }}>
                  {ws.description || 'Shared collaborative environment'}
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#888888',
                    paddingTop: '12px',
                    borderTop: '1px solid #f0f0f0'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={13} />
                    {ws.member_count || 1}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={13} />
                    {ws.doc_count || 0}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layout size={13} />
                    {ws.whiteboard_count || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Workspace Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Workspace"
        footer={
          <>
            <button onClick={() => setCreateModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={submitting || !wsName.trim()} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <div style={{ fontSize: '12.5px', color: '#111111' }}>{error}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Workspace Name
            </label>
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="e.g. Design & Engineering, Growth Team"
              autoFocus
              style={{ width: '100%', height: '38px', fontSize: '14px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Description (Optional)
            </label>
            <textarea
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
              placeholder="What will this team or workspace collaborate on?"
              rows={3}
              style={{ width: '100%', fontSize: '13.5px', resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* Join Workspace Modal */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Join Workspace"
        footer={
          <>
            <button onClick={() => setJoinModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleJoin} disabled={submitting || !inviteCode.trim()} className="btn btn-primary">
              {submitting ? 'Joining...' : 'Join Workspace'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <div style={{ fontSize: '12.5px', color: '#111111' }}>{error}</div>}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Invitation Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste 12-character invite code (e.g. a8b4c2e1f9a0)"
              autoFocus
              style={{ width: '100%', height: '38px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  </div>
  );
}
