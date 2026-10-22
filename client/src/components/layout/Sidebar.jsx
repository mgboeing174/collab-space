import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  FileText,
  Layout,
  Folder,
  Plus,
  ChevronRight,
  ChevronDown,
  Users,
  Settings,
  MoreVertical,
  Trash2,
  Share2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../utils/api.js';
import TemplatePickerModal from '../workspace/TemplatePickerModal.jsx';
import Modal from '../common/Modal.jsx';

export default function Sidebar({ isOpenMobile = false, onCloseMobile }) {
  const { currentWorkspace, currentWorkspaceId, refreshCurrentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [creatingWhiteboard, setCreatingWhiteboard] = useState(false);

  const documents = currentWorkspace?.documents || [];
  const whiteboards = currentWorkspace?.whiteboards || [];
  const projects = currentWorkspace?.projects || [];
  const members = currentWorkspace?.members || [];
  const workspaceInfo = currentWorkspace?.workspace;

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim() || !currentWorkspaceId) return;

    try {
      await api.post(`/workspaces/${currentWorkspaceId}/projects`, { name: folderName.trim() });
      setFolderName('');
      setNewFolderOpen(false);
      await refreshCurrentWorkspace();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleCreateWhiteboard = async () => {
    if (!currentWorkspaceId) return;
    try {
      setCreatingWhiteboard(true);
      const res = await api.post('/whiteboards', {
        workspaceId: currentWorkspaceId,
        title: 'Untitled Whiteboard'
      });
      await refreshCurrentWorkspace();
      navigate(`/workspace/${currentWorkspaceId}/whiteboard/${res.whiteboard.id}`);
    } catch (err) {
      console.error('Failed to create whiteboard:', err);
    } finally {
      setCreatingWhiteboard(false);
    }
  };

  return (
    <aside
      className={`sidebar-responsive ${isOpenMobile ? 'open' : ''}`}
      style={{
        width: '240px',
        minWidth: '240px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e5e5',
        height: 'calc(100vh - 52px)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}
    >
      <div style={{ padding: '16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Workspace Hub Header */}
        <div
          onClick={() => navigate(`/workspace/${currentWorkspaceId}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: location.pathname === `/workspace/${currentWorkspaceId}` ? '#f0f0f0' : 'transparent',
            cursor: 'pointer'
          }}
          className="btn-ghost"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={15} color="#111111" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>Workspace Overview</span>
          </div>
        </div>

        {/* Projects / Folders */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Folders
            </span>
            <button
              onClick={() => setNewFolderOpen(true)}
              className="btn-ghost"
              style={{ padding: '2px', borderRadius: '4px' }}
              title="New Folder"
            >
              <Plus size={14} color="#666666" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {projects.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#aaaaaa', padding: '4px 6px' }}>No folders created</div>
            ) : (
              projects.map((p) => {
                const isSelected = selectedFolderId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedFolderId(isSelected ? null : p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '5px',
                      fontSize: '12.5px',
                      color: isSelected ? '#111111' : '#444444',
                      backgroundColor: isSelected ? '#f5f5f5' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 500 : 400
                    }}
                    className="btn-ghost"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <Folder size={13} color="#666666" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#888888' }}>{p.doc_count || 0}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Documents ({documents.length})
            </span>
            <button
              onClick={() => setTemplatePickerOpen(true)}
              className="btn-ghost"
              style={{ padding: '2px', borderRadius: '4px' }}
              title="New Document from Template"
            >
              <Plus size={14} color="#666666" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {documents.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#aaaaaa', padding: '4px 6px' }}>No documents yet</div>
            ) : (
              documents.map((d) => {
                const isActive = location.pathname.includes(`/doc/${d.id}`);
                return (
                  <div
                    key={d.id}
                    onClick={() => navigate(`/workspace/${currentWorkspaceId}/doc/${d.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      fontSize: '12.5px',
                      color: isActive ? '#111111' : '#444444',
                      backgroundColor: isActive ? '#f0f0f0' : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      borderLeft: isActive ? '2px solid #111111' : '2px solid transparent'
                    }}
                    className="btn-ghost"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <FileText size={13} color={isActive ? '#111111' : '#777777'} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.title}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Collaborative Whiteboards Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Whiteboards ({whiteboards.length})
            </span>
            <button
              onClick={handleCreateWhiteboard}
              disabled={creatingWhiteboard}
              className="btn-ghost"
              style={{ padding: '2px', borderRadius: '4px' }}
              title="New Whiteboard"
            >
              <Plus size={14} color="#666666" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {whiteboards.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#aaaaaa', padding: '4px 6px' }}>No whiteboards yet</div>
            ) : (
              whiteboards.map((w) => {
                const isActive = location.pathname.includes(`/whiteboard/${w.id}`);
                return (
                  <div
                    key={w.id}
                    onClick={() => navigate(`/workspace/${currentWorkspaceId}/whiteboard/${w.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '5px',
                      fontSize: '12.5px',
                      color: isActive ? '#111111' : '#444444',
                      backgroundColor: isActive ? '#f0f0f0' : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      borderLeft: isActive ? '2px solid #111111' : '2px solid transparent'
                    }}
                    className="btn-ghost"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <Layout size={13} color={isActive ? '#111111' : '#777777'} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.title}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Members count & Workspace Settings */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid #eeeeee',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div
          onClick={() => navigate(`/workspace/${currentWorkspaceId}/settings`)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#555555' }}
          className="btn-ghost"
        >
          <Users size={14} />
          <span>{members.length} member{members.length === 1 ? '' : 's'}</span>
        </div>

        <button
          onClick={() => navigate(`/workspace/${currentWorkspaceId}/settings`)}
          className="btn-ghost"
          style={{ padding: '4px', borderRadius: '4px' }}
          title="Workspace Settings"
        >
          <Settings size={14} color="#666666" />
        </button>
      </div>

      {/* New Folder Modal */}
      <Modal
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Create New Folder"
        maxWidth="380px"
        footer={
          <>
            <button onClick={() => setNewFolderOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleCreateFolder} className="btn btn-primary">
              Create Folder
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
            Folder Name
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g. Q4 Roadmaps, Technical Specs"
            autoFocus
            style={{ width: '100%', height: '36px' }}
          />
        </div>
      </Modal>

      {/* Template Picker Modal */}
      <TemplatePickerModal
        isOpen={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        projectId={selectedFolderId}
      />
    </aside>
  );
}
