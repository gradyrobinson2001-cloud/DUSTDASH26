import React from "react";
import { T } from "../shared";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

export default function ToolsTab({
  scheduleClients,
  scheduledJobs,
  scheduleSettings,
  mapsLoaded,
  mapRef,
  distanceFrom,
  setDistanceFrom,
  distanceTo,
  setDistanceTo,
  distanceResult,
  calculatingDistance,
  handleDistanceCalculation,
  selectedRouteDate,
  setSelectedRouteDate,
  calculateRouteForDate,
  routeData,
  isMobile,
}) {
  const apiKeyMissing = !GOOGLE_MAPS_API_KEY;

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Tools</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Distance calculator & route planning</p>
        </div>
        {!mapsLoaded && !apiKeyMissing && (
          <div style={{ padding: "8px 16px", background: T.accentLight, borderRadius: T.radiusSm, fontSize: 12, color: "#8B6914" }}>Loading Maps...</div>
        )}
        {apiKeyMissing && (
          <div style={{ padding: "8px 16px", background: T.dangerLight, borderRadius: T.radiusSm, fontSize: 12, color: T.danger }}>⚠️ Add Google Maps API key to enable</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>

        {/* Distance Calculator */}
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "24px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>📏</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Distance Calculator</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>Check distance between any two clients</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>FROM</label>
              <select value={distanceFrom} onChange={e => setDistanceFrom(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
                <option value="">Select client...</option>
                {scheduleClients.filter(c => c.status === "active").map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.suburb}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => { const temp = distanceFrom; setDistanceFrom(distanceTo); setDistanceTo(temp); }}
                style={{ padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, cursor: "pointer", color: T.textMuted }}
              >
                ↕️ Swap
              </button>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TO</label>
              <select value={distanceTo} onChange={e => setDistanceTo(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
                <option value="">Select client...</option>
                {scheduleClients.filter(c => c.status === "active" && c.id !== distanceFrom).map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.suburb}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDistanceCalculation}
              disabled={!distanceFrom || !distanceTo || calculatingDistance}
              style={{
                padding: "14px", borderRadius: T.radiusSm, border: "none", fontWeight: 700, fontSize: 14, color: "#fff",
                background: (!distanceFrom || !distanceTo || calculatingDistance) ? T.border : T.primary,
                cursor: (!distanceFrom || !distanceTo || calculatingDistance) ? "not-allowed" : "pointer",
              }}
            >
              {calculatingDistance ? "Calculating..." : "📍 Calculate Distance"}
            </button>
          </div>

          {distanceResult && (
            <div style={{ marginTop: 20, background: T.primaryLight, borderRadius: T.radius, padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
                {distanceResult.from.name} → {distanceResult.to.name}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.primary }}>{distanceResult.distanceText}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>distance</div>
                </div>
                <div style={{ width: 1, background: T.border }} />
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: T.blue }}>{distanceResult.durationText}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>drive time</div>
                </div>
              </div>
              {distanceResult.method === "estimate" && (
                <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>ℹ️ Estimated based on suburb locations</div>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "24px", boxShadow: T.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 24 }}>📊</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Quick Stats</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>Overview of your service area</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Object.entries(
              scheduleClients.filter(c => c.status === "active").reduce((acc, c) => {
                acc[c.suburb] = (acc[c.suburb] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).map(([suburb, count]) => (
              <div key={suburb} style={{ padding: "12px 14px", background: T.bg, borderRadius: T.radiusSm }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{suburb}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{count} client{count > 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
          {scheduleClients.filter(c => c.status === "active").length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: T.textLight }}>No active clients yet</div>
          )}
        </div>
      </div>

      {/* Route Visualizer */}
      <div style={{ marginTop: 24, background: "#fff", borderRadius: T.radius, padding: "24px", boxShadow: T.shadow }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🗺️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Route Visualizer</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>View team routes on the map</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="date" value={selectedRouteDate} onChange={e => setSelectedRouteDate(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
            <button onClick={() => calculateRouteForDate(selectedRouteDate)} style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Load Routes
            </button>
          </div>
        </div>

        {/* Route Summary Cards */}
        {routeData && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[{ key: "teamA", idx: 0 }, { key: "teamB", idx: 1 }].map(({ key, idx }) => {
              const team = scheduleSettings.teams[idx];
              const route = routeData[key];
              return (
                <div key={key} style={{ padding: "16px 20px", background: `${team?.color}15`, borderRadius: T.radius, borderLeft: `4px solid ${team?.color}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>{team?.name || `Team ${idx === 0 ? "A" : "B"}`}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                    <span style={{ color: T.textMuted }}>🚗 <strong style={{ color: T.text }}>{route.totalDistance.toFixed(1)} km</strong></span>
                    <span style={{ color: T.textMuted }}>⏱️ <strong style={{ color: T.text }}>{route.totalDuration} mins</strong></span>
                    <span style={{ color: T.textMuted }}>📍 <strong style={{ color: T.text }}>{route.jobs?.length || 0} stops</strong></span>
                  </div>
                  {route.legs?.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 12 }}>
                      {route.legs.map((leg, i) => (
                        <div key={i} style={{ padding: "6px 0", borderBottom: i < route.legs.length - 1 ? `1px solid ${T.border}` : "none" }}>
                          <span style={{ color: T.text }}>{leg.from.clientName}</span>
                          <span style={{ color: T.textLight }}> → </span>
                          <span style={{ color: T.text }}>{leg.to.clientName}</span>
                          <span style={{ color: T.textMuted, marginLeft: 8 }}>{leg.distanceText} · {leg.durationText}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Map Container */}
        <div ref={mapRef} style={{ width: "100%", height: 400, borderRadius: T.radius, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!mapsLoaded && (
            <div style={{ textAlign: "center", color: T.textMuted }}>
              {apiKeyMissing ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
                  <p style={{ margin: 0, fontWeight: 700 }}>Google Maps API Key Required</p>
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>Add your API key to enable the map</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  <p>Loading map...</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        {mapsLoaded && routeData && (
          <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
            {scheduleSettings.teams.map(team => (
              <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 4, borderRadius: 2, background: team.color }} />
                <span style={{ fontSize: 12, color: T.textMuted }}>{team.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
