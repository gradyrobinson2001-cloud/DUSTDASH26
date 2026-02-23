import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, supabaseReady } from '../lib/supabase';
import { T } from '../shared';

const DEFAULT_COLOR_LEGEND = [
  { id: 'light', label: 'Light', color: '#BFE3C8' },
  { id: 'standard', label: 'Standard', color: '#BFD7EF' },
  { id: 'heavy', label: 'Heavy', color: '#F0D1AE' },
  { id: 'deep_clean', label: 'Deep Clean', color: '#EAB6B6' },
];

const DEFAULT_SECTIONS = [
  { id: 'main', label: 'Main' },
  { id: 'upstairs', label: 'Upstairs' },
  { id: 'downstairs', label: 'Downstairs' },
  { id: 'outbuilding', label: 'Outbuilding' },
];

function normalizeLegend(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_COLOR_LEGEND;
  return raw
    .map((item, index) => ({
      id: String(item?.id || `color_${index + 1}`),
      label: String(item?.label || `Color ${index + 1}`),
      color: String(item?.color || DEFAULT_COLOR_LEGEND[index % DEFAULT_COLOR_LEGEND.length].color),
    }))
    .filter((item) => item.id && item.color);
}

function normalizeSections(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SECTIONS;
  return raw
    .map((item, index) => ({
      id: String(item?.id || `section_${index + 1}`),
      label: String(item?.label || `Section ${index + 1}`),
    }))
    .filter((item) => item.id);
}

function hexToRgb(hex) {
  const safe = String(hex || '').replace('#', '');
  const full = safe.length === 3
    ? `${safe[0]}${safe[0]}${safe[1]}${safe[1]}${safe[2]}${safe[2]}`
    : safe;
  const int = parseInt(full, 16);
  if (!Number.isFinite(int)) return { r: 191, g: 215, b: 239 };
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function toRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex, amount = 0.22) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const next = (value) => clamp(value * (1 - amount));
  return `rgb(${next(r)}, ${next(g)}, ${next(b)})`;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function StaffFloorPlanView() {
  const navigate = useNavigate();
  const { id: clientId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [legend, setLegend] = useState(DEFAULT_COLOR_LEGEND);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [activeSectionId, setActiveSectionId] = useState('main');
  const [imageUrl, setImageUrl] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadFloorPlan = async () => {
      if (!supabaseReady || !supabase) {
        if (!cancelled) {
          setError('Supabase is not configured for this environment.');
          setLoading(false);
        }
        return;
      }

      if (!clientId) {
        if (!cancelled) {
          setError('Missing client id.');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError('');

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message || 'Failed to load session.');
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Session expired. Please sign in again.');

        const { data: clientRow, error: clientError } = await supabase
          .from('clients')
          .select('id, name, address, suburb')
          .eq('id', clientId)
          .maybeSingle();
        if (clientError) throw new Error(clientError.message || 'Failed to load client.');
        if (!clientRow) throw new Error('Client not found.');

        const { data: floorPlanRow, error: floorPlanError } = await supabase
          .from('floor_plans')
          .select('id, color_legend, house_sections, reference_image_path, updated_at')
          .eq('client_id', clientId)
          .maybeSingle();
        if (floorPlanError) throw new Error(floorPlanError.message || 'Failed to load floor plan.');

        if (!floorPlanRow) {
          if (!cancelled) {
            setClient(clientRow);
            setRooms([]);
            setImageUrl('');
            setLegend(DEFAULT_COLOR_LEGEND);
            setSections(DEFAULT_SECTIONS);
            setActiveSectionId(DEFAULT_SECTIONS[0].id);
            setUpdatedAt('');
          }
          return;
        }

        const normalizedLegend = normalizeLegend(floorPlanRow.color_legend);
        const normalizedSections = normalizeSections(floorPlanRow.house_sections);

        const { data: roomRows, error: roomError } = await supabase
          .from('rooms')
          .select('id, name, x, y, width, height, difficulty_level, notes, section_key')
          .eq('floor_plan_id', floorPlanRow.id)
          .order('y', { ascending: true })
          .order('x', { ascending: true });
        if (roomError) throw new Error(roomError.message || 'Failed to load rooms.');

        const roomIds = (roomRows || []).map((room) => room.id).filter(Boolean);
        let pinRows = [];
        if (roomIds.length > 0) {
          const { data: pins, error: pinError } = await supabase
            .from('room_pins')
            .select('id, room_id, x, y, note')
            .in('room_id', roomIds);
          if (pinError) throw new Error(pinError.message || 'Failed to load room pins.');
          pinRows = pins || [];
        }

        const pinsByRoom = pinRows.reduce((acc, pin) => {
          const key = String(pin.room_id || '');
          if (!acc[key]) acc[key] = [];
          acc[key].push(pin);
          return acc;
        }, {});

        const hydratedRooms = (roomRows || []).map((room) => ({
          ...room,
          section_key: String(room.section_key || normalizedSections[0]?.id || 'main'),
          difficulty_level: String(room.difficulty_level || normalizedLegend[0]?.id || 'standard'),
          pins: pinsByRoom[String(room.id)] || [],
        }));

        let signedImageUrl = '';
        const imagePath = String(floorPlanRow.reference_image_path || '').trim();
        if (imagePath) {
          const response = await fetch('/api/floorplans/get-image-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ storagePath: imagePath, clientId }),
          });
          const body = await parseJsonSafe(response);
          if (response.ok && body?.signedUrl) signedImageUrl = body.signedUrl;
        }

        if (!cancelled) {
          setClient(clientRow);
          setLegend(normalizedLegend);
          setSections(normalizedSections);
          setActiveSectionId(normalizedSections[0]?.id || 'main');
          setRooms(hydratedRooms);
          setImageUrl(signedImageUrl);
          setUpdatedAt(String(floorPlanRow.updated_at || ''));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load floor plan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFloorPlan();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const legendById = useMemo(() => {
    const map = {};
    legend.forEach((item) => { map[item.id] = item; });
    return map;
  }, [legend]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => String(room.section_key || 'main') === String(activeSectionId || 'main'));
  }, [activeSectionId, rooms]);

  const canvasBounds = useMemo(() => {
    const minWidth = 960;
    const minHeight = 680;
    const maxX = filteredRooms.reduce((best, room) => Math.max(best, Number(room.x || 0) + Number(room.width || 0)), minWidth);
    const maxY = filteredRooms.reduce((best, room) => Math.max(best, Number(room.y || 0) + Number(room.height || 0)), minHeight);
    return { width: maxX + 40, height: maxY + 40 };
  }, [filteredRooms]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted }}>
        Loading floor plan...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: 16 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.textLight, letterSpacing: 0.6 }}>STAFF FLOOR PLAN VIEW</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{client?.name || 'Client'}</div>
            <div style={{ fontSize: 13, color: T.textMuted }}>{client?.address || client?.suburb || 'Address unavailable'}</div>
            {updatedAt && (
              <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>
                Updated {new Date(updatedAt).toLocaleString('en-AU')}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/cleaner')}
            style={{ border: `1px solid ${T.border}`, background: '#fff', color: T.text, borderRadius: 10, padding: '9px 12px', fontWeight: 800, cursor: 'pointer' }}
          >
            Back
          </button>
        </div>

        {error && (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, color: T.danger, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!error && rooms.length === 0 && (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, color: T.textMuted }}>
            No saved floor plan for this client yet.
          </div>
        )}

        {!error && rooms.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8, overflowX: 'auto' }}>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    style={{
                      border: `1px solid ${activeSectionId === section.id ? T.primary : T.border}`,
                      background: activeSectionId === section.id ? T.primaryLight : '#fff',
                      color: activeSectionId === section.id ? T.primaryDark : T.textMuted,
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '6px 10px',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ position: 'relative', height: '70vh', minHeight: 480, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'auto', background: '#F9F8F4' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: canvasBounds.width,
                      height: canvasBounds.height,
                      margin: '0 auto',
                      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  >
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt="Client floor plan"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.78, pointerEvents: 'none' }}
                      />
                    )}
                    {filteredRooms.map((room) => {
                      const legendItem = legendById[String(room.difficulty_level || '')] || legend[0];
                      const color = String(legendItem?.color || '#BFD7EF');
                      return (
                        <div
                          key={room.id}
                          style={{
                            position: 'absolute',
                            left: Number(room.x || 0),
                            top: Number(room.y || 0),
                            width: Number(room.width || 120),
                            height: Number(room.height || 100),
                            borderRadius: 10,
                            border: `2px solid ${darken(color, 0.24)}`,
                            background: toRgba(color, 0.36),
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ position: 'absolute', top: 4, left: 6, right: 6, background: 'rgba(255,255,255,0.85)', borderRadius: 7, fontSize: 12, fontWeight: 800, color: T.text, padding: '3px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {room.name || 'Room'}
                          </div>
                          {(room.pins || []).map((pin) => (
                            <div
                              key={pin.id}
                              title={pin.note || 'Pin'}
                              style={{
                                position: 'absolute',
                                left: `${Math.max(0, Math.min(100, Number(pin.x || 0) * 100))}%`,
                                top: `${Math.max(0, Math.min(100, Number(pin.y || 0) * 100))}%`,
                                transform: 'translate(-50%, -50%)',
                                width: 11,
                                height: 11,
                                borderRadius: '50%',
                                background: T.accent,
                                border: '2px solid #fff',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
                              }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>COLOR LEGEND</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {legend.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${T.border}`, background: item.color }} />
                      <span style={{ fontSize: 12, color: T.text }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, maxHeight: '70vh', overflow: 'auto' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, marginBottom: 8 }}>ROOM NOTES</div>
                {filteredRooms.length === 0 && (
                  <div style={{ fontSize: 12, color: T.textLight }}>No rooms in this section.</div>
                )}
                {filteredRooms.map((room) => (
                  <div key={room.id} style={{ padding: '8px 0', borderTop: `1px solid ${T.borderLight}` }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{room.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                      {room.notes ? room.notes : 'No notes'}
                    </div>
                    {Array.isArray(room.pins) && room.pins.length > 0 && (
                      <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>
                        {room.pins.length} pin{room.pins.length === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
