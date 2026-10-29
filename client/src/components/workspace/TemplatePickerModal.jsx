import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlignLeft, CheckSquare, Briefcase, FileCode, Edit3, ArrowRight, Sparkles, Layers } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import { api } from '../../utils/api.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';

const TEMPLATES = [
  {
    id: 'freestyle',
    name: 'Freestyle (Empty Document)',
    badge: 'Blank Canvas',
    description: 'Empty collaborative document. Build sections on the fly choosing from headers, body, subheadings, bullet points, checklists, and footers.',
    sections: ['Header', 'Subheading', 'Body', 'Bullets', 'Checklist', 'Footer'],
    icon: Sparkles
  },
  {
    id: 'header-body-footer',
    name: 'Header → Body → Footer',
    badge: '3 Sections',
    description: 'Clean standard layout: Header context, main analytical body, and sign-off footer.',
    sections: ['Header & Context', 'Main Body', 'Footer & References'],
    icon: AlignLeft
  },
  {
    id: 'header-subheading-content-footer',
    name: 'Header → Subheading → Content → Footer',
    badge: '4 Sections',
    description: 'Structured layout with an executive summary, granular specs, and next steps.',
    sections: ['Document Header', 'Executive Summary', 'Detailed Content', 'Closing & Next Steps'],
    icon: FileText
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    badge: '4 Sections',
    description: 'Structured agenda with live discussion notes, decisions, and action item ownership.',
    sections: ['Overview & Attendees', 'Discussion Points', 'Decisions Made', 'Action Items & Deliverables'],
    icon: CheckSquare
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    badge: '5 Sections',
    description: 'Multi-section proposal with goals, architecture, schedule, and risk assessment.',
    sections: ['Title & Abstract', 'Goals & Metrics', 'Technical Solution', 'Timeline & Budget', 'Risks & Mitigations'],
    icon: Briefcase
  },
  {
    id: 'task-report',
    name: 'Task Report',
    badge: '4 Sections',
    description: 'Detailed sprint delivery summary with implementation notes, challenges, and verification.',
    sections: ['Task Summary & Status', 'Implementation Details', 'Blockers & Challenges', 'Verification & Sign-off'],
    icon: FileCode
  },
  {
    id: 'research-document',
    name: 'Research Document',
    badge: '5 Sections',
    description: 'Academic/technical document structure with hypothesis, prior art, methodology, and findings.',
    sections: ['Abstract & Hypothesis', 'Literature Review', 'Methodology', 'Findings & Analysis', 'Conclusion'],
    icon: FileText
  },
  {
    id: 'custom',
    name: 'Custom Template',
    badge: 'Flexible',
    description: 'Start with an adaptable multi-section blank slate that your team can customize.',
    sections: ['Introduction', 'Main Content', 'Summary & Notes'],
    icon: Edit3
  }
];

export default function TemplatePickerModal({ isOpen, onClose, projectId = null }) {
  const { currentWorkspaceId, currentWorkspace, refreshCurrentWorkspace } = useWorkspace();
  const [selectedTemplate, setSelectedTemplate] = useState('meeting-notes');
  const [title, setTitle] = useState('');
  const [selectedProj, setSelectedProj] = useState(projectId || '');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const projects = currentWorkspace?.projects || [];

  const handleCreate = async () => {
    if (!currentWorkspaceId) return;

    try {
      setLoading(true);
      const docTitle = title.trim() || `${TEMPLATES.find((t) => t.id === selectedTemplate)?.name || 'Document'}`;
      const res = await api.post('/documents', {
        workspaceId: currentWorkspaceId,
        projectId: selectedProj || null,
        title: docTitle,
        templateType: selectedTemplate
      });

      await refreshCurrentWorkspace();
      onClose();
      navigate(`/workspace/${currentWorkspaceId}/doc/${res.document.id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Document from Template"
      maxWidth="680px"
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading} className="btn btn-primary">
            <span>{loading ? 'Creating...' : 'Create Document'}</span>
            <ArrowRight size={14} />
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Sprint Planning, Architecture Proposal"
              style={{ width: '100%', height: '38px', fontSize: '14px' }}
            />
          </div>

          {projects.length > 0 && (
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '6px' }}>
                Project / Folder
              </label>
              <select
                value={selectedProj}
                onChange={(e) => setSelectedProj(e.target.value)}
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
              >
                <option value="">No Project (Root)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
            Choose Structural Template (Section-based collaboration)
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '10px',
              maxHeight: '380px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            {TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              const isSelected = selectedTemplate === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isSelected ? '1.5px solid #111111' : '1px solid #e0e0e0',
                    backgroundColor: isSelected ? '#fafafa' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} color="#111111" />
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111111' }}>{tmpl.name}</span>
                    </div>
                    <span className="badge badge-default" style={{ fontSize: '10px' }}>
                      {tmpl.badge}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#666666', marginBottom: '10px', lineHeight: 1.4 }}>
                    {tmpl.description}
                  </p>

                  {/* Visual preview of independent sections */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {tmpl.sections.map((sec, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '10.5px',
                          background: '#eeeeee',
                          color: '#333333',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #e0e0e0'
                        }}
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
