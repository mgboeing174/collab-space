import React from 'react';
import {
  Heading,
  AlignLeft,
  FileText,
  List,
  ListOrdered,
  Quote,
  Code2,
  CheckSquare,
  Bookmark,
  Layers,
  Sparkles
} from 'lucide-react';

export const COMPONENT_BLOCKS = [
  {
    id: 'header-context',
    title: 'Document Header',
    category: 'Header',
    icon: Heading,
    description: 'Title banner with date, lead author, and status metadata block.',
    defaultContent: '<h1>Document Title</h1><p><strong>Date:</strong> ' + new Date().toISOString().split('T')[0] + ' &nbsp;|&nbsp; <strong>Author:</strong> Lead Collaborator &nbsp;|&nbsp; <strong>Status:</strong> Draft</p>'
  },
  {
    id: 'subheading-summary',
    title: 'Subheading & Executive Summary',
    category: 'Subheading',
    icon: Bookmark,
    description: 'Section headline with high-level summary paragraph for fast scanning.',
    defaultContent: '<h2>Executive Summary</h2><p>Provide a high-level overview of the strategic objectives, background motivation, and core takeaways of this document.</p>'
  },
  {
    id: 'main-body',
    title: 'Main Body Paragraphs',
    category: 'Body',
    icon: AlignLeft,
    description: 'Standard narrative paragraphs for detailed discussion and analysis.',
    defaultContent: '<p>Detail your analysis, implementation specifications, and core arguments here. Collaborators can claim this section to draft, refine, or review content collaboratively.</p>'
  },
  {
    id: 'bullet-points',
    title: 'Key Points / Bullets',
    category: 'Lists',
    icon: List,
    description: 'Bulleted list for highlights, specifications, or deliverables.',
    defaultContent: '<h3>Key Takeaways</h3><ul><li><strong>Point 1:</strong> Primary architectural principle or operational requirement.</li><li><strong>Point 2:</strong> Performance benchmark and reliability guarantee.</li><li><strong>Point 3:</strong> Scope boundaries and dependencies.</li></ul>'
  },
  {
    id: 'numbered-steps',
    title: 'Numbered Process / Steps',
    category: 'Lists',
    icon: ListOrdered,
    description: 'Ordered sequence for onboarding, release steps, or workflows.',
    defaultContent: '<h3>Step-by-Step Procedure</h3><ol><li><strong>Setup & Prerequisites:</strong> Verify environment variables and database access.</li><li><strong>Execution:</strong> Run automated integration tests and check socket status.</li><li><strong>Verification:</strong> Monitor real-time logs and user notifications.</li></ol>'
  },
  {
    id: 'action-checklist',
    title: 'Action Items & Checklist',
    category: 'Tasks',
    icon: CheckSquare,
    description: 'Task assignments with owners and target milestones.',
    defaultContent: '<h3>Action Items</h3><ul><li>[ ] <strong>Frontend:</strong> Refine responsive header layout</li><li>[ ] <strong>Backend:</strong> Benchmark Socket.IO event throughput</li><li>[ ] <strong>Design:</strong> Review minimalist grayscale consistency</li></ul>'
  },
  {
    id: 'quote-callout',
    title: 'Quote / Highlight Callout',
    category: 'Callouts',
    icon: Quote,
    description: 'Prominent blockquote for citations, vision statements, or client testimonials.',
    defaultContent: '<blockquote><p>"Simplicity is prerequisite for reliability. Keep the user experience focused and frictionless."</p></blockquote>'
  },
  {
    id: 'code-spec',
    title: 'Code / Technical Spec',
    category: 'Technical',
    icon: Code2,
    description: 'Code snippets, API endpoints, schema definitions, or CLI scripts.',
    defaultContent: '<h3>API Endpoint Specification</h3><pre><code>// POST /api/documents/:id/sections\n{\n  "title": "Architecture Overview",\n  "assignedTo": "user_id_123"\n}</code></pre>'
  },
  {
    id: 'footer-notes',
    title: 'Footer & Sign-offs',
    category: 'Footer',
    icon: Layers,
    description: 'Document closing with reference links, disclaimers, and sign-offs.',
    defaultContent: '<p><em>Confidential & Proprietary. Created collaboratively within CollabSpace.</em></p><p><strong>Sign-off:</strong> Approved by engineering leads. Next review scheduled for next sprint.</p>'
  }
];

export default function SectionComponentPicker({
  onSelectComponent,
  onCustomAdd,
  workspaceMembers = []
}) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#111111" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111111' }}>
              Add Pre-Built Section Component
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#666666', marginTop: '2px' }}>
            Click any component to append it directly into your document
          </p>
        </div>

        <button
          onClick={onCustomAdd}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '12px' }}
        >
          <span>Blank / Custom Title</span>
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '10px'
        }}
      >
        {COMPONENT_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <div
              key={block.id}
              onClick={() => onSelectComponent(block)}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                backgroundColor: '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#111111';
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e5e5';
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={15} color="#111111" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>
                    {block.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: '#888888',
                    letterSpacing: '0.04em'
                  }}
                >
                  {block.category}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#666666', lineHeight: 1.4 }}>
                {block.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
