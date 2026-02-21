import React from 'react';
import { T } from '../shared';

function canAccessItem(item, role) {
  if (!item?.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

export default function SidebarNav({
  navGroups,
  profile,
  page,
  openGroups,
  toggleGroup,
  onSelectPage,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  signOut,
  darkMode,
}) {
  const bg = darkMode
    ? 'linear-gradient(180deg, #111a16 0%, #0c1411 100%)'
    : `linear-gradient(180deg, ${T.sidebar} 0%, #15241c 100%)`;

  return (
    <>
      <div
        style={{
          width: isMobile ? '100%' : 268,
          maxWidth: isMobile ? 308 : 268,
          background: bg,
          padding: '18px 12px',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: isMobile ? (sidebarOpen ? 0 : -320) : 0,
          height: '100vh',
          zIndex: 100,
          transition: 'left 0.25s ease',
          boxShadow: isMobile && sidebarOpen ? '4px 0 20px rgba(0,0,0,0.35)' : 'inset -1px 0 0 rgba(255,255,255,0.05)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 18,
            padding: '14px 10px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 4 }}>🌿</div>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>Dust Bunnies</h2>
          <p style={{ color: '#9CB8A9', fontSize: 11, margin: '2px 0 0' }}>Admin Dashboard</p>
          {profile && (
            <p style={{ color: '#5A8A72', fontSize: 10, margin: '6px 0 0' }}>
              {profile.full_name || profile.email}
            </p>
          )}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {navGroups.map((group, gi) => {
            const visibleItems = group.items.filter((item) => canAccessItem(item, profile?.role || 'admin'));
            if (!visibleItems.length) return null;

            const isOpen = openGroups.has(group.label);
            const groupBadge = visibleItems.reduce((sum, i) => sum + (Number(i.badge) || 0), 0);
            const hasActive = visibleItems.some((i) => i.id === page);

            return (
              <div key={group.label} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: hasActive || isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    color: hasActive || isOpen ? '#EAF4EE' : '#9BB7A8',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{group.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
                  {!isOpen && groupBadge > 0 && (
                    <span
                      style={{
                        background: T.accent,
                        color: T.sidebar,
                        padding: '1px 6px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {groupBadge}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      color: '#7FA693',
                      transition: 'transform 0.2s',
                      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  >
                    ▶
                  </span>
                </button>

                <div
                  style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? '540px' : '0px',
                    transition: 'max-height 0.25s ease',
                    paddingLeft: 6,
                    marginTop: 4,
                  }}
                >
                  {visibleItems.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onSelectPage(n.id);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 9,
                        background: page === n.id ? 'rgba(255,255,255,0.16)' : 'transparent',
                        border: page === n.id ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                        cursor: 'pointer',
                        color: page === n.id ? '#fff' : '#AEC6BA',
                        fontSize: 13,
                        fontWeight: page === n.id ? 700 : 500,
                        textAlign: 'left',
                        width: '100%',
                        marginBottom: 2,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{n.icon}</span>
                      <span style={{ flex: 1 }}>{n.label}</span>
                      {n.badge > 0 && (
                        <span
                          style={{
                            background: T.accent,
                            color: T.sidebar,
                            padding: '2px 7px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {n.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {gi < navGroups.length - 1 && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 8px 2px' }} />
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            color: '#8FB5A1',
            fontSize: 12,
            fontWeight: 700,
            marginTop: 8,
            width: '100%',
          }}
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            backdropFilter: 'blur(3px)',
            zIndex: 99,
          }}
        />
      )}
    </>
  );
}
