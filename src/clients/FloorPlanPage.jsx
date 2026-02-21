import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Rnd } from "react-rnd";
import { supabase, supabaseReady } from "../lib/supabase";
import { T } from "../shared";

const GRID = 20;
const MIN_ROOM_WIDTH = 120;
const MIN_ROOM_HEIGHT = 100;
const CANVAS_HEIGHT = 700;
const LOCAL_KEY_PREFIX = "floorplan_client_";
const MAX_IMAGE_MB = 15;
const FLOORPLAN_SAFE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const DEFAULT_COLOR_LEGEND = [
  { id: "light", label: "Light", color: "#BFE3C8" },
  { id: "standard", label: "Standard", color: "#BFD7EF" },
  { id: "heavy", label: "Heavy", color: "#F0D1AE" },
  { id: "deep_clean", label: "Deep Clean", color: "#EAB6B6" },
];
const DEFAULT_HOUSE_SECTIONS = [
  { id: "main", label: "Main" },
  { id: "upstairs", label: "Upstairs" },
  { id: "downstairs", label: "Downstairs" },
  { id: "outbuilding", label: "Outbuilding" },
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const snap = (n) => Math.round((Number(n) || 0) / GRID) * GRID;

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const floorPlanStorageKey = (clientId) => `${LOCAL_KEY_PREFIX}${clientId}`;

function isMissingColumnError(error, columnName = "") {
  if (!error) return false;
  const code = String(error?.code || "");
  if (code !== "42703") return false;
  if (!columnName) return true;
  const haystack = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return haystack.includes(String(columnName).toLowerCase());
}

function slugifyLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "color";
}

function normalizeHexColor(value, fallback = "#BFD7EF") {
  const v = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function hexToRgb(hex) {
  const safe = normalizeHexColor(hex);
  const int = parseInt(safe.slice(1), 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function textColorForBackground(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 165 ? "#24414B" : "#FFFFFF";
}

function darkenColor(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const next = (v) => clamp(Math.round(v * (1 - amount)), 0, 255);
  return `#${next(r).toString(16).padStart(2, "0")}${next(g).toString(16).padStart(2, "0")}${next(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function normalizeLegend(list) {
  const seen = new Set();
  const src = Array.isArray(list) && list.length > 0 ? list : DEFAULT_COLOR_LEGEND;

  const out = src.map((item, idx) => {
    const rawId = String(item?.id || slugifyLabel(item?.label || `Color ${idx + 1}`));
    let id = rawId;
    let tries = 1;
    while (seen.has(id)) {
      tries += 1;
      id = `${rawId}_${tries}`;
    }
    seen.add(id);

    return {
      id,
      label: String(item?.label || `Color ${idx + 1}`).trim() || `Color ${idx + 1}`,
      color: normalizeHexColor(item?.color, DEFAULT_COLOR_LEGEND[idx % DEFAULT_COLOR_LEGEND.length]?.color || "#BFD7EF"),
    };
  });

  return out.length > 0 ? out : DEFAULT_COLOR_LEGEND;
}

function newLegendItem(index) {
  const id = `${slugifyLabel(`Color ${index + 1}`)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    label: `Color ${index + 1}`,
    color: normalizeHexColor(DEFAULT_COLOR_LEGEND[index % DEFAULT_COLOR_LEGEND.length]?.color || "#BFD7EF"),
  };
}

function normalizeSections(list) {
  const seen = new Set();
  const src = Array.isArray(list) && list.length > 0 ? list : DEFAULT_HOUSE_SECTIONS;
  const out = src.map((item, idx) => {
    const rawId = String(item?.id || slugifyLabel(item?.label || `Section ${idx + 1}`));
    let id = rawId;
    let tries = 1;
    while (seen.has(id)) {
      tries += 1;
      id = `${rawId}_${tries}`;
    }
    seen.add(id);
    return {
      id,
      label: String(item?.label || `Section ${idx + 1}`).trim() || `Section ${idx + 1}`,
    };
  });
  return out.length > 0 ? out : DEFAULT_HOUSE_SECTIONS;
}

function newSectionItem(index) {
  const raw = slugifyLabel(`Section ${index + 1}`);
  return {
    id: `${raw}_${Math.random().toString(36).slice(2, 6)}`,
    label: `Section ${index + 1}`,
  };
}

function normalizeRoom(room, legend, sections) {
  const normalizedLegend = normalizeLegend(legend);
  const normalizedSections = normalizeSections(sections);
  const fallbackColorKey = normalizedLegend[0]?.id || "standard";
  const fallbackSectionKey = normalizedSections[0]?.id || "main";
  const allowedKeys = new Set(normalizedLegend.map((item) => item.id));
  const allowedSections = new Set(normalizedSections.map((item) => item.id));

  const pins = Array.isArray(room?.pins)
    ? room.pins.map((pin) => ({
        id: String(pin?.id || newId()),
        x: clamp(Number(pin?.x || 0), 0, 1),
        y: clamp(Number(pin?.y || 0), 0, 1),
        note: String(pin?.note || "").trim(),
      }))
    : [];

  const key = String(room?.difficulty_level || room?.color_key || "");
  const sectionKey = String(room?.section_key || room?.sectionKey || "");

  return {
    id: String(room?.id || newId()),
    name: String(room?.name || "Room").trim() || "Room",
    x: snap(room?.x || 0),
    y: snap(room?.y || 0),
    width: Math.max(MIN_ROOM_WIDTH, snap(room?.width || 220)),
    height: Math.max(MIN_ROOM_HEIGHT, snap(room?.height || 160)),
    difficulty_level: allowedKeys.has(key) ? key : fallbackColorKey,
    section_key: allowedSections.has(sectionKey) ? sectionKey : fallbackSectionKey,
    notes: String(room?.notes || ""),
    pins,
  };
}

function normalizeRooms(list, legend, sections) {
  return (Array.isArray(list) ? list : []).map((room) => normalizeRoom(room, legend, sections));
}

function buildRoomFromBounds(bounds, idx, colorKey, sectionKey) {
  return {
    id: newId(),
    name: `Room ${idx + 1}`,
    x: snap(bounds.x),
    y: snap(bounds.y),
    width: Math.max(MIN_ROOM_WIDTH, snap(bounds.width)),
    height: Math.max(MIN_ROOM_HEIGHT, snap(bounds.height)),
    difficulty_level: colorKey,
    section_key: sectionKey,
    notes: "Imported from floor plan image",
    pins: [],
  };
}

function createRoomTemplate(index = 0, colorKey = "standard", sectionKey = "main") {
  const offset = (index % 6) * GRID;
  return {
    id: newId(),
    name: `Room ${index + 1}`,
    x: 40 + offset,
    y: 40 + offset,
    width: 220,
    height: 160,
    difficulty_level: colorKey,
    section_key: sectionKey,
    notes: "",
    pins: [],
  };
}

function iou(a, b) {
  const xA = Math.max(a.x, b.x);
  const yA = Math.max(a.y, b.y);
  const xB = Math.min(a.x + a.width, b.x + b.width);
  const yB = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const inter = interW * interH;
  if (inter <= 0) return 0;

  const union = (a.width * a.height) + (b.width * b.height) - inter;
  return union > 0 ? inter / union : 0;
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load floor plan image."));
    img.src = url;
  });
}

async function detectRoomsFromImage({ imageUrl, targetWidth, targetHeight, startIndex, defaultColorKey, sectionKey }) {
  const img = await loadImage(imageUrl);

  const maxW = 900;
  const scale = Math.min(1, maxW / img.width);
  const w = Math.max(140, Math.round(img.width * scale));
  const h = Math.max(140, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas image processing is unavailable.");

  ctx.drawImage(img, 0, 0, w, h);
  const raw = ctx.getImageData(0, 0, w, h).data;

  const size = w * h;
  const white = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const p = i * 4;
    const lum = (0.2126 * raw[p]) + (0.7152 * raw[p + 1]) + (0.0722 * raw[p + 2]);
    white[i] = lum > 232 ? 1 : 0;
  }

  const outside = new Uint8Array(size);
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);

  const pushFlood = (idx, marker) => {
    let head = 0;
    let tail = 0;
    if (marker[idx] === 1 || white[idx] === 0) return;
    marker[idx] = 1;
    queue[tail++] = idx;

    while (head < tail) {
      const current = queue[head++];
      const x = current % w;
      const y = (current / w) | 0;

      if (x > 0) {
        const n = current - 1;
        if (white[n] === 1 && marker[n] === 0) {
          marker[n] = 1;
          queue[tail++] = n;
        }
      }
      if (x < w - 1) {
        const n = current + 1;
        if (white[n] === 1 && marker[n] === 0) {
          marker[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = current - w;
        if (white[n] === 1 && marker[n] === 0) {
          marker[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y < h - 1) {
        const n = current + w;
        if (white[n] === 1 && marker[n] === 0) {
          marker[n] = 1;
          queue[tail++] = n;
        }
      }
    }
  };

  for (let x = 0; x < w; x += 1) {
    pushFlood(x, outside);
    pushFlood((h - 1) * w + x, outside);
  }
  for (let y = 0; y < h; y += 1) {
    pushFlood(y * w, outside);
    pushFlood(y * w + (w - 1), outside);
  }

  const components = [];
  for (let i = 0; i < size; i += 1) {
    if (white[i] === 0 || outside[i] === 1 || visited[i] === 1) continue;

    let head = 0;
    let tail = 0;
    visited[i] = 1;
    queue[tail++] = i;

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % w;
      const y = (current / w) | 0;
      count += 1;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const n = current - 1;
        if (white[n] === 1 && outside[n] === 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (x < w - 1) {
        const n = current + 1;
        if (white[n] === 1 && outside[n] === 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = current - w;
        if (white[n] === 1 && outside[n] === 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y < h - 1) {
        const n = current + w;
        if (white[n] === 1 && outside[n] === 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    const boxW = (maxX - minX) + 1;
    const boxH = (maxY - minY) + 1;
    if (boxW < 16 || boxH < 16) continue;
    if (count < 180) continue;

    const boxArea = boxW * boxH;
    const fill = count / boxArea;
    if (fill < 0.45) continue;

    components.push({
      x: minX,
      y: minY,
      width: boxW,
      height: boxH,
      area: boxArea,
    });
  }

  const unique = [];
  components
    .sort((a, b) => b.area - a.area)
    .forEach((component) => {
      if (unique.some((kept) => iou(kept, component) > 0.82)) return;
      unique.push(component);
    });

  const scaleX = targetWidth / w;
  const scaleY = targetHeight / h;

  const detected = unique
    .slice(0, 40)
    .map((box, idx) => buildRoomFromBounds({
      x: clamp(box.x * scaleX, 0, targetWidth - MIN_ROOM_WIDTH),
      y: clamp(box.y * scaleY, 0, targetHeight - MIN_ROOM_HEIGHT),
      width: clamp(box.width * scaleX, MIN_ROOM_WIDTH, targetWidth),
      height: clamp(box.height * scaleY, MIN_ROOM_HEIGHT, targetHeight),
    }, startIndex + idx, defaultColorKey, sectionKey));

  return detected;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to decode uploaded image."));
    };
    img.src = objectUrl;
  });
}

async function toUploadableFloorplanFile(file) {
  const type = String(file?.type || "").toLowerCase();
  if (!type || FLOORPLAN_SAFE_TYPES.has(type)) return file;

  const image = await readImageFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable for image conversion.");
  ctx.drawImage(image, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) resolve(next);
      else reject(new Error("Failed to convert image."));
    }, "image/jpeg", 0.92);
  });

  const safeName = String(file?.name || "floorplan")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 50) || "floorplan";
  return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
}

export default function FloorPlanPage() {
  const navigate = useNavigate();
  const { id: clientId } = useParams();
  const canvasRef = useRef(null);
  const imageInputRef = useRef(null);

  const [client, setClient] = useState(null);
  const [floorPlanId, setFloorPlanId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [houseSections, setHouseSections] = useState(DEFAULT_HOUSE_SECTIONS);
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_HOUSE_SECTIONS[0].id);
  const [colorLegend, setColorLegend] = useState(DEFAULT_COLOR_LEGEND);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [pinModeRoomId, setPinModeRoomId] = useState(null);
  const [pinDraftNote, setPinDraftNote] = useState("");

  const [referenceImagePath, setReferenceImagePath] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [referenceImageOpacity, setReferenceImageOpacity] = useState(0.32);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [interpretingImage, setInterpretingImage] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  const selectedRoom = rooms.find((room) => String(room.id) === String(selectedRoomId)) || null;
  const roomsInActiveSection = useMemo(
    () => rooms.filter((room) => String(room.section_key || "") === String(activeSectionId)),
    [rooms, activeSectionId]
  );

  const defaultColorKey = colorLegend[0]?.id || "standard";
  const defaultSectionKey = houseSections[0]?.id || "main";
  const canSave = Boolean(clientId);

  const colorById = useMemo(() => {
    const map = {};
    colorLegend.forEach((item) => {
      map[String(item.id)] = item;
    });
    return map;
  }, [colorLegend]);

  const getColorMeta = useCallback((roomColorKey) => {
    return colorById[String(roomColorKey)] || colorLegend[0] || DEFAULT_COLOR_LEGEND[0];
  }, [colorById, colorLegend]);

  useEffect(() => {
    if (!houseSections.some((section) => String(section.id) === String(activeSectionId))) {
      setActiveSectionId(houseSections[0]?.id || "main");
    }
  }, [activeSectionId, houseSections]);

  useEffect(() => {
    const room = rooms.find((r) => String(r.id) === String(selectedRoomId));
    if (!room) return;
    if (String(room.section_key || "") !== String(activeSectionId)) {
      setSelectedRoomId(null);
    }
  }, [activeSectionId, rooms, selectedRoomId]);

  const upsertRoom = useCallback((roomId, updates) => {
    setRooms((prev) => prev.map((room) => (
      String(room.id) === String(roomId)
        ? normalizeRoom({ ...room, ...updates }, colorLegend, houseSections)
        : room
    )));
  }, [colorLegend, houseSections]);

  const removeRoom = useCallback((roomId) => {
    setRooms((prev) => prev.filter((room) => String(room.id) !== String(roomId)));
    setSelectedRoomId((prev) => (String(prev) === String(roomId) ? null : prev));
    setPinModeRoomId((prev) => (String(prev) === String(roomId) ? null : prev));
  }, []);

  const addRoom = useCallback(() => {
    setRooms((prev) => {
      const room = createRoomTemplate(prev.length, defaultColorKey, activeSectionId || defaultSectionKey);
      setSelectedRoomId(room.id);
      return [...prev, room];
    });
  }, [activeSectionId, defaultColorKey, defaultSectionKey]);

  const addPinToRoom = useCallback((roomId, pin) => {
    setRooms((prev) => prev.map((room) => {
      if (String(room.id) !== String(roomId)) return room;
      const pins = [...(room.pins || []), { id: newId(), ...pin }];
      return { ...room, pins };
    }));
  }, []);

  const updatePin = useCallback((roomId, pinId, updates) => {
    setRooms((prev) => prev.map((room) => {
      if (String(room.id) !== String(roomId)) return room;
      return {
        ...room,
        pins: (room.pins || []).map((pin) => (String(pin.id) === String(pinId) ? { ...pin, ...updates } : pin)),
      };
    }));
  }, []);

  const removePin = useCallback((roomId, pinId) => {
    setRooms((prev) => prev.map((room) => {
      if (String(room.id) !== String(roomId)) return room;
      return { ...room, pins: (room.pins || []).filter((pin) => String(pin.id) !== String(pinId)) };
    }));
  }, []);

  const refreshReferenceImageUrl = useCallback(async (path) => {
    if (!path) {
      setReferenceImageUrl("");
      return;
    }

    if (path.startsWith("data:")) {
      setReferenceImageUrl(path);
      return;
    }

    if (!supabaseReady || !supabase) {
      setReferenceImageUrl(path);
      return;
    }

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(sessionError.message || "Failed to load auth session.");
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please sign in again.");
      const res = await fetch("/api/floorplans/get-image-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storagePath: path, clientId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.signedUrl) {
        setReferenceImageUrl(body.signedUrl);
        return;
      }
    } catch (err) {
      console.error("[floor-plan] secure signed URL request failed", err);
    }

    const { data, error: signedErr } = await supabase.storage
      .from("floorplan-images")
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signedErr) throw new Error(signedErr.message || "Failed to load reference image URL.");
    setReferenceImageUrl(data?.signedUrl || "");
  }, [clientId]);

  const loadFloorPlan = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError("");
    setNotice("");

    if (!supabaseReady || !supabase) {
      const raw = localStorage.getItem(floorPlanStorageKey(clientId));
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const sections = normalizeSections(parsed?.houseSections || DEFAULT_HOUSE_SECTIONS);
          const legend = normalizeLegend(parsed?.colorLegend || DEFAULT_COLOR_LEGEND);
          const normalized = normalizeRooms(parsed?.rooms || [], legend, sections);
          setHouseSections(sections);
          setColorLegend(legend);
          setRooms(normalized);
          setSelectedRoomId(normalized[0]?.id || null);
          const savedActive = String(parsed?.activeSectionId || "");
          setActiveSectionId(sections.some((section) => String(section.id) === savedActive) ? savedActive : (sections[0]?.id || "main"));
          setSavedAt(parsed?.savedAt || null);
          setReferenceImagePath(parsed?.referenceImagePath || "");
          setReferenceImageUrl(parsed?.referenceImageUrl || "");
          setReferenceImageOpacity(clamp(Number(parsed?.referenceImageOpacity ?? 0.32), 0.05, 1));
        } catch {
          setRooms([]);
          setHouseSections(DEFAULT_HOUSE_SECTIONS);
          setColorLegend(DEFAULT_COLOR_LEGEND);
        }
      } else {
        setRooms([]);
        setHouseSections(DEFAULT_HOUSE_SECTIONS);
        setColorLegend(DEFAULT_COLOR_LEGEND);
      }
      setClient({ id: clientId, name: `Client ${clientId}` });
      setFloorPlanId(null);
      setLoading(false);
      return;
    }

    try {
      const { data: clientRow, error: clientErr } = await supabase
        .from("clients")
        .select("id, name, address, suburb")
        .eq("id", clientId)
        .single();
      if (clientErr) throw new Error(clientErr.message || "Failed to load client.");

      let floorPlanRow = null;
      let compatibilityMode = false;
      const advancedFloorPlan = await supabase
        .from("floor_plans")
        .select("id, client_id, color_legend, house_sections, reference_image_path, created_at, updated_at")
        .eq("client_id", clientId)
        .maybeSingle();

      if (advancedFloorPlan.error) {
        if (
          isMissingColumnError(advancedFloorPlan.error, "house_sections")
          || isMissingColumnError(advancedFloorPlan.error, "color_legend")
          || isMissingColumnError(advancedFloorPlan.error, "reference_image_path")
        ) {
          compatibilityMode = true;
          const legacyFloorPlan = await supabase
            .from("floor_plans")
            .select("id, client_id, created_at, updated_at")
            .eq("client_id", clientId)
            .maybeSingle();
          if (legacyFloorPlan.error) {
            throw new Error(legacyFloorPlan.error.message || "Failed to load floor plan.");
          }
          floorPlanRow = legacyFloorPlan.data || null;
        } else {
          throw new Error(advancedFloorPlan.error.message || "Failed to load floor plan.");
        }
      } else {
        floorPlanRow = advancedFloorPlan.data || null;
      }

      setClient(clientRow || null);
      setFloorPlanId(floorPlanRow?.id || null);
      setSavedAt(floorPlanRow?.updated_at || null);

      const sections = normalizeSections(compatibilityMode ? DEFAULT_HOUSE_SECTIONS : (floorPlanRow?.house_sections || DEFAULT_HOUSE_SECTIONS));
      const legend = normalizeLegend(compatibilityMode ? DEFAULT_COLOR_LEGEND : (floorPlanRow?.color_legend || DEFAULT_COLOR_LEGEND));
      setHouseSections(sections);
      setActiveSectionId((prev) => sections.some((s) => String(s.id) === String(prev)) ? prev : (sections[0]?.id || "main"));
      setColorLegend(legend);

      const imagePath = compatibilityMode ? "" : String(floorPlanRow?.reference_image_path || "");
      setReferenceImagePath(imagePath);
      if (imagePath) await refreshReferenceImageUrl(imagePath);
      else setReferenceImageUrl("");

      if (!floorPlanRow?.id) {
        const defaultSections = normalizeSections(DEFAULT_HOUSE_SECTIONS);
        setRooms([]);
        setSelectedRoomId(null);
        setHouseSections(defaultSections);
        setActiveSectionId(defaultSections[0]?.id || "main");
        setColorLegend(normalizeLegend(DEFAULT_COLOR_LEGEND));
        setLoading(false);
        return;
      }

      let roomRows = [];
      const advancedRooms = await supabase
        .from("rooms")
        .select("id, floor_plan_id, name, x, y, width, height, difficulty_level, section_key, notes")
        .eq("floor_plan_id", floorPlanRow.id)
        .order("created_at", { ascending: true });

      if (advancedRooms.error) {
        if (isMissingColumnError(advancedRooms.error, "section_key")) {
          compatibilityMode = true;
          const legacyRooms = await supabase
            .from("rooms")
            .select("id, floor_plan_id, name, x, y, width, height, difficulty_level, notes")
            .eq("floor_plan_id", floorPlanRow.id)
            .order("created_at", { ascending: true });
          if (legacyRooms.error) throw new Error(legacyRooms.error.message || "Failed to load rooms.");
          roomRows = (legacyRooms.data || []).map((room) => ({
            ...room,
            section_key: sections[0]?.id || "main",
          }));
        } else {
          throw new Error(advancedRooms.error.message || "Failed to load rooms.");
        }
      } else {
        roomRows = advancedRooms.data || [];
      }

      const roomIds = roomRows.map((room) => room.id);
      let pinsByRoom = {};
      if (roomIds.length > 0) {
        const { data: pinRows, error: pinErr } = await supabase
          .from("room_pins")
          .select("id, room_id, x, y, note")
          .in("room_id", roomIds);
        if (pinErr) throw new Error(pinErr.message || "Failed to load room pins.");

        pinsByRoom = (pinRows || []).reduce((acc, pin) => {
          const key = String(pin.room_id);
          if (!acc[key]) acc[key] = [];
          acc[key].push({
            id: String(pin.id),
            x: clamp(Number(pin.x || 0), 0, 1),
            y: clamp(Number(pin.y || 0), 0, 1),
            note: String(pin.note || ""),
          });
          return acc;
        }, {});
      }

      const mergedRooms = normalizeRooms(roomRows.map((room) => ({
        ...room,
        pins: pinsByRoom[String(room.id)] || [],
      })), legend, sections);

      setRooms(mergedRooms);
      setSelectedRoomId(mergedRooms[0]?.id || null);
      if (compatibilityMode) {
        setNotice("Floor plan compatibility mode active. Run latest Supabase migration to enable house sections/colors in DB.");
      }
    } catch (err) {
      console.error("[floor-plan] load failed", err);
      setError(err?.message || "Failed to load floor plan.");
    } finally {
      setLoading(false);
    }
  }, [clientId, refreshReferenceImageUrl]);

  useEffect(() => {
    loadFloorPlan();
  }, [loadFloorPlan]);

  const getAccessToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message || "Failed to load auth session.");
    const token = data?.session?.access_token;
    if (!token) throw new Error("Session expired. Please sign in again.");
    return token;
  }, []);

  const uploadReferenceImage = useCallback(async (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Image is too large. Keep it under ${MAX_IMAGE_MB}MB.`);
      return;
    }

    setUploadingImage(true);
    setError("");
    setNotice("");

    try {
      let preparedFile = file;
      if (!FLOORPLAN_SAFE_TYPES.has(String(file.type || "").toLowerCase())) {
        preparedFile = await toUploadableFloorplanFile(file);
      }

      if (!supabaseReady || !supabase) {
        const url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read image file."));
          reader.readAsDataURL(preparedFile);
        });
        setReferenceImagePath(url);
        setReferenceImageUrl(url);
        setNotice("Reference image loaded locally.");
        return;
      }

      const accessToken = await getAccessToken();
      const createRes = await fetch("/api/floorplans/create-image-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientId,
          fileName: preparedFile.name || file.name || "plan.png",
          contentType: preparedFile.type || file.type || "image/png",
        }),
      });

      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok || createBody?.error) {
        throw new Error(createBody?.error || createBody?.details || `Upload request failed (${createRes.status})`);
      }

      const uploadPath = createBody?.upload?.path;
      const uploadToken = createBody?.upload?.token;
      if (!uploadPath || !uploadToken) {
        throw new Error("Upload setup response missing token/path.");
      }

      const { error: uploadErr } = await supabase.storage
        .from("floorplan-images")
        .uploadToSignedUrl(uploadPath, uploadToken, preparedFile, {
          contentType: preparedFile.type || file.type || "image/png",
          upsert: false,
        });
      if (uploadErr) throw new Error(uploadErr.message || "Image upload failed.");

      setReferenceImagePath(uploadPath);
      await refreshReferenceImageUrl(uploadPath);
      setNotice('Reference image uploaded. Click "Interpret Image" to generate starter rooms.');
    } catch (err) {
      console.error("[floor-plan] upload image failed", err);
      setError(err?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }, [clientId, getAccessToken, refreshReferenceImageUrl]);

  const runInterpretation = useCallback(async () => {
    if (!referenceImageUrl) {
      setError("Upload a floor plan image first.");
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const targetWidth = Math.max(480, Math.round(canvasRect?.width || 980));

    setInterpretingImage(true);
    setError("");
    setNotice("");

    try {
      const detected = await detectRoomsFromImage({
        imageUrl: referenceImageUrl,
        targetWidth,
        targetHeight: CANVAS_HEIGHT,
        startIndex: rooms.length,
        defaultColorKey,
        sectionKey: activeSectionId || defaultSectionKey,
      });

      if (detected.length === 0) {
        setNotice("No enclosed rooms detected. Try a clearer image or add rooms manually.");
        return;
      }

      let nextRooms;
      if (rooms.length > 0) {
        const replace = window.confirm("Replace existing rooms with detected rooms?\nPress Cancel to append detected rooms.");
        nextRooms = replace ? detected : [...rooms, ...detected];
      } else {
        nextRooms = detected;
      }

      const normalized = normalizeRooms(nextRooms, colorLegend, houseSections);
      setRooms(normalized);
      setSelectedRoomId(normalized[0]?.id || null);
      setNotice(`Interpreted ${detected.length} room${detected.length === 1 ? "" : "s"}. You can drag/resize and edit them now.`);
    } catch (err) {
      console.error("[floor-plan] interpretation failed", err);
      setError(err?.message || "Failed to interpret image.");
    } finally {
      setInterpretingImage(false);
    }
  }, [activeSectionId, colorLegend, defaultColorKey, defaultSectionKey, houseSections, referenceImageUrl, rooms]);

  const saveFloorPlan = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setNotice("");

    const normalizedSections = normalizeSections(houseSections);
    const normalizedLegend = normalizeLegend(colorLegend);
    const normalizedRooms = normalizeRooms(rooms, normalizedLegend, normalizedSections);

    if (!supabaseReady || !supabase) {
      const now = new Date().toISOString();
      localStorage.setItem(
        floorPlanStorageKey(clientId),
        JSON.stringify({
          clientId,
          rooms: normalizedRooms,
          houseSections: normalizedSections,
          activeSectionId,
          colorLegend: normalizedLegend,
          referenceImagePath,
          referenceImageUrl,
          referenceImageOpacity,
          savedAt: now,
        })
      );
      setSavedAt(now);
      setNotice("Floor plan saved locally.");
      setSaving(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      let floorPlanCompatibilityMode = false;
      let roomCompatibilityMode = false;

      let floorPlanRow = null;
      const floorPlanAdvancedUpsert = await supabase
        .from("floor_plans")
        .upsert(
          {
            client_id: clientId,
            house_sections: normalizedSections,
            color_legend: normalizedLegend,
            reference_image_path: referenceImagePath || null,
            updated_at: now,
          },
          { onConflict: "client_id" }
        )
        .select("id, updated_at")
        .single();

      if (floorPlanAdvancedUpsert.error) {
        if (
          isMissingColumnError(floorPlanAdvancedUpsert.error, "house_sections")
          || isMissingColumnError(floorPlanAdvancedUpsert.error, "color_legend")
          || isMissingColumnError(floorPlanAdvancedUpsert.error, "reference_image_path")
        ) {
          floorPlanCompatibilityMode = true;
          const floorPlanLegacyUpsert = await supabase
            .from("floor_plans")
            .upsert(
              {
                client_id: clientId,
                updated_at: now,
              },
              { onConflict: "client_id" }
            )
            .select("id, updated_at")
            .single();
          if (floorPlanLegacyUpsert.error || !floorPlanLegacyUpsert.data?.id) {
            throw new Error(floorPlanLegacyUpsert.error?.message || "Failed to save floor plan record.");
          }
          floorPlanRow = floorPlanLegacyUpsert.data;
        } else {
          throw new Error(floorPlanAdvancedUpsert.error.message || "Failed to save floor plan record.");
        }
      } else {
        floorPlanRow = floorPlanAdvancedUpsert.data;
      }

      if (!floorPlanRow?.id) {
        throw new Error("Failed to save floor plan record.");
      }

      const currentFloorPlanId = floorPlanRow.id;
      setFloorPlanId(currentFloorPlanId);
      setHouseSections(normalizedSections);
      setColorLegend(normalizedLegend);

      const { data: existingRooms, error: existingRoomErr } = await supabase
        .from("rooms")
        .select("id")
        .eq("floor_plan_id", currentFloorPlanId);
      if (existingRoomErr) throw new Error(existingRoomErr.message || "Failed to load existing rooms.");

      const incomingRoomIds = normalizedRooms.map((room) => String(room.id));
      const existingRoomIds = (existingRooms || []).map((room) => String(room.id));
      const deletedRoomIds = existingRoomIds.filter((roomId) => !incomingRoomIds.includes(roomId));

      if (normalizedRooms.length > 0) {
        const roomPayload = normalizedRooms.map((room) => ({
          id: room.id,
          floor_plan_id: currentFloorPlanId,
          name: room.name,
          x: snap(room.x),
          y: snap(room.y),
          width: Math.max(MIN_ROOM_WIDTH, snap(room.width)),
          height: Math.max(MIN_ROOM_HEIGHT, snap(room.height)),
          difficulty_level: room.difficulty_level,
          section_key: room.section_key || normalizedSections[0]?.id || "main",
          notes: room.notes || "",
          updated_at: now,
        }));

        const roomUpsert = await supabase
          .from("rooms")
          .upsert(roomPayload, { onConflict: "id" });
        if (roomUpsert.error) {
          if (isMissingColumnError(roomUpsert.error, "section_key")) {
            roomCompatibilityMode = true;
            const roomPayloadLegacy = roomPayload.map(({ section_key, ...rest }) => rest);
            const roomUpsertLegacy = await supabase
              .from("rooms")
              .upsert(roomPayloadLegacy, { onConflict: "id" });
            if (roomUpsertLegacy.error) throw new Error(roomUpsertLegacy.error.message || "Failed to save rooms.");
          } else {
            throw new Error(roomUpsert.error.message || "Failed to save rooms.");
          }
        }
      }

      if (deletedRoomIds.length > 0) {
        const { error: roomDeleteErr } = await supabase
          .from("rooms")
          .delete()
          .in("id", deletedRoomIds);
        if (roomDeleteErr) throw new Error(roomDeleteErr.message || "Failed to remove deleted rooms.");
      }

      if (incomingRoomIds.length > 0) {
        const { data: existingPins, error: existingPinsErr } = await supabase
          .from("room_pins")
          .select("id, room_id")
          .in("room_id", incomingRoomIds);
        if (existingPinsErr) throw new Error(existingPinsErr.message || "Failed to load existing pins.");

        const incomingPins = normalizedRooms.flatMap((room) =>
          (room.pins || []).map((pin) => ({
            id: String(pin.id || newId()),
            room_id: room.id,
            x: clamp(Number(pin.x || 0), 0, 1),
            y: clamp(Number(pin.y || 0), 0, 1),
            note: String(pin.note || ""),
            updated_at: now,
          }))
        );

        const incomingPinIds = incomingPins.map((pin) => String(pin.id));
        const existingPinIds = (existingPins || []).map((pin) => String(pin.id));
        const deletedPinIds = existingPinIds.filter((pinId) => !incomingPinIds.includes(pinId));

        if (incomingPins.length > 0) {
          const { error: pinUpsertErr } = await supabase
            .from("room_pins")
            .upsert(incomingPins, { onConflict: "id" });
          if (pinUpsertErr) throw new Error(pinUpsertErr.message || "Failed to save pins.");
        }

        if (deletedPinIds.length > 0) {
          const { error: pinDeleteErr } = await supabase
            .from("room_pins")
            .delete()
            .in("id", deletedPinIds);
          if (pinDeleteErr) throw new Error(pinDeleteErr.message || "Failed to remove deleted pins.");
        }
      }

      setSavedAt(floorPlanRow.updated_at || now);
      setRooms(normalizedRooms);
      if (floorPlanCompatibilityMode || roomCompatibilityMode) {
        setNotice("Floor plan saved in compatibility mode. Run latest Supabase migration to unlock sections/colors persistence.");
      } else {
        setNotice("Floor plan saved.");
      }
    } catch (err) {
      console.error("[floor-plan] save failed", err);
      setError(err?.message || "Failed to save floor plan.");
    } finally {
      setSaving(false);
    }
  }, [activeSectionId, canSave, clientId, colorLegend, houseSections, referenceImageOpacity, referenceImagePath, referenceImageUrl, rooms]);

  const addLegendItem = useCallback(() => {
    setColorLegend((prev) => normalizeLegend([...prev, newLegendItem(prev.length)]));
  }, []);

  const updateLegendItem = useCallback((id, updates) => {
    setColorLegend((prev) => normalizeLegend(prev.map((item) => {
      if (String(item.id) !== String(id)) return item;
      return {
        ...item,
        ...updates,
      };
    })));
  }, []);

  const removeLegendItem = useCallback((id) => {
    setColorLegend((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((item) => String(item.id) !== String(id));
      const normalized = normalizeLegend(next);
      const fallback = normalized[0]?.id;
      setRooms((roomsPrev) => roomsPrev.map((room) => (
        String(room.difficulty_level) === String(id)
          ? { ...room, difficulty_level: fallback }
          : room
      )));
      return normalized;
    });
  }, []);

  const addSection = useCallback(() => {
    setHouseSections((prev) => {
      const normalized = normalizeSections([...prev, newSectionItem(prev.length)]);
      const created = normalized[normalized.length - 1];
      if (created?.id) setActiveSectionId(created.id);
      return normalized;
    });
  }, []);

  const updateSection = useCallback((id, updates) => {
    setHouseSections((prev) => normalizeSections(prev.map((item) => (
      String(item.id) === String(id)
        ? { ...item, ...updates }
        : item
    ))));
  }, []);

  const removeSection = useCallback((id) => {
    setHouseSections((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((item) => String(item.id) !== String(id));
      const normalized = normalizeSections(next);
      const fallbackId = normalized[0]?.id || "main";
      setRooms((roomsPrev) => roomsPrev.map((room) => (
        String(room.section_key) === String(id)
          ? { ...room, section_key: fallbackId }
          : room
      )));
      setActiveSectionId((current) => (String(current) === String(id) ? fallbackId : current));
      return normalized;
    });
  }, []);

  const roomCountLabel = `${rooms.length} room${rooms.length === 1 ? "" : "s"}`;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.textMuted, fontSize: 14, fontWeight: 700 }}>Loading floor plan...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 16 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Floor Plan Builder</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>{client?.name || "Client"}</div>
            <div style={{ fontSize: 12, color: T.textLight }}>
              {roomCountLabel} · {roomsInActiveSection.length} in {houseSections.find((s) => String(s.id) === String(activeSectionId))?.label || "section"}{floorPlanId ? " · existing plan" : " · new plan"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate(-1)}
              style={{ padding: "10px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
            >
              ← Back
            </button>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              style={{ padding: "10px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.blue}`, background: T.blueLight, color: T.blue, fontWeight: 700, cursor: uploadingImage ? "not-allowed" : "pointer", fontSize: 12, opacity: uploadingImage ? 0.7 : 1 }}
            >
              {uploadingImage ? "Uploading..." : "Upload Floor Plan Image"}
            </button>
            <button
              onClick={runInterpretation}
              disabled={interpretingImage || !referenceImageUrl}
              style={{ padding: "10px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.accent}`, background: T.accentLight, color: "#8B6914", fontWeight: 700, cursor: interpretingImage || !referenceImageUrl ? "not-allowed" : "pointer", fontSize: 12, opacity: interpretingImage || !referenceImageUrl ? 0.7 : 1 }}
            >
              {interpretingImage ? "Interpreting..." : "Interpret Image"}
            </button>
            <button
              onClick={addRoom}
              style={{ padding: "10px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.blue}`, background: T.blueLight, color: T.blue, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
            >
              + Add Room
            </button>
            <button
              onClick={saveFloorPlan}
              disabled={saving || !canSave}
              style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadReferenceImage(file);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />

        {savedAt && (
          <div style={{ marginBottom: 8, fontSize: 12, color: T.textLight }}>
            Last saved: {new Date(savedAt).toLocaleString("en-AU")}
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 8, background: "#FCEAEA", color: T.danger, borderRadius: T.radiusSm, padding: "10px 12px", fontSize: 12, fontWeight: 700 }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ marginBottom: 8, background: T.primaryLight, color: T.primaryDark, borderRadius: T.radiusSm, padding: "10px 12px", fontSize: 12, fontWeight: 700 }}>
            {notice}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 350px", gap: 12, alignItems: "start" }}>
          <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700 }}>Canvas</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={activeSectionId}
                  onChange={(e) => {
                    setActiveSectionId(e.target.value);
                    setSelectedRoomId(null);
                    setPinModeRoomId(null);
                  }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12, color: T.text, background: "#fff", fontWeight: 700 }}
                >
                  {houseSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                </select>
                <button
                  onClick={addSection}
                  style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  + Section
                </button>
                <span style={{ fontSize: 11, color: T.textMuted }}>Image Opacity</span>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={referenceImageOpacity}
                  onChange={(e) => setReferenceImageOpacity(clamp(Number(e.target.value), 0.05, 1))}
                />
                <button
                  onClick={() => {
                    setReferenceImagePath("");
                    setReferenceImageUrl("");
                  }}
                  disabled={!referenceImageUrl}
                  style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: !referenceImageUrl ? "not-allowed" : "pointer", opacity: !referenceImageUrl ? 0.6 : 1 }}
                >
                  Remove Image
                </button>
              </div>
            </div>

            <div
              ref={canvasRef}
              style={{
                position: "relative",
                minHeight: CANVAS_HEIGHT,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                overflow: "hidden",
                backgroundColor: "#FBFCFD",
                backgroundImage: "linear-gradient(to right, rgba(35,47,50,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(35,47,50,0.06) 1px, transparent 1px)",
                backgroundSize: `${GRID}px ${GRID}px`,
              }}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                setSelectedRoomId(null);
                setPinModeRoomId(null);
              }}
            >
              {referenceImageUrl && (
                <img
                  src={referenceImageUrl}
                  alt="Reference floor plan"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    opacity: referenceImageOpacity,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                />
              )}

              {roomsInActiveSection.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div style={{ textAlign: "center", color: T.textLight }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>No rooms in this section</div>
                    <div style={{ fontSize: 12 }}>Upload + interpret an image, or click "Add Room".</div>
                  </div>
                </div>
              )}

              {roomsInActiveSection.map((room) => {
                const meta = getColorMeta(room.difficulty_level);
                const bg = normalizeHexColor(meta?.color || "#BFD7EF");
                const border = darkenColor(bg, 0.22);
                const text = textColorForBackground(bg);
                const isSelected = String(room.id) === String(selectedRoomId);
                const isPinMode = String(room.id) === String(pinModeRoomId);

                return (
                  <Rnd
                    key={room.id}
                    bounds="parent"
                    dragHandleClassName="room-drag-handle"
                    dragGrid={[GRID, GRID]}
                    resizeGrid={[GRID, GRID]}
                    size={{ width: room.width, height: room.height }}
                    position={{ x: room.x, y: room.y }}
                    minWidth={MIN_ROOM_WIDTH}
                    minHeight={MIN_ROOM_HEIGHT}
                    onDragStart={() => {
                      setSelectedRoomId(room.id);
                    }}
                    onResizeStart={() => {
                      setSelectedRoomId(room.id);
                    }}
                    onDrag={(_, data) => {
                      upsertRoom(room.id, { x: snap(data.x), y: snap(data.y) });
                    }}
                    onDragStop={(_, data) => {
                      upsertRoom(room.id, { x: snap(data.x), y: snap(data.y) });
                    }}
                    onResize={(_, __, ref, ___, pos) => {
                      upsertRoom(room.id, {
                        x: snap(pos.x),
                        y: snap(pos.y),
                        width: Math.max(MIN_ROOM_WIDTH, snap(ref.offsetWidth)),
                        height: Math.max(MIN_ROOM_HEIGHT, snap(ref.offsetHeight)),
                      });
                    }}
                    onResizeStop={(_, __, ref, ___, pos) => {
                      upsertRoom(room.id, {
                        x: snap(pos.x),
                        y: snap(pos.y),
                        width: Math.max(MIN_ROOM_WIDTH, snap(ref.offsetWidth)),
                        height: Math.max(MIN_ROOM_HEIGHT, snap(ref.offsetHeight)),
                      });
                    }}
                    style={{ zIndex: isSelected ? 3 : 2 }}
                  >
                    <div
                      onMouseDown={() => {
                        setSelectedRoomId(room.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPinMode) return;

                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
                        const relY = clamp((e.clientY - rect.top) / rect.height, 0, 1);

                        addPinToRoom(room.id, {
                          x: relX,
                          y: relY,
                          note: pinDraftNote.trim() || "Pin note",
                        });
                        setPinModeRoomId(null);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 10,
                        border: `2px solid ${isSelected ? border : `${border}AA`}`,
                        background: bg,
                        color: text,
                        position: "relative",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        cursor: isPinMode ? "crosshair" : "default",
                        boxShadow: isSelected ? "0 0 0 2px rgba(44,78,96,0.14)" : "none",
                      }}
                    >
                      <div className="room-drag-handle" style={{ padding: "8px 10px", borderBottom: `1px solid ${border}70`, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "move" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                          {room.name || "Room"}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.92 }}>
                          {meta?.label || "Color"}
                        </div>
                      </div>

                      {(room.pins || []).map((pin) => (
                        <button
                          key={pin.id}
                          title={pin.note || "Pin"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRoomId(room.id);
                          }}
                          style={{
                            position: "absolute",
                            left: `calc(${(pin.x || 0) * 100}% - 7px)`,
                            top: `calc(${(pin.y || 0) * 100}% - 7px)`,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: "2px solid #fff",
                            background: "#334F59",
                            boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                            cursor: "pointer",
                          }}
                        />
                      ))}

                      {isPinMode && (
                        <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 10, fontWeight: 700, color: "#4F6270", background: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "3px 6px" }}>
                          Click to place pin
                        </div>
                      )}
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, padding: "12px", position: "sticky", top: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              House Sections
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {houseSections.map((section) => {
                const isActive = String(section.id) === String(activeSectionId);
                return (
                  <div key={section.id} style={{ border: `1px solid ${isActive ? T.primary : T.borderLight}`, borderRadius: 8, padding: 8, background: isActive ? T.primaryLight : T.bg }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
                      <input
                        value={section.label}
                        onChange={(e) => updateSection(section.id, { label: e.target.value })}
                        style={{ ...inputStyle, marginBottom: 0 }}
                        placeholder="Section name"
                      />
                      <button
                        onClick={() => setActiveSectionId(section.id)}
                        style={{ border: "none", background: "transparent", color: isActive ? T.primaryDark : T.textMuted, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                      >
                        {isActive ? "Active" : "View"}
                      </button>
                      <button
                        onClick={() => removeSection(section.id)}
                        disabled={houseSections.length <= 1}
                        style={{ border: "none", background: "transparent", color: T.danger, fontSize: 11, fontWeight: 700, cursor: houseSections.length <= 1 ? "not-allowed" : "pointer", opacity: houseSections.length <= 1 ? 0.5 : 1 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addSection}
              style={{ width: "100%", padding: "8px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
            >
              + Add House Section
            </button>

            <div style={{ height: 1, background: T.borderLight, marginBottom: 10 }} />

            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Color Legend
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {colorLegend.map((item) => (
                <div key={item.id} style={{ border: `1px solid ${T.borderLight}`, borderRadius: 8, padding: 8, background: T.bg }}>
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 6, alignItems: "center" }}>
                    <input
                      type="color"
                      value={normalizeHexColor(item.color)}
                      onChange={(e) => updateLegendItem(item.id, { color: e.target.value })}
                      style={{ width: 30, height: 30, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                    />
                    <input
                      value={item.label}
                      onChange={(e) => updateLegendItem(item.id, { label: e.target.value })}
                      style={{ ...inputStyle, marginBottom: 0 }}
                      placeholder="Meaning"
                    />
                    <button
                      onClick={() => removeLegendItem(item.id)}
                      disabled={colorLegend.length <= 1}
                      style={{ border: "none", background: "transparent", color: T.danger, fontSize: 11, fontWeight: 700, cursor: colorLegend.length <= 1 ? "not-allowed" : "pointer", opacity: colorLegend.length <= 1 ? 0.5 : 1 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addLegendItem}
              style={{ width: "100%", padding: "8px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
            >
              + Add Color Meaning
            </button>

            <div style={{ height: 1, background: T.borderLight, marginBottom: 10 }} />

            {!selectedRoom ? (
              <div style={{ color: T.textMuted, fontSize: 13 }}>
                Select a room to edit its name, color meaning, notes and pins.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  Selected Room
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: T.text, marginBottom: 10 }}>{selectedRoom.name || "Room"}</div>

                <label style={labelStyle}>Room Name</label>
                <input
                  value={selectedRoom.name || ""}
                  onChange={(e) => upsertRoom(selectedRoom.id, { name: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Master Bedroom"
                />

                <label style={labelStyle}>House Section</label>
                <select
                  value={selectedRoom.section_key || defaultSectionKey}
                  onChange={(e) => {
                    upsertRoom(selectedRoom.id, { section_key: e.target.value });
                    setActiveSectionId(e.target.value);
                  }}
                  style={inputStyle}
                >
                  {houseSections.map((section) => (
                    <option key={section.id} value={section.id}>{section.label}</option>
                  ))}
                </select>

                <label style={labelStyle}>Color Meaning</label>
                <select
                  value={selectedRoom.difficulty_level || defaultColorKey}
                  onChange={(e) => upsertRoom(selectedRoom.id, { difficulty_level: e.target.value })}
                  style={inputStyle}
                >
                  {colorLegend.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>

                <label style={labelStyle}>Notes</label>
                <textarea
                  value={selectedRoom.notes || ""}
                  onChange={(e) => upsertRoom(selectedRoom.id, { notes: e.target.value })}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 82 }}
                  placeholder="Special cleaning instructions for this room"
                />

                <div style={{ height: 1, background: T.borderLight, margin: "10px 0" }} />

                <label style={labelStyle}>Pin Note</label>
                <input
                  value={pinDraftNote}
                  onChange={(e) => setPinDraftNote(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Fragile lamp by window"
                />

                <button
                  onClick={() => setPinModeRoomId((prev) => (String(prev) === String(selectedRoom.id) ? null : selectedRoom.id))}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${String(pinModeRoomId) === String(selectedRoom.id) ? T.primary : T.border}`,
                    background: String(pinModeRoomId) === String(selectedRoom.id) ? T.primaryLight : "#fff",
                    color: String(pinModeRoomId) === String(selectedRoom.id) ? T.primaryDark : T.text,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 10,
                  }}
                >
                  {String(pinModeRoomId) === String(selectedRoom.id) ? "Cancel Pin Mode" : "Add Pin"}
                </button>

                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
                  Pins: {(selectedRoom.pins || []).length}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {(selectedRoom.pins || []).map((pin, idx) => (
                    <div key={pin.id} style={{ border: `1px solid ${T.borderLight}`, borderRadius: 8, padding: "7px 8px", background: T.bg }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Pin {idx + 1}</div>
                        <button
                          onClick={() => removePin(selectedRoom.id, pin.id)}
                          style={{ border: "none", background: "transparent", color: T.danger, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        value={pin.note || ""}
                        onChange={(e) => updatePin(selectedRoom.id, pin.id, { note: e.target.value })}
                        style={{ ...inputStyle, marginBottom: 4 }}
                        placeholder="Pin note"
                      />
                      <div style={{ fontSize: 10, color: T.textLight }}>
                        x: {(pin.x * 100).toFixed(1)}% · y: {(pin.y * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  {(selectedRoom.pins || []).length === 0 && (
                    <div style={{ fontSize: 11, color: T.textLight }}>No pins yet.</div>
                  )}
                </div>

                <div style={{ height: 1, background: T.borderLight, margin: "10px 0" }} />

                <button
                  onClick={() => removeRoom(selectedRoom.id)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: T.radiusSm, border: "none", background: T.dangerLight, color: T.danger, fontWeight: 700, cursor: "pointer" }}
                >
                  Delete Room
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 4,
};

const inputStyle = {
  width: "100%",
  borderRadius: 8,
  border: `1.5px solid ${T.border}`,
  background: "#fff",
  padding: "8px 10px",
  fontSize: 13,
  color: T.text,
  marginBottom: 10,
  boxSizing: "border-box",
};
