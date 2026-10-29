export const DOCUMENT_TEMPLATES = {
  'freestyle': {
    name: 'Freestyle (Blank Canvas)',
    description: 'Empty collaborative canvas. Assemble sections freely using pre-built structural components.',
    sections: []
  },
  'header-body-footer': {
    name: 'Header → Body → Footer',
    description: 'Clean standard 3-tier document layout',
    sections: [
      {
        key: 'header',
        title: 'Header & Context',
        content: '<h1>Document Title</h1><p><strong>Date:</strong> [Enter Date] &nbsp;|&nbsp; <strong>Author:</strong> [Lead Author] &nbsp;|&nbsp; <strong>Status:</strong> Draft</p>'
      },
      {
        key: 'body',
        title: 'Main Body',
        content: '<p>Provide the core subject matter, analysis, and comprehensive discussion here. Collaborators can draft, format, and organize their ideas freely.</p>'
      },
      {
        key: 'footer',
        title: 'Footer & References',
        content: '<p><em>Confidential and proprietary. Prepared for internal collaborative review.</em></p><p>References, sign-offs, and approval notes go here.</p>'
      }
    ]
  },
  'header-subheading-content-footer': {
    name: 'Header → Subheading → Content → Footer',
    description: 'Structured document with dedicated subheadings and executive summary',
    sections: [
      {
        key: 'header',
        title: 'Document Header',
        content: '<h1>Strategic Brief</h1><p><strong>Department:</strong> Product & Engineering &nbsp;|&nbsp; <strong>Version:</strong> 1.0</p>'
      },
      {
        key: 'subheading',
        title: 'Executive Summary',
        content: '<h3>Executive Summary</h3><p>A concise overview of the purpose, core findings, and primary recommendation of this brief.</p>'
      },
      {
        key: 'content',
        title: 'Detailed Content & Specifications',
        content: '<p>Elaborate on detailed operational requirements, architecture, execution plan, and specific deliverables.</p>'
      },
      {
        key: 'footer',
        title: 'Closing & Next Steps',
        content: '<p><strong>Target Completion:</strong> Q4 &nbsp;|&nbsp; <strong>Next Review:</strong> Monday Standup</p>'
      }
    ]
  },
  'meeting-notes': {
    name: 'Meeting Notes',
    description: 'Collaborative meeting agenda, live notes, decisions, and action items',
    sections: [
      {
        key: 'overview',
        title: 'Meeting Overview & Attendees',
        content: '<h2>Team Sync Notes</h2><p><strong>Date:</strong> ' + new Date().toISOString().split('T')[0] + '<br/><strong>Facilitator:</strong> [Name]<br/><strong>Attendees:</strong> [List attendees]</p>'
      },
      {
        key: 'discussion',
        title: 'Discussion Points',
        content: '<h3>Key Topics</h3><ul><li><strong>Topic 1:</strong> Initial status updates and progress reviews</li><li><strong>Topic 2:</strong> Architecture decisions and blockers</li><li><strong>Topic 3:</strong> Timeline alignments</li></ul>'
      },
      {
        key: 'decisions',
        title: 'Decisions Made',
        content: '<h3>Decisions</h3><ul><li>Approved new real-time synchronization strategy.</li><li>Standardized on section-based collaboration protocol.</li></ul>'
      },
      {
        key: 'action-items',
        title: 'Action Items & Deliverables',
        content: '<h3>Action Items</h3><ul><li>[ ] <strong>Person A:</strong> Finalize API contract by Wednesday</li><li>[ ] <strong>Person B:</strong> Benchmark WebSocket latency</li><li>[ ] <strong>Person C:</strong> Review whiteboard canvas interactions</li></ul>'
      }
    ]
  },
  'project-proposal': {
    name: 'Project Proposal',
    description: 'Comprehensive multi-section proposal for team review',
    sections: [
      {
        key: 'title-abstract',
        title: 'Title & Abstract',
        content: '<h1>Project Proposal: Next-Gen Real-Time Platform</h1><p><strong>Proposers:</strong> Engineering Team<br/><strong>Summary:</strong> This proposal outlines the goals, technical design, and expected impact of CollabSpace.</p>'
      },
      {
        key: 'goals',
        title: 'Goals & Success Metrics',
        content: '<h3>Objectives</h3><ul><li>Enable frictionless multi-user editing without data loss.</li><li>Maintain low latency (<50ms) across document and whiteboard operations.</li><li>Deliver an elegant, minimal black-and-white visual experience.</li></ul>'
      },
      {
        key: 'solution',
        title: 'Proposed Solution & Technical Specs',
        content: '<h3>System Architecture</h3><p>Express REST backend + Socket.IO real-time sync with section locks and optimistic concurrency check. Built-in vector-like canvas for whiteboard.</p>'
      },
      {
        key: 'timeline',
        title: 'Timeline, Budget & Resources',
        content: '<h3>Milestone Schedule</h3><p><strong>Sprint 1:</strong> Foundations & Auth<br/><strong>Sprint 2:</strong> Document Engine & Section Locks<br/><strong>Sprint 3:</strong> Interactive Whiteboard<br/><strong>Sprint 4:</strong> Production Hardening</p>'
      },
      {
        key: 'risks',
        title: 'Risks & Mitigations',
        content: '<h3>Risk Matrix</h3><p><strong>Risk:</strong> Concurrent edits to the same section.<br/><strong>Mitigation:</strong> Temporary section locks with automatic 60s heartbeats and optimistic revision checks.</p>'
      }
    ]
  },
  'task-report': {
    name: 'Task Report',
    description: 'Structured progress, blocker, and verification report',
    sections: [
      {
        key: 'summary',
        title: 'Task Summary & Status',
        content: '<h2>Task Verification & Delivery</h2><p><strong>Task ID:</strong> ENG-2026<br/><strong>Status:</strong> Ready for Review<br/><strong>Owner:</strong> Core Team</p>'
      },
      {
        key: 'implementation',
        title: 'Implementation Details',
        content: '<h3>What was accomplished</h3><ul><li>Implemented secure token-based authentication and workspace permissions.</li><li>Created multi-user section lock & conflict resolution logic.</li><li>Constructed interactive whiteboard with shapes, text, sticky notes, and panning.</li></ul>'
      },
      {
        key: 'blockers',
        title: 'Blockers & Challenges',
        content: '<p>None currently blocking. Real-time test suite verified concurrent multi-tab connections.</p>'
      },
      {
        key: 'verification',
        title: 'Verification & Sign-off',
        content: '<p>All unit and integration scenarios passed. Memory leaks audited. Zero extraneous dependencies.</p>'
      }
    ]
  },
  'research-document': {
    name: 'Research Document',
    description: 'Academic or technical research paper structure',
    sections: [
      {
        key: 'abstract',
        title: 'Abstract & Research Question',
        content: '<h2>Abstract</h2><p>We investigate real-time collaborative synchronization strategies optimized for section-isolated multi-author documents.</p>'
      },
      {
        key: 'literature',
        title: 'Literature Review & Prior Art',
        content: '<h3>Related Work</h3><p>Prior work in Operational Transformation (OT) and CRDTs provides total document convergence, but often complicates fine-grained team role assignments and accountability.</p>'
      },
      {
        key: 'methodology',
        title: 'Methodology & Experimental Setup',
        content: '<h3>Experimental Protocol</h3><p>We evaluate an optimistic section-locking protocol combined with event-driven Socket.IO broadcasts and monotonic section version tags.</p>'
      },
      {
        key: 'findings',
        title: 'Findings & Analysis',
        content: '<h3>Results</h3><p>Empirical latency measurements demonstrate zero overwrite collisions across distributed simulated editors.</p>'
      },
      {
        key: 'conclusion',
        title: 'Conclusion & Future Work',
        content: '<h3>Conclusion</h3><p>Section-based isolation provides intuitive mental models for human teams while guaranteeing zero accidental overwrites.</p>'
      }
    ]
  },
  'custom': {
    name: 'Custom Template',
    description: 'Start with an adaptable multi-section blank canvas',
    sections: [
      {
        key: 'introduction',
        title: 'Introduction',
        content: '<h2>Document Introduction</h2><p>Start writing here. You can assign sections to team members or claim them when you are ready to write.</p>'
      },
      {
        key: 'main-content',
        title: 'Main Content',
        content: '<p>Collaborative content section. Formatting supports headings, bullet points, numbered lists, blockquotes, code blocks, and links.</p>'
      },
      {
        key: 'conclusion',
        title: 'Summary & Notes',
        content: '<p>Summary observations and action items.</p>'
      }
    ]
  }
};
