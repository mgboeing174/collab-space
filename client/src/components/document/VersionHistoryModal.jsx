import React, { useState, useEffect } from 'react';
import { History, RotateCcw, Plus, Check, Clock, User } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../utils/api.js';

export default function VersionHistoryModal({ isOpen, onClose, documentId, onVersionRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [summary, setSummary] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  const fetchVersions = async () => {
    if (!documentId) return;
    try {
      setLoading(true);
      const res = await api.get(`/documents/${documentId}/versions`);
      setVersions(res.versions || []);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, documentId]);

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!summary.trim() || !documentId) return;

    try {
      setCreatingSnapshot(true);
      await api.post(`/documents/${documentId}/versions`, { summary: summary.trim() });
      setSummary('');
      await fetchVersions();
    } catch (err) {
      console.error('Failed to create version snapshot:', err);
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRestore = async (version) => {
    const confirm = window.confirm(`Restore document to Version ${version.version_number}? Current changes will be backed up.`);
    if (!confirm) return;

    try {
      setRestoringId(version.id);
      const res = await api.post(`/documents/${documentId}/versions/${version.id}/restore`);
      if (onVersionRestored) {
        onVersionRestored(res.sections);
      }
      onClose();
    } catch (err) {
      console.error('Failed to restore version:', err);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Document Version History" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Create Manual Snapshot Form */}
        <form onSubmit={handleCreateSnapshot} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Add note for milestone snapshot (e.g. Ready for review)..."
            style={{ flex: 1, height: '36px', fontSize: '13px' }}
          />
          <button
            type="submit"
            disabled={creatingSnapshot || !summary.trim()}
            className="btn btn-primary"
            style={{ height: '36px' }}
          >
            <Plus size={14} />
            <span>{creatingSnapshot ? 'Saving...' : 'Create Snapshot'}</span>
          </button>
        </form>

        <div style={{ height: '1px', background: '#eeeeee' }} />

        {/* Version List */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', marginBottom: '8px' }}>
            Saved Versions ({versions.length})
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#888888', fontSize: '13px' }}>
              Loading version history...
            </div>
          ) : versions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#888888', fontSize: '13px' }}>
              No snapshots recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e5e5e5',
                    backgroundColor: idx === 0 ? '#fafafa' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
                        Version {v.version_number}
                      </span>
                      {idx === 0 && (
                        <span className="badge badge-active" style={{ fontSize: '9px' }}>
                          Current / Latest
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#444444', marginBottom: '4px' }}>
                      {v.summary || 'Snapshot'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888888', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {v.created_by_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(v)}
                    disabled={restoringId === v.id}
                    className="btn btn-secondary btn-sm"
                    style={{ minWidth: '90px' }}
                    title="Restore this version"
                  >
                    <RotateCcw size={12} />
                    <span>{restoringId === v.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
