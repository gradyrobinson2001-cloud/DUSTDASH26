import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { T } from "../shared";

const getPhotoJobId = (photo) => String(photo?.job_id ?? photo?.jobId ?? "");
const getPhotoDate = (photo) => String(photo?.date ?? "");
const getPhotoUploadedAt = (photo) => String(photo?.uploaded_at ?? photo?.uploadedAt ?? "");
const getPhotoType = (photo) => (photo?.type === "after" ? "after" : "before");
const getPhotoStoragePath = (photo) => String(photo?.storage_path ?? photo?.storagePath ?? "");

const safeSegment = (value) =>
  String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "unknown";

const getPhotoClientKey = (photo, job) => {
  const fromJob = job?.client_id ?? job?.clientId;
  const fromPhoto = photo?.client_id ?? photo?.clientId;
  return String(fromJob ?? fromPhoto ?? `job-${getPhotoJobId(photo)}`);
};

const getPhotoClientLabel = (photo, job) => {
  return (
    job?.client_name ||
    job?.clientName ||
    photo?.client_name ||
    photo?.clientName ||
    "Unknown client"
  );
};

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
  const [selectedClient, setSelectedClient] = useState("all");
  const [zipLoading, setZipLoading] = useState(false);

  const jobsById = useMemo(() => {
    const out = {};
    (scheduledJobs || []).forEach((job) => {
      out[String(job.id)] = job;
    });
    return out;
  }, [scheduledJobs]);

  const datePhotos = useMemo(
    () => (photos || []).filter(p => getPhotoDate(p) === photoViewDate),
    [photos, photoViewDate]
  );

  const clientOptions = useMemo(() => {
    const map = new Map();
    datePhotos.forEach((photo) => {
      const job = jobsById[getPhotoJobId(photo)];
      const value = getPhotoClientKey(photo, job);
      if (!map.has(value)) {
        map.set(value, getPhotoClientLabel(photo, job));
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [datePhotos, jobsById]);

  useEffect(() => {
    if (selectedClient !== "all" && !clientOptions.some(c => c.value === selectedClient)) {
      setSelectedClient("all");
    }
  }, [selectedClient, clientOptions]);

  const filteredDatePhotos = useMemo(
    () =>
      datePhotos.filter((photo) => {
        if (selectedClient === "all") return true;
        const job = jobsById[getPhotoJobId(photo)];
        return getPhotoClientKey(photo, job) === selectedClient;
      }),
    [datePhotos, jobsById, selectedClient]
  );

  useEffect(() => {
    let cancelled = false;
    const loadUrls = async () => {
      if (!getSignedUrl || filteredDatePhotos.length === 0) return;
      const missing = filteredDatePhotos.filter(p => {
        const id = String(p.id || "");
        return id && getPhotoStoragePath(p) && !urlMap[id];
      });
      if (missing.length === 0) return;

      const next = {};
      await Promise.all(
        missing.map(async (p) => {
          const signed = await getSignedUrl(getPhotoStoragePath(p));
          if (signed) next[String(p.id)] = signed;
        })
      );
      if (!cancelled && Object.keys(next).length > 0) {
        setUrlMap(prev => ({ ...prev, ...next }));
      }
    };
    loadUrls();
    return () => { cancelled = true; };
  }, [filteredDatePhotos, getSignedUrl, urlMap]);

  const jobsWithPhotos = useMemo(
    () => [...new Set(filteredDatePhotos.map(getPhotoJobId).filter(Boolean))],
    [filteredDatePhotos]
  );

  const resolvePhotoUrl = (photo) => {
    const id = String(photo?.id || "");
    return photo?.url || (id ? urlMap[id] : null) || null;
  };

  const refreshPhotoUrl = async (photo) => {
    if (!getSignedUrl) return;
    const id = String(photo?.id || "");
    const storagePath = getPhotoStoragePath(photo);
    if (!id || !storagePath) return;
    try {
      const fresh = await getSignedUrl(storagePath);
      if (fresh) {
        setUrlMap((prev) => ({ ...prev, [id]: fresh }));
      }
    } catch (err) {
      console.error("[photos] signed URL refresh failed", { photoId: id, err });
    }
  };

  const handleDownloadZip = async () => {
    if (filteredDatePhotos.length === 0) {
      showToast("⚠️ No photos to download for this filter");
      return;
    }
    if (!getSignedUrl) {
      showToast("❌ Signed URL helper unavailable");
      return;
    }

    setZipLoading(true);
    try {
      const zip = new JSZip();
      const root = zip.folder(`job-photos-${photoViewDate}`) || zip;
      let added = 0;

      for (const photo of filteredDatePhotos) {
        const jobId = getPhotoJobId(photo);
        const job = jobsById[jobId];
        const clientName = getPhotoClientLabel(photo, job);
        const jobFolder = root.folder(`${safeSegment(clientName)}-${safeSegment(jobId)}`) || root;
        const type = getPhotoType(photo);
        const uploadedAt = getPhotoUploadedAt(photo) || new Date().toISOString();
        const stamp = uploadedAt.replace(/[^\dT]/g, "-");
        const path = getPhotoStoragePath(photo);
        const ext = (() => {
          const maybe = path.split(".").pop();
          return maybe && maybe.length <= 5 ? maybe : "jpg";
        })();

        let url = resolvePhotoUrl(photo);
        if (!url && path) {
          url = await getSignedUrl(path);
        }
        if (!url) continue;

        const response = await fetch(url);
        if (!response.ok) continue;
        const blob = await response.blob();

        jobFolder.file(`${type}-${stamp}.${ext}`, blob);
        added += 1;
      }

      if (added === 0) {
        throw new Error("No photos could be downloaded.");
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      const href = URL.createObjectURL(zipBlob);
      link.href = href;
      link.download = `job-photos-${photoViewDate}${selectedClient === "all" ? "" : "-client"}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      showToast(`📦 Downloaded ${added} photo${added === 1 ? "" : "s"} as ZIP`);
    } catch (err) {
      console.error("[photos:download-zip] failed", err);
      showToast(`❌ ZIP download failed: ${err.message}`);
    } finally {
      setZipLoading(false);
    }
  };

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
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, background: "#fff", minWidth: 160 }}
          >
            <option value="all">All clients</option>
            {clientOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
          <button
            onClick={handleDownloadZip}
            disabled={zipLoading}
            style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: "none", background: T.primary, fontSize: 12, fontWeight: 700, color: "#fff", cursor: zipLoading ? "default" : "pointer", opacity: zipLoading ? 0.7 : 1 }}
          >
            {zipLoading ? "Preparing ZIP..." : "Download ZIP"}
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

      {filteredDatePhotos.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: T.radius, padding: 60, textAlign: "center", color: T.textLight }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>No photos for this filter</p>
          <p style={{ margin: 0, fontSize: 13 }}>Staff uploads will appear here automatically</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {jobsWithPhotos.map(jobId => {
            const job = (scheduledJobs || []).find(j => String(j.id) === String(jobId));
            const jobPhotos = filteredDatePhotos
              .filter(p => getPhotoJobId(p) === jobId)
              .sort((a, b) => getPhotoUploadedAt(a).localeCompare(getPhotoUploadedAt(b)));

            const beforePhotos = jobPhotos.filter(p => p.type === "before");
            const afterPhotos = jobPhotos.filter(p => p.type === "after");
            const latestPhoto = jobPhotos[jobPhotos.length - 1];

            const renderPhotoTile = (photo, fallbackLabel) => {
              const src = resolvePhotoUrl(photo);
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
                  <img
                    src={src}
                    alt={photo.type}
                    onError={() => refreshPhotoUrl(photo)}
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#111" }}
                  />
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
                    {renderPhotoTile(beforePhotos[beforePhotos.length - 1], "No before photo")}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>After ({afterPhotos.length})</div>
                    {renderPhotoTile(afterPhotos[afterPhotos.length - 1], "No after photo")}
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>
                  Last upload: {latestPhoto ? new Date(getPhotoUploadedAt(latestPhoto)).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "--"}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
                    Timeline ({jobPhotos.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                    {jobPhotos.map((photo) => {
                      const src = resolvePhotoUrl(photo);
                      const uploadedAt = getPhotoUploadedAt(photo);
                      const type = getPhotoType(photo);
                      return (
                        <button
                          key={photo.id}
                          onClick={() => src && setSelectedPhoto({ ...photo, displayUrl: src })}
                          style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: T.radiusSm, padding: 0, cursor: src ? "pointer" : "default", overflow: "hidden", textAlign: "left" }}
                        >
                          <div style={{ aspectRatio: "4/3", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {src ? (
                              <img
                                src={src}
                                alt={type}
                                onError={() => refreshPhotoUrl(photo)}
                                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#111" }}
                              />
                            ) : (
                              <span style={{ fontSize: 11, color: T.textLight }}>Loading...</span>
                            )}
                          </div>
                          <div style={{ padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: type === "before" ? T.blue : T.primaryDark, textTransform: "uppercase" }}>
                              {type}
                            </span>
                            <span style={{ fontSize: 10, color: T.textLight }}>
                              {uploadedAt ? new Date(uploadedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "--"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPhoto && (
        <div onClick={() => setSelectedPhoto(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <img
            src={selectedPhoto.displayUrl || selectedPhoto.url || urlMap[String(selectedPhoto.id)]}
            alt={selectedPhoto.type}
            onError={() => refreshPhotoUrl(selectedPhoto)}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: T.radius, objectFit: "contain", background: "#111" }}
          />
          <button onClick={() => setSelectedPhoto(null)} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}
