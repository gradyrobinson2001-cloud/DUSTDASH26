import React from 'react';
import { T } from '../shared';

export default function ComingSoonTab({ title, description }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: T.radiusLg,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        padding: 28,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24, color: T.text }}>{title}</h1>
      <p style={{ margin: '8px 0 0', color: T.textMuted, fontSize: 14 }}>{description}</p>
      <div
        style={{
          marginTop: 16,
          background: T.primaryLight,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          padding: '10px 12px',
          fontSize: 12,
          color: T.primaryDark,
          fontWeight: 600,
        }}
      >
        This section is scaffolded and route-ready. Connect your business logic next.
      </div>
    </div>
  );
}
