import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  ChevronDown,
  Plus,
  Search,
  Bell,
  User,
  LogOut,
  FolderPlus,
  Share2,
  Settings,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import Avatar from '../common/Avatar.jsx';
import SearchModal from '../common/SearchModal.jsx';
import InviteModal from '../workspace/InviteModal.jsx';

export default function Navbar({ onToggleActivity, onToggleMobileSidebar, unreadCount = 0 }) {
  const { user, logout } = useAuth();
  const { workspaces, currentWorkspaceId, currentWorkspace, switchWorkspace, onlineMembers } = useWorkspace();
  const navigate = useNavigate();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const activeWs = workspaces.find((w) => w.id === currentWorkspaceId) || currentWorkspace?.workspace;

  return (
    <>
      <header
        style={{
          height: '52px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        {/* Left: Brand & Workspace Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Mobile hamburger menu toggle */}
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="mobile-nav-toggle"
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
          )}

          <div
            onClick={() => navigate('/workspaces')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '-0.03em',
              color: '#111111'
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                background: '#111111',
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Layers size={15} />
            </div>
            <span>CollabSpace</span>
          </div>

          <div style={{ width: '1px', height: '18px', background: '#e5e5e5' }} />

          {/* Workspace Switcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#111111'
              }}
            >
              <span>{activeWs ? activeWs.name : 'Select Workspace'}</span>
              <ChevronDown size={14} color="#666666" />
            </button>

            {wsDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setWsDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    width: '240px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                    padding: '6px'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#888888', padding: '6px 8px', textTransform: 'uppercase' }}>
                    Workspaces
                  </div>
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      onClick={() => {
                        switchWorkspace(ws.id);
                        setWsDropdownOpen(false);
                        navigate(`/workspace/${ws.id}`);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: ws.id === currentWorkspaceId ? '#f5f5f5' : 'transparent',
                        fontWeight: ws.id === currentWorkspaceId ? 600 : 400
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ws.name}
                      </span>
                      <span className="badge badge-default" style={{ fontSize: '10px' }}>
                        {ws.my_role || 'member'}
                      </span>
                    </div>
                  ))}

                  <div style={{ height: '1px', background: '#eeeeee', margin: '6px 0' }} />

                  <button
                    onClick={() => {
                      setWsDropdownOpen(false);
                      navigate('/workspaces?create=true');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      color: '#111111',
                      fontWeight: 500,
                      textAlign: 'left'
                    }}
                    className="btn-ghost"
                  >
                    <Plus size={14} />
                    <span>Create Workspace</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Search Trigger */}
        <div className="navbar-search-bar" style={{ flex: 1, maxWidth: '420px', margin: '0 16px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              backgroundColor: '#fafafa',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: '#888888',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={14} />
              <span>Search workspace documents, sections, boards...</span>
            </div>
            <kbd
              style={{
                fontFamily: 'inherit',
                fontSize: '10.5px',
                background: '#eeeeee',
                padding: '2px 5px',
                borderRadius: '3px',
                color: '#666666'
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Collaborators, Actions, Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Online Members Presence Pill Strip */}
          {onlineMembers.length > 0 && (
            <div
              className="navbar-online-strip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f5f5f5',
                border: '1px solid #eeeeee',
                padding: '2px 8px 2px 4px',
                borderRadius: '16px'
              }}
              title={`${onlineMembers.length} collaborator(s) online`}
            >
              <div style={{ display: 'flex', marginLeft: '2px' }}>
                {onlineMembers.slice(0, 4).map((m, idx) => (
                  <div key={m.userId || idx} style={{ marginLeft: idx > 0 ? '-6px' : '0' }}>
                    <Avatar name={m.userName} color={m.avatarColor} icon={m.avatarIcon} size={22} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#444444', marginLeft: '4px' }}>
                {onlineMembers.length} online
              </span>
            </div>
          )}

          {/* Invite Collaborator Button */}
          {currentWorkspaceId && (
            <button
              onClick={() => setInviteOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ height: '30px' }}
            >
              <Share2 size={13} />
              <span>Invite</span>
            </button>
          )}

          {/* Activity Drawer Toggle */}
          <button
            onClick={onToggleActivity}
            className="btn-ghost"
            style={{
              padding: '6px',
              borderRadius: '6px',
              position: 'relative',
              color: '#333333'
            }}
            title="Activity Feed"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '6px',
                  height: '6px',
                  background: '#111111',
                  borderRadius: '50%'
                }}
              />
            )}
          </button>

          <div style={{ width: '1px', height: '18px', background: '#e5e5e5' }} />

          {/* User Profile Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
            >
              <Avatar name={user?.name} color={user?.avatarColor} icon={user?.avatarIcon} size={28} />
            </button>

            {userDropdownOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    width: '210px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    overflow: 'hidden',
                    padding: '6px'
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #eeeeee' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111111' }}>{user?.name}</div>
                    <div style={{ fontSize: '11px', color: '#888888' }}>{user?.email}</div>
                  </div>

                  <div style={{ padding: '4px 0' }}>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/profile');
                      }}
                      className="btn-ghost"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        fontSize: '12.5px',
                        borderRadius: '6px',
                        textAlign: 'left'
                      }}
                    >
                      <User size={14} />
                      <span>Account Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/workspaces');
                      }}
                      className="btn-ghost"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        fontSize: '12.5px',
                        borderRadius: '6px',
                        textAlign: 'left'
                      }}
                    >
                      <Layers size={14} />
                      <span>All Workspaces</span>
                    </button>
                  </div>

                  <div style={{ height: '1px', background: '#eeeeee', margin: '4px 0' }} />

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="btn-ghost"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      color: '#111111',
                      borderRadius: '6px',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspace={activeWs}
      />
    </>
  );
}
