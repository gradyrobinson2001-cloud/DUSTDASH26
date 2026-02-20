import React, { useState, useMemo } from "react";
import { T } from "../shared";
import { optimiseRoute, routeSummary } from "../utils/routeOptimiser";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function ToolsTab({
  scheduleClients,
  scheduledJobs,
  scheduleSettings,
  mapsLoaded,
  mapsError,
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
  const apiKeyMissing = !GOOGLE_MAPS_API_KEY || mapsError === "missing_key";

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Tools</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Distance calculator & route planning</p>
        </div>
        {!mapsLoaded && !apiKeyMissing && !mapsError && (
          <div style={{ padding: "8px 16px", background: T.accentLight, borderRadius: T.radiusSm, fontSize: 12, color: "#8B6914" }}>Loading Maps...</div>
        )}
        {mapsError === "load_failed" && (
          <div style={{ padding: "8px 16px", background: T.dangerLight, borderRadius: T.radiusSm, fontSize: 12, color: T.danger }}>
            ⚠️ Google Maps failed to load. Check API key restrictions for this Vercel domain.
          </div>
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
          <div style={{ marginBottom: 20 }}>
            {routeData.teamA?.jobs?.length > 0 && (
              <div style={{ padding: "16px 20px", background: `${T.primary}15`, borderRadius: T.radius, borderLeft: `4px solid ${T.primary}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>Route Summary</div>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <span style={{ color: T.textMuted }}>🚗 <strong style={{ color: T.text }}>{routeData.teamA.totalDistance.toFixed(1)} km</strong></span>
                  <span style={{ color: T.textMuted }}>⏱️ <strong style={{ color: T.text }}>{routeData.teamA.totalDuration} mins</strong></span>
                  <span style={{ color: T.textMuted }}>📍 <strong style={{ color: T.text }}>{routeData.teamA.jobs?.length || 0} stops</strong></span>
                </div>
                {routeData.teamA.legs?.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12 }}>
                    {routeData.teamA.legs.map((leg, i) => (
                      <div key={i} style={{ padding: "6px 0", borderBottom: i < routeData.teamA.legs.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ color: T.text }}>{leg.from.clientName}</span>
                        <span style={{ color: T.textLight }}> → </span>
                        <span style={{ color: T.text }}>{leg.to.clientName}</span>
                        <span style={{ color: T.textMuted, marginLeft: 8 }}>{leg.distanceText} · {leg.durationText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              ) : mapsError === "load_failed" ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                  <p style={{ margin: 0, fontWeight: 700, color: T.danger }}>Google Maps API Load Failed</p>
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                    Check billing, API enablement, and allowed HTTP referrers for this domain.
                  </p>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 4, borderRadius: 2, background: T.primary }} />
              <span style={{ fontSize: 12, color: T.textMuted }}>Route</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Route Optimiser ───────────────────────────────── */}
      <RouteOptimiser
        scheduleClients={scheduleClients}
        scheduledJobs={scheduledJobs}
        scheduleSettings={scheduleSettings}
        isMobile={isMobile}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════
// ROUTE OPTIMISER SECTION
// ══════════════════════════════════════════════════════════
function RouteOptimiser({ scheduleClients, scheduledJobs, scheduleSettings, isMobile }) {
  const TODAY = new Date().toISOString().split("T")[0];
  const [optimDate,   setOptimDate]   = useState(TODAY);
  const [optimised,   setOptimised]   = useState(null); // null | optimisedJobs[]
  const [applying,    setApplying]    = useState(false);
  const [applied,     setApplied]     = useState(false);

  const { updateJob } = useScheduledJobs();

  const dayJobs = useMemo(() => scheduledJobs.filter(j => {
    return j.date === optimDate && !j.is_break && !j.isBreak;
  }), [scheduledJobs, optimDate]);

  const teamColor = T.primary;

  const handleOptimise = () => {
    setApplied(false);
    const result = optimiseRoute(dayJobs, scheduleClients);
    setOptimised(result);
  };

  const handleApply = async () => {
    if (!optimised) return;
    setApplying(true);
    try {
      for (let i = 0; i < optimised.length; i++) {
        await updateJob(optimised[i].id, { sort_order: i });
      }
      setApplied(true);
    } catch (e) {
      console.error("Apply route failed", e);
    }
    setApplying(false);
  };

  const summary = optimised ? routeSummary(optimised) : null;

  return (
    <div style={{ marginTop: 24, background: "#fff", borderRadius: T.radius, padding: 24, boxShadow: T.shadow }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔀</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Route Optimiser</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>Nearest-neighbour algorithm — reorder jobs for shortest travel</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <div>
          <label style={labelSt}>DATE</label>
          <input type="date" value={optimDate} onChange={e => { setOptimDate(e.target.value); setOptimised(null); setApplied(false); }}
            style={{ padding: "10px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.text }} />
        </div>
        <button
          onClick={handleOptimise}
          disabled={dayJobs.length < 2}
          style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: dayJobs.length < 2 ? T.border : teamColor, color: dayJobs.length < 2 ? T.textLight : "#fff", fontSize: 14, fontWeight: 700, cursor: dayJobs.length < 2 ? "not-allowed" : "pointer" }}
        >
          🔀 Optimise
        </button>
        {optimised && !applied && (
          <button
            onClick={handleApply}
            disabled={applying}
            style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: applying ? "not-allowed" : "pointer", opacity: applying ? 0.7 : 1 }}
          >
            {applying ? "Applying…" : "✅ Apply to Calendar"}
          </button>
        )}
        {applied && (
          <div style={{ padding: "10px 16px", borderRadius: T.radiusSm, background: T.primaryLight, color: T.primaryDark, fontSize: 13, fontWeight: 700 }}>
            ✅ Sort order applied!
          </div>
        )}
      </div>

      {dayJobs.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: T.textLight, fontSize: 14 }}>
          No jobs on {optimDate}
        </div>
      )}

      {dayJobs.length === 1 && (
        <div style={{ textAlign: "center", padding: 24, color: T.textMuted, fontSize: 14 }}>
          Only 1 job — nothing to optimise
        </div>
      )}

      {/* Results */}
      {optimised && summary && (
        <div>
          {/* Summary */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ padding: "12px 16px", background: `${teamColor}10`, borderRadius: T.radiusSm, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: teamColor }}>{summary.totalKm} km</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>total travel</div>
            </div>
            <div style={{ padding: "12px 16px", background: T.bg, borderRadius: T.radiusSm, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>~{summary.totalTravelMins} min</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>drive time (est.)</div>
            </div>
            <div style={{ padding: "12px 16px", background: T.bg, borderRadius: T.radiusSm, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{optimised.length}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>stops</div>
            </div>
          </div>

          {/* Ordered job list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {optimised.map((job, i) => (
              <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.bg, borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: teamColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.client_name || job.clientName}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{job.suburb} · {job.start_time || job.startTime} · {job.duration}min</div>
                </div>
                {job._travelKm !== undefined && (
                  <div style={{ fontSize: 12, color: T.textMuted, textAlign: "right", flexShrink: 0 }}>
                    🚗 {job._travelKm}km<br />~{job._travelMins}min
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: T.textLight }}>
            ℹ️ Travel estimates based on suburb coordinates (straight-line ÷ 30 km/h). Use Google Maps for accurate times.
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt = {
  fontSize: 11, fontWeight: 700, color: T.textMuted,
  display: "block", marginBottom: 4, textTransform: "uppercase",
};
