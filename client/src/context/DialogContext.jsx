import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  // Toasts
  const [toasts, setToasts] = useState([]);

  // Confirm / Alert Modal
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
    resolve: null
  });

  // Prompt Modal
  const [promptState, setPromptState] = useState({
    isOpen: false,
    title: '',
    message: '',
    defaultValue: '',
    placeholder: '',
    confirmText: 'Submit',
    cancelText: 'Cancel',
    resolve: null
  });
  const [promptInput, setPromptInput] = useState('');

  // Toast dispatch
  const toast = useCallback(({ title, message, type = 'info', duration = 3500 }) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Custom confirm replacement
  const confirm = useCallback(({ title = 'Are you sure?', message, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        isDestructive,
        resolve
      });
    });
  }, []);

  const handleConfirmClose = (result) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  // Custom prompt replacement
  const prompt = useCallback(({ title = 'Input required', message = '', defaultValue = '', placeholder = '', confirmText = 'Submit', cancelText = 'Cancel' }) => {
    setPromptInput(defaultValue);
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title,
        message,
        defaultValue,
        placeholder,
        confirmText,
        cancelText,
        resolve
      });
    });
  }, []);

  const handlePromptSubmit = (e) => {
    if (e) e.preventDefault();
    if (promptState.resolve) {
      promptState.resolve(promptInput);
    }
    setPromptState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handlePromptCancel = () => {
    if (promptState.resolve) {
      promptState.resolve(null);
    }
    setPromptState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  // Alert shortcut (confirm modal with no cancel button)
  const alert = useCallback(({ title = 'Notification', message = '', buttonText = 'OK' }) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmText: buttonText,
        cancelText: null,
        isDestructive: false,
        resolve
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ toast, confirm, prompt, alert }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((t) => {
          let Icon = Info;
          if (t.type === 'success') Icon = CheckCircle2;
          if (t.type === 'error') Icon = AlertCircle;
          if (t.type === 'warning') Icon = AlertTriangle;

          return (
            <div
              key={t.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #111111',
                borderRadius: '8px',
                padding: '12px 14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                pointerEvents: 'auto',
                animation: 'fadeSlideIn 0.2s ease forwards'
              }}
            >
              <Icon size={16} color="#111111" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                {t.title && (
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111', lineHeight: 1.3 }}>
                    {t.title}
                  </div>
                )}
                {t.message && (
                  <div style={{ fontSize: '12px', color: '#555555', marginTop: '2px', lineHeight: 1.4 }}>
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#888888', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modern Confirm Modal */}
      {confirmState.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '10px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.16)',
              animation: 'dialogPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111111', marginBottom: '8px' }}>
              {confirmState.title}
            </h3>
            <p style={{ fontSize: '13.5px', color: '#555555', lineHeight: 1.5, marginBottom: '22px' }}>
              {confirmState.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {confirmState.cancelText && (
                <button
                  type="button"
                  onClick={() => handleConfirmClose(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '13px', height: '34px' }}
                >
                  {confirmState.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={confirmState.isDestructive ? 'btn btn-primary' : 'btn btn-primary'}
                style={{
                  fontSize: '13px',
                  height: '34px',
                  backgroundColor: confirmState.isDestructive ? '#111111' : '#111111'
                }}
                autoFocus
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Prompt Modal */}
      {promptState.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <form
            onSubmit={handlePromptSubmit}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '10px',
              padding: '24px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.16)',
              animation: 'dialogPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111111', marginBottom: '6px' }}>
              {promptState.title}
            </h3>
            {promptState.message && (
              <p style={{ fontSize: '13px', color: '#666666', lineHeight: 1.4, marginBottom: '14px' }}>
                {promptState.message}
              </p>
            )}

            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={promptState.placeholder}
                autoFocus
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13.5px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cccccc',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePromptCancel}
                className="btn btn-secondary"
                style={{ fontSize: '13px', height: '34px' }}
              >
                {promptState.cancelText}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '13px', height: '34px' }}
              >
                {promptState.confirmText}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return ctx;
}
