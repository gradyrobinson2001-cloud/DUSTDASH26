import React from "react";
import { T, getAllPhotos } from "../shared";

export default function PhotosTab({
  photos,
  setPhotos,
  photoViewDate,
  setPhotoViewDate,
  selectedPhoto,
  setSelectedPhoto,
  scheduledJobs,
  scheduleSettings,
  showToast,
  isMobile,
}) {
  const datePhotos = photos.filter(p => p.date === photoViewDate);
  const jobsWithPhotos = [...new Set(datePhotos.map(p => p.jobId))];

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Job Photos</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Before & after photos from your cleaning teams</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="date"
            value={photoViewDate}
            onChange={e => setPhotoViewDate(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
          />
          <button
            onClick={() => getAllPhotos().then(setPhotos)}
            style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Cleaner Portal Link */}
      <div style={{ background: T.blueLight, borderRadius: T.radius, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📱</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: T.blue }}>Cleaner Portal</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Share this link with your cleaners to upload photos</div>
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

      {/* Photos Grid */}
      {datePhotos.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: T.radius, padding: 60, textAlign: "center", color: T.textLight }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>No photos for this date</p>
          <p style={{ margin: 0, fontSize: 13 }}>Photos uploaded by cleaners will appear here</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {jobsWithPhotos.map(jobId => {
            const job = scheduledJobs.find(j => j.id === jobId);
            const jobPhotos = datePhotos.filter(p => p.jobId === jobId);
            const beforePhoto = jobPhotos.find(p => p.type === "before");
            const afterPhoto = jobPhotos.find(p => p.type === "after");
            return (
              <div key={jobId} style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.primary }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{job?.clientName || "Unknown Job"}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>{job?.suburb}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.textLight }}>{job?.startTime} - {job?.endTime}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[{ label: "Before", photo: beforePhoto }, { label: "After", photo: afterPhoto }].map(({ label, photo }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>{label}</div>
                      {photo ? (
                        <div onClick={() => setSelectedPhoto(photo)} style={{ cursor: "pointer", borderRadius: T.radiusSm, overflow: "hidden", aspectRatio: "4/3", background: T.bg }}>
                          <img src={photo.data} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ aspectRatio: "4/3", background: T.bg, borderRadius: T.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight }}>
                          No photo
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>
                  Uploaded: {jobPhotos[0] && new Date(jobPhotos[0].uploadedAt).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <img src={selectedPhoto.data} alt={selectedPhoto.type} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: T.radius }} />
          <button onClick={() => setSelectedPhoto(null)} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}
