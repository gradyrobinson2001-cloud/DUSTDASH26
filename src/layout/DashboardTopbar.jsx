import React from 'react';
import { T } from '../shared';

export default function DashboardTopbar({
  isMobile,
  onOpenSidebar,
  pageLabel,
  globalSearch,
  setGlobalSearch,
  searchResults,
  onSelectSearchResult,
  notificationsCount,
  notificationSupported,
  notificationPermission,
  notificationsEnabled,
  onEnableNotifications,
  darkMode,
  setDarkMode,
}) {
  const notificationsReady = notificationSupported && notificationPermission === 'granted' && notificationsEnabled;
  const notificationsNeedsEnable = notificationSupported && !notificationsReady;
  const bellTitle = notificationsNeedsEnable
    ? 'Enable browser notifications'
    : 'Notifications';

  if (isMobile) {
    return (
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(6px)',
          background: darkMode ? 'rgba(17,25,21,0.92)' : 'rgba(243,241,234,0.92)',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : T.border}`,
          borderRadius: 14,
          padding: '10px 12px',
          marginBottom: 16,
          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.35)' : T.shadow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <button
            onClick={onOpenSidebar}
            style={{
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.18)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '7px 10px',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: darkMode ? '#9AB7A8' : T.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Dashboard</div>
            <div style={{ fontSize: 16, color: darkMode ? '#F2F8F5' : T.text, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageLabel}</div>
          </div>
          <button
            title={bellTitle}
            onClick={notificationsNeedsEnable ? onEnableNotifications : undefined}
            style={{
              position: 'relative',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '9px 10px',
              cursor: notificationsNeedsEnable ? 'pointer' : 'default',
            }}
          >
            🔔
            {(notificationsCount > 0 || notificationsNeedsEnable) && (
              <span
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  background: notificationsNeedsEnable ? '#C8A765' : '#C56058',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {notificationsNeedsEnable ? '!' : (notificationsCount > 9 ? '9+' : notificationsCount)}
              </span>
            )}
          </button>
          <button
            onClick={() => setDarkMode((v) => !v)}
            title="Toggle dark mode"
            style={{
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '9px 10px',
              cursor: 'pointer',
            }}
          >
            {darkMode ? '🌙' : '☀️'}
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search clients, jobs, staff, enquiries..."
            style={{
              width: '100%',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '11px 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />

          {globalSearch.trim().length > 1 && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: darkMode ? '#121c17' : '#fff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
                borderRadius: 10,
                boxShadow: darkMode ? '0 10px 26px rgba(0,0,0,0.4)' : T.shadowMd,
                overflow: 'hidden',
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelectSearchResult(result)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : T.borderLight}`,
                    background: 'transparent',
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: darkMode ? '#EAF4EE' : T.text,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{result.label}</div>
                  <div style={{ fontSize: 11, color: darkMode ? '#9AB7A8' : T.textMuted }}>{result.meta}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(6px)',
        background: darkMode ? 'rgba(17,25,21,0.92)' : 'rgba(243,241,234,0.92)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : T.border}`,
        borderRadius: 14,
        padding: isMobile ? '10px 12px' : '12px 14px',
        marginBottom: 16,
        boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.35)' : T.shadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isMobile && (
          <button
            onClick={onOpenSidebar}
            style={{
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.18)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '7px 10px',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
        )}

        <div style={{ minWidth: isMobile ? 88 : 170 }}>
          <div style={{ fontSize: 11, color: darkMode ? '#9AB7A8' : T.textMuted, textTransform: 'uppercase', fontWeight: 700 }}>Dashboard</div>
          <div style={{ fontSize: 16, color: darkMode ? '#F2F8F5' : T.text, fontWeight: 800 }}>{pageLabel}</div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search clients, jobs, staff, enquiries..."
            style={{
              width: '100%',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
              background: darkMode ? '#121c17' : '#fff',
              color: darkMode ? '#EAF4EE' : T.text,
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              outline: 'none',
            }}
          />

          {globalSearch.trim().length > 1 && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: darkMode ? '#121c17' : '#fff',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
                borderRadius: 10,
                boxShadow: darkMode ? '0 10px 26px rgba(0,0,0,0.4)' : T.shadowMd,
                overflow: 'hidden',
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelectSearchResult(result)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : T.borderLight}`,
                    background: 'transparent',
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: darkMode ? '#EAF4EE' : T.text,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{result.label}</div>
                  <div style={{ fontSize: 11, color: darkMode ? '#9AB7A8' : T.textMuted }}>{result.meta}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          title={bellTitle}
          onClick={notificationsNeedsEnable ? onEnableNotifications : undefined}
          style={{
            position: 'relative',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
            background: darkMode ? '#121c17' : '#fff',
            color: darkMode ? '#EAF4EE' : T.text,
            borderRadius: 10,
            padding: '9px 10px',
            cursor: notificationsNeedsEnable ? 'pointer' : 'default',
          }}
        >
          🔔
          {(notificationsCount > 0 || notificationsNeedsEnable) && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: notificationsNeedsEnable ? '#C8A765' : '#C56058',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {notificationsNeedsEnable ? '!' : (notificationsCount > 9 ? '9+' : notificationsCount)}
            </span>
          )}
        </button>

        <button
          onClick={() => setDarkMode((v) => !v)}
          title="Toggle dark mode"
          style={{
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : T.border}`,
            background: darkMode ? '#121c17' : '#fff',
            color: darkMode ? '#EAF4EE' : T.text,
            borderRadius: 10,
            padding: '9px 10px',
            cursor: 'pointer',
          }}
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
      </div>
    </div>
  );
}
