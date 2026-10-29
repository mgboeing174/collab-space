import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layers, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

export default function InviteAcceptPage() {
  const { inviteCode } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { joinWorkspaceByCode } = useWorkspace();
  const navigate = useNavigate();

  const [status, setStatus] = useState('joining'); // 'joining' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Redirect to login with return redirect
      sessionStorage.setItem('collabspace_pending_invite', inviteCode);
      navigate(`/login?invite=${inviteCode}`);
      return;
    }

    async function accept() {
      try {
        const res = await joinWorkspaceByCode(inviteCode);
        setStatus('success');
        setTimeout(() => {
          if (res.targetType === 'document' || res.type === 'document') {
            navigate(`/workspace/${res.workspaceId}/doc/${res.documentId}`);
          } else if (res.targetType === 'whiteboard' || res.type === 'whiteboard') {
            navigate(`/workspace/${res.workspaceId}/whiteboard/${res.whiteboardId}`);
          } else {
            navigate(`/workspace/${res.workspaceId}`);
          }
        }, 1200);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to join workspace.');
      }
    }

    accept();
  }, [inviteCode, isAuthenticated, authLoading]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            backgroundColor: '#111111',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '16px'
          }}
        >
          <Layers size={22} />
        </div>

        {status === 'joining' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
              Joining Workspace...
            </h2>
            <p style={{ fontSize: '13.5px', color: '#666666' }}>
              Verifying your invitation code and syncing workspace access.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
              Workspace Joined!
            </h2>
            <p style={{ fontSize: '13.5px', color: '#666666' }}>
              Redirecting you to the workspace dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
              Invitation Failed
            </h2>
            <p style={{ fontSize: '13.5px', color: '#666666', marginBottom: '20px' }}>
              {errorMsg}
            </p>
            <button onClick={() => navigate('/workspaces')} className="btn btn-primary" style={{ width: '100%' }}>
              <span>Go to Workspaces</span>
              <ArrowRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
