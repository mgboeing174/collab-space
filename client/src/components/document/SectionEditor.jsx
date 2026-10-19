import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Unlock,
  User,
  ChevronUp,
  ChevronDown,
  Trash2,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Check,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { api } from '../../utils/api.js';

export default function SectionEditor({
  section,
  documentId,
  isFirst,
  isLast,
  workspaceMembers = [],
  onMoveUp,
  onMoveDown,
  onDelete,
  onAssign,
  onSectionSaved
}) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [title, setTitle] = useState(section.title || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isLockedByMe, setIsLockedByMe] = useState(section.locked_by === user?.id);
  const [lockedBy, setLockedBy] = useState(section.locked_by);
  const [lockedByName, setLockedByName] = useState(section.locked_by_name || section.locked_user_name);
  const [assignedTo, setAssignedTo] = useState(section.assigned_to);
  const [assignedName, setAssignedName] = useState(section.assigned_name || section.assigned_user_name);
  const [version, setVersion] = useState(section.version || 1);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error' | 'syncing'

  const contentRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  // Sync props when remote changes occur
  useEffect(() => {
    setTitle(section.title || '');
    setLockedBy(section.locked_by);
    setLockedByName(section.locked_by_name || section.locked_user_name);
    setIsLockedByMe(section.locked_by === user?.id);
    setAssignedTo(section.assigned_to);
    setAssignedName(section.assigned_name || section.assigned_user_name);
    setVersion(section.version || 1);

    // If not currently focused, update content HTML
    if (contentRef.current && document.activeElement !== contentRef.current) {
      if (contentRef.current.innerHTML !== (section.content || '')) {
        contentRef.current.innerHTML = section.content || '';
      }
    }
  }, [section, user?.id]);

  // Socket listener for real-time section updates from others
  useEffect(() => {
    if (!socket) return;

    const handleSectionUpdated = (data) => {
      if (data.sectionId === section.id && data.documentId === documentId) {
        if (data.updatedBy !== user?.id) {
          if (contentRef.current && document.activeElement !== contentRef.current) {
            contentRef.current.innerHTML = data.content || '';
          }
          if (data.title) setTitle(data.title);
          setVersion(data.version);
          setSaveStatus('syncing');
          setTimeout(() => setSaveStatus('saved'), 800);
        }
      }
    };

    const handleLockAcquired = (data) => {
      if (data.sectionId === section.id && data.documentId === documentId) {
        setLockedBy(data.lockedBy);
        setLockedByName(data.lockedByName);
        setIsLockedByMe(data.lockedBy === user?.id);
      }
    };

    const handleLockReleased = (data) => {
      if (data.sectionId === section.id && data.documentId === documentId) {
        setLockedBy(null);
        setLockedByName(null);
        setIsLockedByMe(false);
      }
    };

    const handleAssignment = (data) => {
      if (data.sectionId === section.id && data.documentId === documentId) {
        setAssignedTo(data.assignedTo);
        setAssignedName(data.assignedName);
      }
    };

    const handleSaveAck = (data) => {
      if (data.sectionId === section.id) {
        setVersion(data.version);
        setSaveStatus('saved');
      }
    };

    socket.on('section_updated', handleSectionUpdated);
    socket.on('section_lock_acquired', handleLockAcquired);
    socket.on('section_lock_released', handleLockReleased);
    socket.on('section_assignment_updated', handleAssignment);
    socket.on('section_saved_ack', handleSaveAck);

    return () => {
      socket.off('section_updated', handleSectionUpdated);
      socket.off('section_lock_acquired', handleLockAcquired);
      socket.off('section_lock_released', handleLockReleased);
      socket.off('section_assignment_updated', handleAssignment);
      socket.off('section_saved_ack', handleSaveAck);
    };
  }, [socket, section.id, documentId, user?.id]);

  // Lock claim
  const claimLock = () => {
    if (lockedBy && lockedBy !== user?.id) return;
    if (socket) {
      socket.emit('claim_section_lock', { documentId, sectionId: section.id });
    }
    setIsLockedByMe(true);
    setLockedBy(user?.id);
    setLockedByName(user?.name);

    // Heartbeat every 25 seconds
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket) {
        socket.emit('heartbeat_section_lock', { documentId, sectionId: section.id });
      }
    }, 25000);
  };

  // Lock release
  const releaseLock = () => {
    if (!isLockedByMe) return;
    if (socket) {
      socket.emit('release_section_lock', { documentId, sectionId: section.id });
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    setIsLockedByMe(false);
    setLockedBy(null);
    setLockedByName(null);
  };

  // Debounced auto-save
  const triggerSave = useCallback(
    (newContent, newTitle) => {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const contentToSave = newContent !== undefined ? newContent : contentRef.current?.innerHTML || '';
          const titleToSave = newTitle !== undefined ? newTitle : title;

          // Broadcast via Socket.IO for sub-millisecond collaboration
          if (socket) {
            socket.emit('section_content_update', {
              documentId,
              sectionId: section.id,
              content: contentToSave,
              title: titleToSave,
              version
            });
          }

          // Persist to REST endpoint with version checking
          const res = await api.put(`/documents/${documentId}/sections/${section.id}`, {
            title: titleToSave,
            content: contentToSave,
            expectedVersion: version
          });

          setVersion(res.section.version);
          setSaveStatus('saved');
          if (onSectionSaved) onSectionSaved(res.section);
        } catch (err) {
          console.error('Failed to save section:', err);
          setSaveStatus('error');
        }
      }, 700);
    },
    [documentId, section.id, title, version, socket, onSectionSaved]
  );

  const handleContentInput = () => {
    if (!isLockedByMe) {
      claimLock();
    }
    triggerSave();
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    triggerSave(undefined, title);
  };

  // Rich text formatting execCommand helper
  const execFormat = (command, val = null) => {
    if (!isLockedByMe) claimLock();
    document.execCommand(command, false, val);
    contentRef.current?.focus();
    triggerSave();
  };

  const handleAssignChange = async (newAssigneeId) => {
    try {
      const res = await api.post(`/documents/${documentId}/sections/${section.id}/assign`, {
        assignedTo: newAssigneeId || null
      });
      setAssignedTo(res.section.assigned_to);
      setAssignedName(res.section.assigned_name);

      if (socket) {
        socket.emit('section_assigned', {
          documentId,
          sectionId: section.id,
          assignedTo: res.section.assigned_to,
          assignedName: res.section.assigned_name
        });
      }

      if (onAssign) onAssign(res.section);
    } catch (err) {
      console.error('Failed to assign section:', err);
    }
  };

  const isLockedByOther = lockedBy && lockedBy !== user?.id;

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: isLockedByOther
          ? '1.5px solid #cccccc'
          : isLockedByMe
          ? '1.5px solid #111111'
          : '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: isLockedByMe ? '0 4px 12px rgba(0,0,0,0.06)' : '0 1px 2px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {/* Section Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: isLockedByMe ? '#fafafa' : isLockedByOther ? '#f5f5f5' : '#ffffff',
          borderBottom: '1px solid #eeeeee'
        }}
      >
        {/* Left: Reorder controls & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="btn-ghost"
              style={{ padding: '1px', opacity: isFirst ? 0.3 : 1 }}
              title="Move section up"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="btn-ghost"
              style={{ padding: '1px', opacity: isLast ? 0.3 : 1 }}
              title="Move section down"
            >
              <ChevronDown size={13} />
            </button>
          </div>

          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
              style={{
                fontSize: '14px',
                fontWeight: 600,
                padding: '2px 6px',
                height: '28px',
                maxWidth: '260px'
              }}
            />
          ) : (
            <div
              onClick={() => !isLockedByOther && setIsEditingTitle(true)}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#111111',
                cursor: isLockedByOther ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Click to edit section title"
            >
              <span>{title}</span>
              <span style={{ fontSize: '11px', color: '#888888', fontWeight: 400 }}>v{version}</span>
            </div>
          )}
        </div>

        {/* Right: Section Ownership Assignment & Lock State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Assignment Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <User size={13} color="#777777" />
            <select
              value={assignedTo || ''}
              onChange={(e) => handleAssignChange(e.target.value)}
              style={{
                padding: '3px 6px',
                fontSize: '11.5px',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                color: assignedTo ? '#111111' : '#777777',
                fontWeight: assignedTo ? 500 : 400,
                cursor: 'pointer'
              }}
            >
              <option value="">Unassigned</option>
              {workspaceMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id === user?.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lock / Editing Status Badge & Controls */}
          {isLockedByOther ? (
            <div
              className="badge badge-locked"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}
              title={`Section currently claimed by ${lockedByName}`}
            >
              <Lock size={11} />
              <span>Editing: {lockedByName}</span>
            </div>
          ) : isLockedByMe ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="badge badge-active" style={{ padding: '3px 8px' }}>
                Editing by you
              </span>
              <button
                onClick={releaseLock}
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                title="Finish editing and release section lock"
              >
                <Unlock size={11} />
                <span>Done</span>
              </button>
            </div>
          ) : (
            <button
              onClick={claimLock}
              className="btn btn-secondary btn-sm"
              style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
              title="Claim lock to edit this section"
            >
              <Lock size={11} />
              <span>Claim to edit</span>
            </button>
          )}

          {/* Delete Section */}
          {!isLockedByOther && (
            <button
              onClick={() => onDelete(section.id)}
              className="btn-ghost"
              style={{ padding: '4px', borderRadius: '4px', color: '#888888' }}
              title="Delete section"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Editing Warning Banner if locked by someone else */}
      {isLockedByOther && (
        <div
          style={{
            padding: '6px 14px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            color: '#444444'
          }}
        >
          <Lock size={12} color="#444444" />
          <span>
            <strong>{lockedByName}</strong> is currently editing this section. Edits are synchronized in real time.
          </span>
        </div>
      )}

      {/* Formatting Toolbar (shown when user is editing) */}
      {isLockedByMe && (
        <div className="editor-toolbar">
          <button onClick={() => execFormat('bold')} className="toolbar-btn" title="Bold (⌘B)">
            <Bold size={13} />
          </button>
          <button onClick={() => execFormat('italic')} className="toolbar-btn" title="Italic (⌘I)">
            <Italic size={13} />
          </button>
          <button onClick={() => execFormat('strikeThrough')} className="toolbar-btn" title="Strikethrough">
            <Strikethrough size={13} />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => execFormat('formatBlock', '<h1>')} className="toolbar-btn" title="Heading 1">
            <Heading1 size={13} />
          </button>
          <button onClick={() => execFormat('formatBlock', '<h2>')} className="toolbar-btn" title="Heading 2">
            <Heading2 size={13} />
          </button>
          <button onClick={() => execFormat('formatBlock', '<h3>')} className="toolbar-btn" title="Heading 3">
            <Heading3 size={13} />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => execFormat('insertUnorderedList')} className="toolbar-btn" title="Bullet List">
            <List size={13} />
          </button>
          <button onClick={() => execFormat('insertOrderedList')} className="toolbar-btn" title="Numbered List">
            <ListOrdered size={13} />
          </button>
          <button onClick={() => execFormat('formatBlock', '<blockquote>')} className="toolbar-btn" title="Blockquote">
            <Quote size={13} />
          </button>
          <button onClick={() => execFormat('formatBlock', '<pre>')} className="toolbar-btn" title="Code Block">
            <Code size={13} />
          </button>
          <button
            onClick={() => {
              const url = window.prompt('Enter link URL:');
              if (url) execFormat('createLink', url);
            }}
            className="toolbar-btn"
            title="Insert Link"
          >
            <LinkIcon size={13} />
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#888888' }}>
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'syncing' && 'Syncing...'}
              {saveStatus === 'error' && 'Save failed'}
            </span>
            {saveStatus === 'saved' && <CheckCircle size={12} color="#111111" />}
            {saveStatus === 'error' && <AlertCircle size={12} color="#111111" />}
          </div>
        </div>
      )}

      {/* Rich Text Editable Content Area */}
      <div
        ref={contentRef}
        contentEditable={!isLockedByOther}
        suppressContentEditableWarning
        onFocus={claimLock}
        onInput={handleContentInput}
        className="rich-content-editable"
        data-placeholder="Start typing or format this section..."
        style={{
          cursor: isLockedByOther ? 'not-allowed' : 'text',
          opacity: isLockedByOther ? 0.8 : 1,
          backgroundColor: isLockedByOther ? '#fafafa' : '#ffffff'
        }}
      />
    </div>
  );
}
