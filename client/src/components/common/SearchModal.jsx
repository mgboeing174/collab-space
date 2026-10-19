import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Layout, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import Modal from './Modal.jsx';

export default function SearchModal({ isOpen, onClose }) {
  const { currentWorkspaceId } = useWorkspace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ documents: [], sections: [], whiteboards: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults({ documents: [], sections: [], whiteboards: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || !currentWorkspaceId) {
      setResults({ documents: [], sections: [], whiteboards: [] });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.get(`/search/workspace/${currentWorkspaceId}?q=${encodeURIComponent(query.trim())}`);
        setResults(res);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, currentWorkspaceId]);

  const handleSelectDoc = (docId) => {
    onClose();
    navigate(`/workspace/${currentWorkspaceId}/doc/${docId}`);
  };

  const handleSelectWhiteboard = (wbId) => {
    onClose();
    navigate(`/workspace/${currentWorkspaceId}/whiteboard/${wbId}`);
  };

  const hasResults =
    results.documents?.length > 0 ||
    results.sections?.length > 0 ||
    results.whiteboards?.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Workspace" maxWidth="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#888888' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, section content, or whiteboards..."
            style={{ width: '100%', paddingLeft: '36px', height: '38px', fontSize: '14px' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: '10px', top: '9px', color: '#888888' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '16px', color: '#888888', fontSize: '13px' }}>
            Searching...
          </div>
        )}

        {!loading && query && !hasResults && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#888888', fontSize: '13.5px' }}>
            No matches found for "{query}".
          </div>
        )}

        {!loading && hasResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '50vh', overflowY: 'auto' }}>
            {results.documents?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Documents ({results.documents.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {results.documents.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDoc(d.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#fafafa',
                        border: '1px solid #eeeeee',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="#333333" />
                        <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#111111' }}>{d.title}</span>
                      </div>
                      <ArrowRight size={14} color="#888888" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.sections?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Section Matches ({results.sections.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {results.sections.map((s) => (
                    <div
                      key={s.section_id}
                      onClick={() => handleSelectDoc(s.document_id)}
                      style={{
                        padding: '8px 12px',
                        background: '#fafafa',
                        border: '1px solid #eeeeee',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{s.section_title}</span>
                        <span style={{ fontSize: '11px', color: '#888888' }}>in {s.document_title}</span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#555555',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {s.content.replace(/<[^>]+>/g, ' ').slice(0, 100)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.whiteboards?.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Whiteboards ({results.whiteboards.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {results.whiteboards.map((w) => (
                    <div
                      key={w.id}
                      onClick={() => handleSelectWhiteboard(w.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#fafafa',
                        border: '1px solid #eeeeee',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layout size={16} color="#333333" />
                        <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#111111' }}>{w.title}</span>
                      </div>
                      <ArrowRight size={14} color="#888888" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
