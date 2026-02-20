import React, { useEffect, useMemo, useState } from "react";
import { T } from "../shared";

const getPhotoJobId = (photo) => String(photo?.job_id ?? photo?.jobId ?? "");
const getPhotoDate = (photo) => String(photo?.date ?? "");
const getPhotoUploadedAt = (photo) => String(photo?.uploaded_at ?? photo?.uploadedAt ?? "");

export default function PhotosTab({
  photos,
  photoViewDate,
  setPhotoViewDate,
  selectedPhoto,
  setSelectedPhoto,
  scheduledJobs,
  showToast,
  isMobile,
  refreshPhotos,
  getSignedUrl,
}) {
  const [urlMap, setUrlMap] = useState({});

  const datePhotos = useMemo(
    () => (photos || []).filter(p => getPhotoDate(p) === photoViewDate),
    [photos, photoViewDate]
  );

  useEffect(() => {
    let cancelled = false;
    const loadUrls = async () => {
      if (!getSignedUrl || datePhotos.length === 0) return;
      const missing = datePhotos.filter(p => {
        const id = String(p.id || "");
        return id && p.storage_path && !urlMap[id];
      });
      if (missing.length === 0) return;

      const next = {};
      await Promise.all(
        missing.map(async (p) => {
          const signed = await getSignedUrl(p.storage_path);
          if (signed) next[String(p.id)] = signed;
        })
      );
      if (!cancelled && Object.keys(next).length > 0) {
        setUrlMap(prev => ({ ...prev, ...next }));
      }
    };
    loadUrls();
    return () => { cancelled = true; };
  }, [datePhotos, getSignedUrl, urlMap]);

  const jobsWithPhotos = useMemo(
    () => [...new Set(datePhotos.map(getPhotoJobId).filter(Boolean))],
    [datePhotos]
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Job Photos</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Before & after photos synced from staff uploads</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="date"
            value={photoViewDate}
            onChange={e => setPhotoViewDate(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
          />
          <button
            onClick={async () => {
              if (!refreshPhotos) return;
              try {
                await refreshPhotos();
                showToast("✅ Photos refreshed");
              } catch (e) {
                showToast("❌ Failed to refresh photos");
              }
            }}
            style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ background: T.blueLight, borderRadius: T.radius, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📱</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: T.blue }}>Cleaner Portal</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Before/after photos are linked to job, client and date</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ padding: "8px 12px", background: "#fff", borderRadius: 6, fontSize: 12, color: T.text }}>
            {typeof window !== "undefined" ? window.location.origin : ""}/cleaner
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/cleaner`);
              showToast("📋 Link copied!");
            }}
            style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: "none", background: T.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Copy
          </button>
        </div>
      </div>

      {datePhotos.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: T.radius, padding: 60, textAlign: "center", color: T.textLight }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>No photos for this date</p>
          <p style={{ margin: 0, fontSize: 13 }}>Staff uploads will appear here automatically</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {jobsWithPhotos.map(jobId => {
            const job = (scheduledJobs || []).find(j => String(j.id) === String(jobId));
            const jobPhotos = datePhotos
              .filter(p => getPhotoJobId(p) === jobId)
              .sort((a, b) => getPhotoUploadedAt(b).localeCompare(getPhotoUploadedAt(a)));

            const beforePhotos = jobPhotos.filter(p => p.type === "before");
            const afterPhotos = jobPhotos.filter(p => p.type === "after");

            const renderPhotoTile = (photo, fallbackLabel) => {
              const id = String(photo?.id || "");
              const src = photo?.url || urlMap[id] || null;
              if (!photo || !src) {
                return (
                  <div style={{ aspectRatio: "4/3", background: T.bg, borderRadius: T.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight }}>
                    {fallbackLabel}
                  </div>
                );
              }
              return (
                <div
                  onClick={() => setSelectedPhoto({ ...photo, displayUrl: src })}
                  style={{ cursor: "pointer", borderRadius: T.radiusSm, overflow: "hidden", aspectRatio: "4/3", background: T.bg }}
                >
                  <img src={src} alt={photo.type} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              );
            };

            return (
              <div key={jobId} style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.primary }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{job?.client_name || job?.clientName || "Unknown Job"}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>
                        {job?.suburb || "Unknown suburb"} · {job?.date || photoViewDate}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.textLight }}>
                    {job?.start_time || job?.startTime || "--:--"} - {job?.end_time || job?.endTime || "--:--"}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Before ({beforePhotos.length})</div>
                    {renderPhotoTile(beforePhotos[0], "No before photo")}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>After ({afterPhotos.length})</div>
                    {renderPhotoTile(afterPhotos[0], "No after photo")}
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>
                  Uploaded: {jobPhotos[0] ? new Date(getPhotoUploadedAt(jobPhotos[0])).toLocaleTimeString() : "--"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <img src={selectedPhoto.displayUrl || selectedPhoto.url || urlMap[String(selectedPhoto.id)]} alt={selectedPhoto.type} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: T.radius }} />
          <button onClick={() => setSelectedPhoto(null)} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}
