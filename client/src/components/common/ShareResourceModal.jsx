import React, { useState } from 'react';
import { Copy, Check, RefreshCw, Lock, Link as LinkIcon } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../utils/api.js';

export default function ShareResourceModal({
  isOpen,
  onClose,
  title,
  resourceType = 'document', // 'document' | 'whiteboard'
  resourceId,
  shareCode: initialShareCode
}) {
  const [shareCode, setShareCode] = useState(initialShareCode || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const shareUrl = `${window.location.origin}/join/${shareCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const endpoint = resourceType === 'whiteboard'
        ? `/whiteboards/${resourceId}/share-code`
        : `/documents/${resourceId}/share-code`;
      const res = await api.post(endpoint);
      setShareCode(res.shareCode);
    } catch (err) {
      console.error('Failed to regenerate share code:', err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${resourceType === 'whiteboard' ? 'Whiteboard' : 'Document'}`}
      maxWidth="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111111' }}>
            {title}
          </div>
          <p style={{ fontSize: '12.5px', color: '#666666', marginTop: '4px', lineHeight: 1.4 }}>
            Anyone with this 12-digit code or link can join and collaborate on <strong>only this {resourceType}</strong> without gaining access to your other workspace documents or whiteboards.
          </p>
        </div>

        {/* Share Link */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Direct Collaboration Link
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                height: '36px',
                fontSize: '12.5px',
                fontFamily: 'monospace',
                backgroundColor: '#fafafa'
              }}
            />
            <button onClick={handleCopyLink} className="btn btn-secondary" style={{ padding: '0 12px' }}>
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* 12-Digit Code */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Single-Item 12-Digit Code
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '14px',
                letterSpacing: '0.08em',
                fontWeight: 600,
                color: '#111111'
              }}
            >
              {shareCode}
            </div>
            <button onClick={handleCopyCode} className="btn btn-secondary" style={{ padding: '0 12px' }}>
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Regenerate security option */}
        <div style={{ paddingTop: '8px', borderTop: '1px solid #eeeeee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#888888' }}>
            <Lock size={12} />
            <span>Revoke old link anytime</span>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11.5px', color: '#666666' }}
          >
            <RefreshCw size={12} className={regenerating ? 'spin' : ''} />
            <span>Generate New Code</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
