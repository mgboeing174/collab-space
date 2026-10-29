import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  History,
  Download,
  Trash2,
  Share2,
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
import { useDialog } from '../context/DialogContext.jsx';
import SectionEditor from '../components/document/SectionEditor.jsx';
import SectionComponentPicker from '../components/document/SectionComponentPicker.jsx';
import VersionHistoryModal from '../components/document/VersionHistoryModal.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Modal from '../components/common/Modal.jsx';
import ShareResourceModal from '../components/common/ShareResourceModal.jsx';
import { exportToPdf, exportToDocx } from '../utils/exportDocument.js';

export default function DocumentEditorPage() {
  const { workspaceId, docId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { refreshCurrentWorkspace } = useWorkspace();
  const { confirm, alert: customAlert, toast } = useDialog();
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null); // 'pdf' | 'docx' | 'md' | null
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionContent, setNewSectionContent] = useState('');
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

    const handleRemoteSectionAdded = (data) => {
      if (data.documentId === docId && data.section) {
        setSections((prev) => {
          const exists = prev.some((s) => (s.id && s.id === data.section.id) || (s._id && s._id === data.section.id));
          if (exists) return prev;
          return [...prev, data.section];
        });
      }
    };

    const handleRemoteSectionDeleted = (data) => {
      if (data.documentId === docId && data.sectionId) {
        setSections((prev) => prev.filter((s) => s.id !== data.sectionId));
      }
    };

    socket.on('document_presence_update', handleDocPresence);
    socket.on('sections_order_updated', handleSectionsOrder);
    socket.on('section_added', handleRemoteSectionAdded);
    socket.on('section_deleted', handleRemoteSectionDeleted);

    return () => {
      socket.emit('leave_document', { documentId: docId });
      socket.off('document_presence_update', handleDocPresence);
      socket.off('sections_order_updated', handleSectionsOrder);
      socket.off('section_added', handleRemoteSectionAdded);
      socket.off('section_deleted', handleRemoteSectionDeleted);
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
    if (e && e.preventDefault) e.preventDefault();
    if (!newSectionTitle.trim()) return;

    try {
      const res = await api.post(`/documents/${docId}/sections`, {
        title: newSectionTitle.trim(),
        content: newSectionContent || '',
        assignedTo: newSectionAssignee || null
      });

      setSections((prev) => {
        const exists = prev.some((s) => (s.id && s.id === res.section.id) || (s._id && s._id === res.section.id));
        if (exists) return prev;
        if (Array.isArray(res.sectionIds) && res.sectionIds.length > 0) {
          const map = new Map([...prev, res.section].map((s) => [s.id || s._id, s]));
          return res.sectionIds.map((id) => map.get(id)).filter(Boolean);
        }
        return [...prev, res.section];
      });
      setAddSectionOpen(false);
      setNewSectionTitle('');
      setNewSectionContent('');
      setNewSectionAssignee('');
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  };

  // Add component directly
  const handleSelectComponent = async (componentBlock) => {
    try {
      const res = await api.post(`/documents/${docId}/sections`, {
        title: componentBlock.title,
        content: componentBlock.defaultContent || '',
        assignedTo: null
      });

      setSections((prev) => {
        const exists = prev.some((s) => (s.id && s.id === res.section.id) || (s._id && s._id === res.section.id));
        if (exists) return prev;
        if (Array.isArray(res.sectionIds) && res.sectionIds.length > 0) {
          const map = new Map([...prev, res.section].map((s) => [s.id || s._id, s]));
          return res.sectionIds.map((id) => map.get(id)).filter(Boolean);
        }
        return [...prev, res.section];
      });
      setComponentPickerOpen(false);
    } catch (err) {
      console.error('Failed to add component section:', err);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId) => {
    const ok = await confirm({
      title: 'Delete section?',
      message: 'All collaborator content in this section will be permanently deleted.',
      confirmText: 'Delete Section',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await api.delete(`/documents/${docId}/sections/${sectionId}`);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      toast({ title: 'Section deleted', type: 'info' });
    } catch (err) {
      console.error('Failed to delete section:', err);
      toast({ title: 'Delete failed', message: err.message, type: 'error' });
    }
  };

  // Delete entire document
  const handleDeleteDoc = async () => {
    const ok = await confirm({
      title: `Delete "${document?.title}"?`,
      message: 'This document and all its collaborative versions will be permanently removed.',
      confirmText: 'Delete Document',
      isDestructive: true
    });
    if (!ok) return;

    try {
      await api.delete(`/documents/${docId}`);
      await refreshCurrentWorkspace();
      toast({ title: 'Document deleted', type: 'info' });
      navigate(`/workspace/${workspaceId}`);
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast({ title: 'Delete failed', message: err.message, type: 'error' });
    }
  };

  // Export document as PDF
  const handleExportPdf = async () => {
    try {
      setExportingFormat('pdf');
      await exportToPdf(document.title, sections, { templateType: document.template_type });
      setExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      customAlert({
        title: 'Export Failed',
        message: 'Could not prepare print dialog for PDF export. Please try again.'
      });
    } finally {
      setExportingFormat(null);
    }
  };

  // Export document as DOCX
  const handleExportDocx = async () => {
    try {
      setExportingFormat('docx');
      await exportToDocx(document.title, sections, { templateType: document.template_type });
      setExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export DOCX:', err);
      customAlert({
        title: 'Export Failed',
        message: 'Could not generate Microsoft Word document. Please try again.'
      });
    } finally {
      setExportingFormat(null);
    }
  };

  // Export document as clean Markdown file
  const handleExportMarkdown = () => {
    try {
      setExportingFormat('md');
      let md = `# ${document.title}\n\n`;
      md += `*Document Template: ${document.template_type}*\n\n---\n\n`;

      sections.forEach((s) => {
        md += `## ${s.title}\n`;
        if (s.assigned_name) md += `*Assigned to: ${s.assigned_name}*\n\n`;
        // Convert basic HTML to plain text/markdown
        const cleanContent = (s.content || '')
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
      setExportModalOpen(false);
    } catch (err) {
      console.error('Failed to export Markdown:', err);
    } finally {
      setExportingFormat(null);
    }
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
    <div className="document-editor-container" style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px 80px' }}>
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
                    <Avatar name={u.userName} color={u.avatarColor} icon={u.avatarIcon} size={22} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#444444', marginLeft: '4px' }}>
                {activeDocUsers.length} in doc
              </span>
            </div>
          )}

          <button onClick={() => setShareModalOpen(true)} className="btn btn-secondary btn-sm" title="Share only this document">
            <Share2 size={13} />
            <span>Share</span>
          </button>

          <button onClick={() => setHistoryOpen(true)} className="btn btn-secondary btn-sm" title="Version Snapshots">
            <History size={13} />
            <span>History</span>
          </button>

          <button onClick={() => setExportModalOpen(true)} className="btn btn-secondary btn-sm" title="Export Document">
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
        {sections.length === 0 && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              border: '1.5px dashed #cccccc',
              borderRadius: '8px'
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Empty Document Canvas
            </div>
            <p style={{ fontSize: '13px', color: '#666666', maxWidth: '460px', margin: '0 auto 18px' }}>
              This is a freestyle document. You can construct your layout modularly by picking headers, summaries, body paragraphs, bullet points, checklists, and footers.
            </p>
            <button
              onClick={() => setComponentPickerOpen(true)}
              className="btn btn-primary"
              style={{ margin: '0 auto' }}
            >
              <Plus size={14} />
              <span>Choose First Component</span>
            </button>
          </div>
        )}

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

        {/* Section Component Drawer / Quick Bar */}
        {componentPickerOpen && (
          <SectionComponentPicker
            workspaceMembers={workspaceMembers}
            onSelectComponent={handleSelectComponent}
            onCustomAdd={() => {
              setComponentPickerOpen(false);
              setAddSectionOpen(true);
            }}
          />
        )}

        {/* Action Controls for Adding Components */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setComponentPickerOpen(!componentPickerOpen)}
            style={{
              flex: 1,
              padding: '12px',
              border: componentPickerOpen ? '1.5px solid #111111' : '1.5px dashed #cccccc',
              borderRadius: '8px',
              backgroundColor: componentPickerOpen ? '#f9f9f9' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#111111',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>{componentPickerOpen ? 'Hide Component Library' : 'Add Component (Header, Body, Bullets, Footer...)'}</span>
          </button>

          <button
            onClick={() => {
              setComponentPickerOpen(false);
              setNewSectionTitle('');
              setNewSectionContent('');
              setAddSectionOpen(true);
            }}
            className="btn btn-secondary"
            style={{ padding: '0 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
            title="Add custom section with your own title"
          >
            <span>Custom Section</span>
          </button>
        </div>
      </div>

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={docId}
        onVersionRestored={(restoredSections) => setSections(restoredSections)}
      />

      {/* Export Options Modal */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Document"
        maxWidth="460px"
        footer={
          <button onClick={() => setExportModalOpen(false)} className="btn btn-secondary">
            Close
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: '#666666', marginBottom: '4px' }}>
            Choose a format to export <strong>{document.title}</strong> and all its collaborative sections:
          </p>

          {/* PDF Option */}
          <div
            onClick={handleExportPdf}
            style={{
              padding: '14px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              cursor: exportingFormat ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!exportingFormat) {
                e.currentTarget.style.borderColor = '#111111';
                e.currentTarget.style.backgroundColor = '#fafafa';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
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
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                PDF
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>
                  Portable Document Format (.pdf)
                </div>
                <div style={{ fontSize: '12px', color: '#666666' }}>
                  Formatted printable document with headers and styling
                </div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>
              {exportingFormat === 'pdf' ? 'Generating...' : 'Download'}
            </span>
          </div>

          {/* DOCX Option */}
          <div
            onClick={handleExportDocx}
            style={{
              padding: '14px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              cursor: exportingFormat ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!exportingFormat) {
                e.currentTarget.style.borderColor = '#111111';
                e.currentTarget.style.backgroundColor = '#fafafa';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
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
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                DOCX
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>
                  Microsoft Word (.docx)
                </div>
                <div style={{ fontSize: '12px', color: '#666666' }}>
                  Standard Word format with headings and structured paragraphs
                </div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>
              {exportingFormat === 'docx' ? 'Generating...' : 'Download'}
            </span>
          </div>

          {/* Markdown Option */}
          <div
            onClick={handleExportMarkdown}
            style={{
              padding: '14px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              cursor: exportingFormat ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!exportingFormat) {
                e.currentTarget.style.borderColor = '#111111';
                e.currentTarget.style.backgroundColor = '#fafafa';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: '#4a4a4a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                MD
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111' }}>
                  Markdown (.md)
                </div>
                <div style={{ fontSize: '12px', color: '#666666' }}>
                  Plain text format compatible with GitHub, Obsidian, and Notion
                </div>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111111' }}>
              Download
            </span>
          </div>
        </div>
      </Modal>

      {/* Share Document Modal */}
      <ShareResourceModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={document.title}
        resourceType="document"
        resourceId={docId}
        shareCode={document.share_code || document.shareCode}
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
