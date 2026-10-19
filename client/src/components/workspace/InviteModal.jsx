import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Users, Shield } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../utils/api.js';

export default function InviteModal({ isOpen, onClose, workspace }) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(workspace?.invite_code || '');

  React.useEffect(() => {
    if (workspace?.invite_code) {
      setInviteCode(workspace.invite_code);
    }
  }, [workspace]);

  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const res = await api.post(`/workspaces/${workspace.id}/invite-link`);
      setInviteCode(res.inviteCode);
    } catch (err) {
      console.error('Failed to regenerate invite code:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Collaborators" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <p style={{ fontSize: '13.5px', color: '#555555', marginBottom: '12px' }}>
            Invite teammates to collaborate in <strong>{workspace?.name}</strong>. Anyone with this link or code can join with member access.
          </p>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Invitation Link
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={inviteUrl}
              style={{ flex: 1, backgroundColor: '#f9f9f9', fontSize: '13px' }}
            />
            <button onClick={copyLink} className="btn btn-primary" style={{ minWidth: '100px' }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Direct Workspace Code
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={inviteCode}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '15px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                backgroundColor: '#f9f9f9'
              }}
            />
            <button onClick={copyCode} className="btn btn-secondary" style={{ minWidth: '100px' }}>
              {codeCopied ? <Check size={14} /> : <Copy size={14} />}
              <span>{codeCopied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '12px',
            backgroundColor: '#fafafa',
            border: '1px solid #eeeeee',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <Shield size={16} color="#444444" style={{ marginTop: '2px' }} />
          <div style={{ fontSize: '12px', color: '#555555' }}>
            New members can view documents, claim sections, draw on whiteboards, and collaborate in real-time. Only workspace owners and admins can delete resources.
          </div>
        </div>

        {(workspace?.my_role === 'owner' || workspace?.my_role === 'admin') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleRegenerate}
              disabled={loading}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '12px' }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Regenerate Invite Code</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
