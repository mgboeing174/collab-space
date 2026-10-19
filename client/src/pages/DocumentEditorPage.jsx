import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  History,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  ArrowLeft,
  Users,
  ChevronDown
} from 'lucide-react';
import { api } from '../utils/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import SectionEditor from '../components/document/SectionEditor.jsx';
import VersionHistoryModal from '../components/document/VersionHistoryModal.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Modal from '../components/common/Modal.jsx';

export default function DocumentEditorPage() {
  const { workspaceId, docId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { refreshCurrentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [sections, setSections] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [currentUserRole, setCurrentRole] = useState('member');
  const [activeDocUsers, setActiveDocUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionAssignee, setNewSectionAssignee] = useState('');

  // Fetch document details
  const fetchDoc = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/documents/${docId}`);
      setDocument(res.document);
      setSections(res.sections || []);
      setWorkspaceMembers(res.workspaceMembers || []);
      setCurrentRole(res.currentUserRole || 'member');
    } catch (err) {
      console.error('Failed to load document:', err);
      setError(err.message || 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  // Socket.IO document room and active presence
  useEffect(() => {
    if (!socket || !docId) return;

    socket.emit('join_document', { documentId: docId });

    const handleDocPresence = (data) => {
      if (data.documentId === docId) {
        setActiveDocUsers(data.activeUsers || []);
      }
    };

    const handleSectionsOrder = (data) => {
      if (data.documentId === docId) {
        setSections((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          return data.sectionIds.map((id) => map.get(id)).filter(Boolean);
        });
      }
    };

    socket.on('document_presence_update', handleDocPresence);
    socket.on('sections_order_updated', handleSectionsOrder);

    return () => {
      socket.emit('leave_document', { documentId: docId });
      socket.off('document_presence_update', handleDocPresence);
      socket.off('sections_order_updated', handleSectionsOrder);
    };
  }, [socket, docId]);

  // Update document title
  const handleTitleChange = async (newTitle) => {
    if (!newTitle.trim() || newTitle === document.title) return;
    try {
      setDocument((prev) => ({ ...prev, title: newTitle.trim() }));
      await api.put(`/documents/${docId}`, { title: newTitle.trim() });
      await refreshCurrentWorkspace();
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Reorder sections
  const handleMoveSection = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);

    setSections(newSections);

    const sectionIds = newSections.map((s) => s.id);
    try {
      if (socket) {
        socket.emit('sections_reordered', { documentId: docId, sectionIds });
      }
      await api.put(`/documents/${docId}/reorder-sections`, { sectionIds });
    } catch (err) {
      console.error('Failed to reorder sections:', err);
    }
  };

  // Add new section
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    try {
      const res = await api.post(`/documents/${docId}/sections`, {
        title: newSectionTitle.trim(),
        assignedTo: newSectionAssignee || null
      });

      setSections((prev) => [...prev, res.section]);
      setAddSectionOpen(false);
      setNewSectionTitle('');
      setNewSectionAssignee('');
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId) => {
    const confirm = window.confirm('Delete this section? Collaborator contributions in it will be removed.');
    if (!confirm) return;

    try {
      await api.delete(`/documents/${docId}/sections/${sectionId}`);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  };

  // Delete entire document
  const handleDeleteDoc = async () => {
    const confirm = window.confirm(`Permanently delete document "${document?.title}"?`);
    if (!confirm) return;

    try {
      await api.delete(`/documents/${docId}`);
      await refreshCurrentWorkspace();
      navigate(`/workspace/${workspaceId}`);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  // Export document as clean Markdown file
  const handleExportMarkdown = () => {
    let md = `# ${document.title}\n\n`;
    md += `*Document Template: ${document.template_type}*\n\n---\n\n`;

    sections.forEach((s) => {
      md += `## ${s.title}\n`;
      if (s.assigned_name) md += `*Assigned to: ${s.assigned_name}*\n\n`;
      // Convert basic HTML to plain text/markdown
      const cleanContent = s.content
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<[^>]+>/g, '');
      md += `${cleanContent}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#888888', fontSize: '14px' }}>
        Loading collaborative document...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <button onClick={() => navigate(`/workspace/${workspaceId}`)} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          <ArrowLeft size={13} />
          <span>Back to Workspace</span>
        </button>
        <div style={{ color: '#111111', fontSize: '15px' }}>{error || 'Document not found'}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Document Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e5e5',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => navigate(`/workspace/${workspaceId}`)}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px 6px' }}
            title="Back to workspace"
          >
            <ArrowLeft size={15} />
          </button>
          <span className="badge badge-default" style={{ fontSize: '10px' }}>
            {document.template_type}
          </span>
        </div>

        {/* Action Controls & Active Presence Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active Collaborators in this document */}
          {activeDocUsers.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f5f5f5',
                padding: '2px 8px 2px 4px',
                borderRadius: '16px'
              }}
              title="Currently viewing/editing this document"
            >
              <div style={{ display: 'flex', marginLeft: '2px' }}>
                {activeDocUsers.slice(0, 3).map((u, i) => (
                  <div key={u.userId || i} style={{ marginLeft: i > 0 ? '-6px' : 0 }}>
                    <Avatar name={u.userName} color={u.avatarColor} size={22} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#444444', marginLeft: '4px' }}>
                {activeDocUsers.length} in doc
              </span>
            </div>
          )}

          <button onClick={() => setHistoryOpen(true)} className="btn btn-secondary btn-sm" title="Version Snapshots">
            <History size={13} />
            <span>History</span>
          </button>

          <button onClick={handleExportMarkdown} className="btn btn-secondary btn-sm" title="Export as Markdown">
            <Download size={13} />
            <span>Export</span>
          </button>

          {currentUserRole !== 'viewer' && (
            <button onClick={handleDeleteDoc} className="btn btn-ghost btn-sm" title="Delete document">
              <Trash2 size={13} color="#888888" />
            </button>
          )}
        </div>
      </div>

      {/* Document Title Header */}
      <div style={{ marginBottom: '32px' }}>
        <input
          type="text"
          value={document.title}
          onChange={(e) => setDocument({ ...document, title: e.target.value })}
          onBlur={(e) => handleTitleChange(e.target.value)}
          style={{
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            border: 'none',
            background: 'transparent',
            padding: 0,
            width: '100%',
            outline: 'none',
            color: '#111111'
          }}
          placeholder="Untitled Document"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888888', marginTop: '6px' }}>
          <span>Created by {document.creator_name}</span>
          <span>•</span>
          <span>Section-level real-time locking enabled</span>
        </div>
      </div>

      {/* Section-Based Collaborative Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sections.map((sec, idx) => (
          <SectionEditor
            key={sec.id}
            section={sec}
            documentId={docId}
            isFirst={idx === 0}
            isLast={idx === sections.length - 1}
            workspaceMembers={workspaceMembers}
            onMoveUp={() => handleMoveSection(idx, -1)}
            onMoveDown={() => handleMoveSection(idx, 1)}
            onDelete={handleDeleteSection}
            onSectionSaved={(savedSec) => {
              setSections((prev) => prev.map((s) => (s.id === savedSec.id ? savedSec : s)));
            }}
          />
        ))}

        {/* Add Section Button */}
        <button
          onClick={() => setAddSectionOpen(true)}
          style={{
            width: '100%',
            padding: '14px',
            border: '1.5px dashed #cccccc',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#555555',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#111111';
            e.currentTarget.style.color = '#111111';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cccccc';
            e.currentTarget.style.color = '#555555';
          }}
        >
          <Plus size={15} />
          <span>Add Custom Section</span>
        </button>
      </div>

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={docId}
        onVersionRestored={(restoredSections) => setSections(restoredSections)}
      />

      {/* Add Section Modal */}
      <Modal
        isOpen={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        title="Add New Document Section"
        maxWidth="440px"
        footer={
          <>
            <button onClick={() => setAddSectionOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleAddSection} disabled={!newSectionTitle.trim()} className="btn btn-primary">
              Add Section
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Section Title
            </label>
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="e.g. Technical Feasibility, Budget Overview"
              autoFocus
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Assign Collaborator (Optional)
            </label>
            <select
              value={newSectionAssignee}
              onChange={(e) => setNewSectionAssignee(e.target.value)}
              style={{ width: '100%', height: '36px' }}
            >
              <option value="">Unassigned (Open for team to claim)</option>
              {workspaceMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
