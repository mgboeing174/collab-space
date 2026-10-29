import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Trash2, Save, Share2, Check } from 'lucide-react';
import { api } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useDialog } from '../context/DialogContext.jsx';
import Avatar from '../components/common/Avatar.jsx';
import InviteModal from '../components/workspace/InviteModal.jsx';

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { refreshWorkspaces, refreshCurrentWorkspace } = useWorkspace();
  const { confirm, toast } = useDialog();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/workspaces/${workspaceId}`);
      setWorkspace(res.workspace);
      setMembers(res.members || []);
      setName(res.workspace.name || '');
      setDescription(res.workspace.description || '');
    } catch (err) {
      console.error('Failed to load workspace settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [workspaceId]);

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await api.put(`/workspaces/${workspaceId}`, { name: name.trim(), description: description.trim() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      await refreshWorkspaces();
      await refreshCurrentWorkspace();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await api.put(`/workspaces/${workspaceId}/members/${targetUserId}`, { role: newRole });
      await fetchDetails();
    } catch (err) {
      console.error('Failed to change role:', err);
    }
  };

  const handleRemoveMember = async (targetUserId, memberName) => {
    const isSelf = user.id === targetUserId;
    const ok = await confirm({
      title: isSelf ? 'Leave Workspace?' : `Remove ${memberName}?`,
      message: isSelf
        ? 'You will lose access to all documents and whiteboards in this workspace until re-invited.'
        : `This will revoke ${memberName}'s access to all documents in this workspace.`,
      confirmText: isSelf ? 'Leave Workspace' : 'Remove Member',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await api.delete(`/workspaces/${workspaceId}/members/${targetUserId}`);
      toast({
        title: isSelf ? 'Left workspace' : 'Member removed',
        type: 'info'
      });
      if (isSelf) {
        await refreshWorkspaces();
        navigate('/workspaces');
      } else {
        await fetchDetails();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      toast({ title: 'Operation failed', message: err.message, type: 'error' });
    }
  };

  const handleDeleteWorkspace = async () => {
    const ok = await confirm({
      title: `Permanently delete "${workspace.name}"?`,
      message: 'All documents, section versions, whiteboards, and project configurations within this workspace will be permanently erased. This action cannot be undone.',
      confirmText: 'Delete Entire Workspace',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await api.delete(`/workspaces/${workspaceId}`);
      await refreshWorkspaces();
      toast({ title: 'Workspace deleted', type: 'info' });
      navigate('/workspaces');
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      toast({ title: 'Delete failed', message: err.message, type: 'error' });
    }
  };

  const isOwner = workspace?.myRole === 'owner';
  const isAdmin = workspace?.myRole === 'admin' || isOwner;

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#888888', fontSize: '14px' }}>Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px 80px' }}>
      <button
        onClick={() => navigate(`/workspace/${workspaceId}`)}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '20px' }}
      >
        <ArrowLeft size={13} />
        <span>Back to Workspace</span>
      </button>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' }}>
          Workspace Settings
        </h1>
        <p style={{ fontSize: '13.5px', color: '#666666', marginTop: '4px' }}>
          Manage workspace details, permissions, and team collaborators
        </p>
      </div>

      {/* General Settings */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '28px'
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111', marginBottom: '16px' }}>
          General Information
        </h2>

        <form onSubmit={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              rows={3}
              style={{ width: '100%' }}
            />
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary">
                <Save size={14} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              {saveSuccess && (
                <span style={{ fontSize: '12.5px', color: '#111111', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={14} /> Saved successfully
                </span>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Members & Permissions */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '28px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111' }}>
              Team Members ({members.length})
            </h2>
            <p style={{ fontSize: '12.5px', color: '#666666' }}>
              Collaborators with access to this workspace's documents and boards
            </p>
          </div>
          <button onClick={() => setInviteModalOpen(true)} className="btn btn-secondary btn-sm">
            <Share2 size={13} />
            <span>Invite Member</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map((m) => {
            const isSelf = user.id === m.user_id;
            const isTargetOwner = m.role === 'owner';

            return (
              <div
                key={m.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: '#fafafa',
                  border: '1px solid #eeeeee',
                  borderRadius: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar name={m.name} color={m.avatar_color} icon={m.avatar_icon} size={30} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
                      {m.name} {isSelf ? '(You)' : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888888' }}>{m.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isTargetOwner ? (
                    <span className="badge badge-active" style={{ fontSize: '10px' }}>
                      Owner
                    </span>
                  ) : isAdmin && !isSelf ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      style={{ padding: '3px 6px', fontSize: '12px', height: '28px' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="badge badge-default" style={{ fontSize: '10px' }}>
                      {m.role}
                    </span>
                  )}

                  {!isTargetOwner && (isAdmin || isSelf) && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id, m.name)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: '#888888' }}
                      title={isSelf ? 'Leave workspace' : 'Remove member'}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #111111',
            borderRadius: '8px',
            padding: '24px'
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Danger Zone
          </h2>
          <p style={{ fontSize: '13px', color: '#666666', marginBottom: '16px' }}>
            Permanently delete this workspace and all associated documents, sections, and whiteboards. This cannot be undone.
          </p>

          <button onClick={handleDeleteWorkspace} className="btn btn-danger">
            <Trash2 size={14} />
            <span>Delete Workspace</span>
          </button>
        </div>
      )}

      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        workspace={workspace}
      />
    </div>
  );
}
