// ═══════════════════════════════════════════════════════════
// THEME & SHARED CONSTANTS
// ═══════════════════════════════════════════════════════════

export const T = {
  bg: "#F3F1EA", card: "#FFFCF6", primary: "#5B7F62", primaryLight: "#E8EFE4", primaryDark: "#355240",
  blue: "#4F7D82", blueLight: "#E7F0EF", accent: "#C8A765", accentLight: "#F8F1E1",
  text: "#26352D", textMuted: "#6F7F74", textLight: "#98A89D", border: "#DCE4D9", borderLight: "#EAF0E6",
  danger: "#C56058", dangerLight: "#FBEFED", sidebar: "#1E2F24",
  shadow: "0 2px 10px rgba(30,47,36,0.06)", shadowMd: "0 8px 20px rgba(30,47,36,0.09)", shadowLg: "0 16px 44px rgba(30,47,36,0.14)",
  radius: 12, radiusSm: 8, radiusLg: 16,
};

export const SERVICED_AREAS = [
  "Twin Waters", "Maroochydore", "Kuluin", "Forest Glen", "Mons",
  "Buderim", "Alexandra Headland", "Mooloolaba", "Mountain Creek", "Minyama"
];

// ─── 45 Demo Clients Generator ───
export function generateDemoClients() {
  const STREETS = {
    "Twin Waters": ["Oceanside Dr","Lakeside Ave","Sailfish Ct","Pelican Way","Marina Blvd","Harbour Dr","Seaspray Cres","Coral Key Dr","Coorella Cct","Edgewater Pl"],
    "Maroochydore": ["Aerodrome Rd","Duporth Ave","Dalton Dr","Cotton Tree Pde","Picnic Point Esp","Bradman Ave","Memorial Ave","Sixth Ave","Cornmeal Pde","Millwell Rd"],
    "Kuluin": ["Kuluin St","Rosebed St","Lumeah Dr","Anne St","Valroy Dr","Sunshine Ct","Hilltop Ave","Cedar Rd","Acacia St","Teak Ct"],
    "Forest Glen": ["Forest Glen Rd","Doolan St","Vise Rd","Anning Rd","Balmoral Rd","Creekside Dr","Ironbark Pl","Silky Oak Ct","Tallowwood Ave","Blackbutt Dr"],
    "Mons": ["Mons Rd","Sunrise Rd","Panorama Dr","Ridgewood Ct","Mountain View Dr","Valley Cres","Hilltop Ct","Wattle Dr","Summit Ave","Bushland Pl"],
    "Buderim": ["Burnett St","King St","Lindsay Rd","Gloucester Rd","Main St","Crosby Hill Rd","Ballinger Rd","Woombye–Palmwoods Rd","Seaview Tce","Dixon St"],
    "Alexandra Headland": ["Alexandra Pde","Okinja Rd","Mary St","Pacific Tce","Albatross Ave","Hill St","Beach Rd","Ilya St","Peel St","Buderim Ave"],
    "Mooloolaba": ["Smith St","Brisbane Rd","Walan St","Meta St","Foote St","River Esp","Parkyn Pde","Kyamba Ct","Venning St","Hancock St"],
    "Mountain Creek": ["Karawatha Dr","Mountain Creek Rd","Glenfields Blvd","Brookfield Dr","Parklands Blvd","Creekwood Ct","Lakewood Dr","Rainforest Dr","Forest Park Dr","Greenway Cct"],
    "Minyama": ["Jessica Blvd","Minyama St","Glenyce Ct","Brittany Dr","Windsong Pl","The Anchorage","Doone Ct","Catamaran Ct","Harbour View Tce","Regatta Blvd"],
  };
  const FIRST = ["Sarah","Emily","James","Michael","Jessica","Lauren","Daniel","Andrew","Rebecca","David","Natalie","Chris","Olivia","Ben","Sophie","Tom","Hannah","Matt","Chloe","Luke","Megan","Ryan","Amy","Nathan","Emma","Josh","Nicole","Aaron","Katie","Mark","Lisa","Jack","Rachel","Tim","Zoe","Sam","Brooke","Liam","Jess","Ethan","Holly","Lachlan","Tegan","Dylan","Gemma"];
  const LAST = ["Mitchell","Anderson","Taylor","Campbell","Robinson","Thompson","Wilson","Martin","Clark","Walker","Harris","Scott","Stewart","Kelly","Murphy","Singh","Brown","White","Jones","Johnson","Williams","Davis","Thomas","Moore","Lee","Ward","Turner","Baker","Chen","Patel","O'Brien","Fraser","Hughes","Adams","Morgan","Price","Reid","Marshall","Ross","Nguyen","Cooper","Watson","Graham","Sullivan"];
  const ACCESS = ["Key in lockbox — code 4521","Spare key under pot plant by front door","Garage code: 7890# — enter through laundry","Side gate unlocked, back door code 1234","Ring doorbell, owner works from home","Key under mat, alarm code 5678","Cleaner's key with building manager","Sliding door left unlocked on clean days","Keypad on front door — code 3690","Key in lockbox on side fence — combo 2580","Code for front gate: 8832, key under frog statue","Let yourself in via carport side door (unlocked)","Ring bell twice — husband is deaf in one ear","Access via back deck stairs, key taped inside meter box","Entry through garage — remote in lockbox by mailbox"];
  const NOTES = ["Two friendly golden retrievers — keep gates closed","Cat Miso is indoor only, don't let him out","Baby naps 12–2pm, please keep noise down","Elderly mother lives in granny flat — say hi!","Uses eco-friendly products only — under sink","Please water indoor plants on kitchen bench","No vacuuming master bedroom on Wednesdays (night shift)","Teenagers' rooms need extra attention","Focus on bathrooms — hard water stains","Has 3 cats, please close all external doors","Uses robot vacuum M–F, just mop floors on clean day","Recently renovated kitchen — be careful with stone benchtops","Owner is allergic to bleach — green products only","Leave clean towels folded on bed please","Skip kids' playroom upstairs — they tidy it themselves","Please empty dishwasher if cycle is done","Two parrots in living room — cover cage while vacuuming","Pool area needs a sweep if leaves are bad","Please strip and remake beds fortnightly","Wipe down outdoor furniture if time allows","Home office is off limits — just vacuum floor","New puppy in training — may have accidents to clean","Please take bins out if it's bin night (Tuesday)","Incense burning = someone meditating, come back to that room later","Solar panels crew may be on roof some Thursdays"];
  const TIMES = ["morning","morning","morning","afternoon","afternoon","anytime","anytime","anytime","morning","morning"];
  const DAYS  = ["monday","monday","tuesday","tuesday","wednesday","wednesday","thursday","thursday","friday","monday","tuesday","wednesday","thursday","friday"];
  const FREQS = ["weekly","weekly","weekly","fortnightly","fortnightly","fortnightly","fortnightly","fortnightly","monthly","monthly"];

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  const usedNames = new Set();
  const clients = [];
  const shuffledFirst = shuffle(FIRST);
  const shuffledLast  = shuffle(LAST);

  for (let i = 0; i < 45; i++) {
    let first, last, fullName;
    do {
      first = shuffledFirst[i % shuffledFirst.length];
      last  = shuffledLast[i % shuffledLast.length];
      if (i >= shuffledFirst.length) last = shuffledLast[(i + 7) % shuffledLast.length];
      fullName = `${first} ${last}`;
    } while (usedNames.has(fullName) && usedNames.size < 200);
    usedNames.add(fullName);

    const suburb   = SERVICED_AREAS[i % SERVICED_AREAS.length];
    const streets  = STREETS[suburb];
    const street   = streets[i % streets.length];
    const num      = 1 + Math.floor(Math.random() * 120);
    const beds     = pick([2,3,3,3,4,4,4,5]);
    const baths    = beds <= 3 ? pick([1,1,2,2]) : pick([2,2,3,3]);
    const living   = pick([1,1,1,2,2]);
    const kitchen  = 1;
    const freq     = FREQS[i % FREQS.length];
    const day      = DAYS[i % DAYS.length];
    const time     = TIMES[i % TIMES.length];
    const emailDomain = pick(["gmail.com","outlook.com","icloud.com","hotmail.com","yahoo.com.au"]);
    const phone    = `04${String(Math.floor(10000000 + Math.random() * 90000000))}`;
    const email    = `${first.toLowerCase()}.${last.toLowerCase().replace("'","")}@${emailDomain}`;
    const postcode = suburb === "Buderim" ? "4556" : suburb === "Mooloolaba" || suburb === "Alexandra Headland" ? "4557" : suburb === "Maroochydore" || suburb === "Kuluin" ? "4558" : suburb === "Twin Waters" || suburb === "Minyama" ? "4575" : suburb === "Mountain Creek" ? "4557" : suburb === "Forest Glen" || suburb === "Mons" ? "4556" : "4556";
    const address  = `${num} ${street}, ${suburb} QLD ${postcode}`;
    const dur      = beds * 25 + baths * 30 + living * 20 + kitchen * 25 + 30;

    const hasAccess = Math.random() < 0.65;
    const hasNotes  = Math.random() < 0.55;

    clients.push({
      name: fullName,
      email,
      phone,
      address,
      suburb,
      bedrooms: beds,
      bathrooms: baths,
      living,
      kitchen,
      frequency: freq,
      preferred_day: day,
      preferred_time: time,
      estimated_duration: dur,
      custom_duration: Math.random() < 0.2 ? dur + pick([-15, -10, 10, 15, 20]) : null,
      status: i < 38 ? "active" : pick(["active","paused","paused"]),
      notes: hasNotes ? pick(NOTES) : "",
      access_notes: hasAccess ? pick(ACCESS) : "",
      is_demo: true,
    });
  }
  return clients;
}

// ─── Payment tracking ───
export function loadPayments() {
  try {
    const stored = localStorage.getItem("db_payments");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function savePayments(payments) {
  try {
    localStorage.setItem("db_payments", JSON.stringify(payments));
  } catch {}
}

export function addPayment(payment) {
  const payments = loadPayments();
  payments.unshift({
    ...payment,
    id: `payment_${Date.now()}`,
    recordedAt: new Date().toISOString(),
  });
  savePayments(payments);
  return payments;
}

export function getPaymentsForJob(jobId) {
  return loadPayments().filter(p => p.jobId === jobId);
}

export function getPaymentsForClient(clientId) {
  return loadPayments().filter(p => p.clientId === clientId);
}

export function getTotalOwed(jobs, payments) {
  // Calculate total owed from completed jobs minus payments
  const completedJobsTotal = jobs
    .filter(j => j.status === "completed")
    .reduce((sum, j) => sum + (j.price || 0), 0);
  
  const paymentsTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  return completedJobsTotal - paymentsTotal;
}

// ─── Invoice tracking ───
export function loadInvoices() {
  try {
    const stored = localStorage.getItem("db_invoices");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveInvoices(invoices) {
  try {
    localStorage.setItem("db_invoices", JSON.stringify(invoices));
  } catch {}
}

export function addInvoice(invoice) {
  const invoices = loadInvoices();
  const invoiceNumber = `INV-${String(invoices.length + 1).padStart(4, '0')}`;
  invoices.unshift({
    ...invoice,
    id: `invoice_${Date.now()}`,
    invoiceNumber,
    createdAt: new Date().toISOString(),
    status: "unpaid",
  });
  saveInvoices(invoices);
  return invoices[0];
}

// ─── Photo storage using IndexedDB ───
const DB_NAME = "DustBunniesPhotos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("jobId", "jobId", { unique: false });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("teamId", "teamId", { unique: false });
      }
    };
  });
}

export async function savePhoto(photoData) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const photo = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...photoData,
      uploadedAt: new Date().toISOString(),
    };
    
    const request = store.add(photo);
    request.onsuccess = () => resolve(photo);
    request.onerror = () => reject(request.error);
  });
}

export async function getPhotosForJob(jobId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("jobId");
    const request = index.getAll(jobId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPhotosForDate(date) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("date");
    const request = index.getAll(date);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllPhotos() {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePhoto(photoId) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(photoId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Suburb coordinates (fallback when no address) ───
export const SUBURB_COORDS = {
  "Twin Waters": { lat: -26.6275, lng: 153.0853 },
  "Maroochydore": { lat: -26.6590, lng: 153.0997 },
  "Kuluin": { lat: -26.6567, lng: 153.0486 },
  "Forest Glen": { lat: -26.6833, lng: 153.0167 },
  "Mons": { lat: -26.7167, lng: 153.0333 },
  "Buderim": { lat: -26.6844, lng: 153.0500 },
  "Alexandra Headland": { lat: -26.6678, lng: 153.1031 },
  "Mooloolaba": { lat: -26.6817, lng: 153.1192 },
  "Mountain Creek": { lat: -26.6933, lng: 153.0972 },
  "Minyama": { lat: -26.6833, lng: 153.1167 },
};

// ─── Get coordinates for a client ───
export function getClientCoords(client) {
  // If client has geocoded coordinates, use those
  if (client.lat && client.lng) {
    return { lat: client.lat, lng: client.lng };
  }
  // Otherwise fall back to suburb center
  return SUBURB_COORDS[client.suburb] || { lat: -26.6590, lng: 153.0997 }; // Default to Maroochydore
}

// ═══════════════════════════════════════════════════════════
// EMAIL TRACKING & HISTORY
// ═══════════════════════════════════════════════════════════

export function loadEmailHistory() {
  try {
    const stored = localStorage.getItem("db_email_history");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveEmailHistory(history) {
  try {
    localStorage.setItem("db_email_history", JSON.stringify(history));
  } catch {}
}

export function addEmailToHistory(entry) {
  const history = loadEmailHistory();
  history.unshift({
    ...entry,
    id: `email_${Date.now()}`,
    sentAt: new Date().toISOString(),
  });
  // Keep last 500 entries
  saveEmailHistory(history.slice(0, 500));
}

export function getClientEmailHistory(clientId) {
  return loadEmailHistory().filter(e => e.clientId === clientId);
}

export function getLastEmailForClient(clientId) {
  const history = loadEmailHistory();
  return history.find(e => e.clientId === clientId) || null;
}

// ─── Calculate days since a date ───
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  return diff;
}

// ─── Get follow-up status for display ───
export function getFollowUpStatus(quoteSentAt) {
  const days = daysSince(quoteSentAt);
  if (days === null) return null;
  if (days >= 7) return { level: "urgent", days, label: `${days}d - Urgent!`, color: "#D4645C" };
  if (days >= 3) return { level: "warning", days, label: `${days}d - Follow up`, color: "#E8C86A" };
  return { level: "ok", days, label: `${days}d ago`, color: "#7A8F85" };
}

// ─── Email template types ───
export const EMAIL_TEMPLATES = {
  quote: {
    id: "quote",
    name: "Quote",
    icon: "💰",
    description: "Send pricing quote to client",
    subject: "Your Cleaning Quote is Ready! 🌿 — Dust Bunnies Cleaning",
  },
  follow_up: {
    id: "follow_up",
    name: "Follow-up",
    icon: "📩",
    description: "Chase quotes sent 3+ days ago",
    subject: "Just checking in! 🌿 — Dust Bunnies Cleaning",
  },
  review_request: {
    id: "review_request",
    name: "Review Request",
    icon: "⭐",
    description: "Ask happy clients for a Google review",
    subject: "Loved your clean? We'd love a review! ⭐",
  },
  booking_confirmation: {
    id: "booking_confirmation",
    name: "Booking Confirmation",
    icon: "✅",
    description: "Confirm when a quote is accepted",
    subject: "You're booked in! 🎉 — Dust Bunnies Cleaning",
  },
  reminder: {
    id: "reminder",
    name: "Reminder",
    icon: "🔔",
    description: "Day-before clean reminder",
    subject: "See you tomorrow! 🌿 — Dust Bunnies Cleaning",
  },
  custom: {
    id: "custom",
    name: "Custom Email",
    icon: "✏️",
    description: "Create your own message",
    subject: "",
  },
};

// ─── Custom email styles ───
export const CUSTOM_EMAIL_STYLES = {
  announcement: {
    id: "announcement",
    name: "Announcement",
    icon: "📢",
    description: "News, updates, new services",
    headerColor: "#4A9E7E",
    accentColor: "#E8F5EE",
  },
  promotion: {
    id: "promotion",
    name: "Promotion",
    icon: "🎉",
    description: "Discounts, offers, deals",
    headerColor: "#E8C86A",
    accentColor: "#FFF8E7",
  },
  thank_you: {
    id: "thank_you",
    name: "Thank You",
    icon: "💚",
    description: "Appreciation, milestones",
    headerColor: "#5B9EC4",
    accentColor: "#E6F0F7",
  },
  simple: {
    id: "simple",
    name: "Simple Note",
    icon: "📝",
    description: "Quick personal message",
    headerColor: "#1B3A2D",
    accentColor: "#F4F8F6",
  },
};

// ─── Default Pricing (used if nothing in localStorage) ───
export const DEFAULT_PRICING = {
  bedroom: { price: 25, unit: "per room", icon: "🛏️", label: "Bedroom", category: "room" },
  bathroom: { price: 35, unit: "per room", icon: "🚿", label: "Bathroom", category: "room" },
  living: { price: 25, unit: "per room", icon: "🛋️", label: "Living Room", category: "room" },
  kitchen: { price: 50, unit: "per room", icon: "🍳", label: "Kitchen", category: "room" },
  oven: { price: 65, unit: "per clean", icon: "♨️", label: "Oven Deep Clean", category: "addon" },
  sheets: { price: 10, unit: "per set", icon: "🛏️", label: "Sheet Changes", category: "addon" },
  windows: { price: 5, unit: "per window", icon: "🪟", label: "Window Cleaning", category: "addon", hasQuantity: true },
  organising: { price: 60, unit: "per session", icon: "📦", label: "Organising", category: "addon" },
};

// ─── Load/Save Pricing from localStorage ───
export function loadPricing() {
  try {
    const stored = localStorage.getItem("db_pricing");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { ...DEFAULT_PRICING };
}

export function savePricing(pricing) {
  try {
    localStorage.setItem("db_pricing", JSON.stringify(pricing));
  } catch {}
}

// ─── Default Message Templates ───
export const DEFAULT_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome Reply",
    content: "Hey! 👋 Thanks so much for reaching out to Dust Bunnies! We'd love to help get your home sparkling. Could you fill in our quick form so we can put together a personalised quote for you? [FORM LINK] 🌿",
    isDefault: true,
  },
  {
    id: "quote_ready",
    name: "Quote Ready",
    content: "Hey {NAME}! 🌿 Great news — your personalised quote is ready! We've put together pricing for your {FREQUENCY} clean based on the details you shared. Take a look and let us know if you'd like to go ahead! 💚",
    isDefault: true,
  },
  {
    id: "follow_up",
    name: "Follow Up",
    content: "Hey {NAME}! 👋 Just checking in — did you get a chance to look at the quote we sent through? Happy to answer any questions or make adjustments. No pressure at all! 🌿",
    isDefault: true,
  },
  {
    id: "out_of_area",
    name: "Out of Area",
    content: "Hey! Thanks so much for getting in touch 💚 Unfortunately we don't currently service your area, but we're expanding soon! We'll keep your details on file and reach out when we do. Wishing you all the best! 🌿",
    isDefault: true,
  },
  {
    id: "booking_confirmed",
    name: "Booking Confirmed",
    content: "Yay! 🎉 You're all booked in! We're so excited to welcome you to the Dust Bunnies family. Your first clean is scheduled for [DATE]. See you then! 💚🌿",
    isDefault: true,
  },
];

export function loadTemplates() {
  try {
    const stored = localStorage.getItem("db_templates");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_TEMPLATES];
}

export function saveTemplates(templates) {
  try {
    localStorage.setItem("db_templates", JSON.stringify(templates));
  } catch {}
}

// ─── Clients/Contacts Storage ───
export function loadClients() {
  try {
    const stored = localStorage.getItem("db_clients");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveClients(clients) {
  try {
    localStorage.setItem("db_clients", JSON.stringify(clients));
  } catch {}
}

export const WEEKLY_DISCOUNT = 0.10;

export function calcQuote(details, pricing) {
  let subtotal = 0;
  const items = [];
  
  // Get room services
  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");
  
  roomServices.forEach(([key, service]) => {
    const qty = details[key] || 0;
    if (qty > 0) {
      const total = qty * service.price;
      items.push({ description: `${service.label} cleaning`, qty, unitPrice: service.price, total });
      subtotal += total;
    }
  });

  // Get addon services
  const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");
  
  addonServices.forEach(([key, service]) => {
    const active = details[key];
    const qty = service.hasQuantity ? (details[`${key}Count`] || 0) : 1;
    if (active && qty > 0) {
      const total = qty * service.price;
      items.push({ description: service.label, qty, unitPrice: service.price, total });
      subtotal += total;
    }
  });

  const isWeekly = details.frequency === "weekly";
  const discount = isWeekly ? Math.round(subtotal * WEEKLY_DISCOUNT * 100) / 100 : 0;
  const total = subtotal - discount;

  return { items, subtotal, discount, discountLabel: isWeekly ? "Weekly Clean Discount (10%)" : null, total };
}

// ─── Mock Data Generator ───
const MOCK_NAMES = [
  "Sarah Mitchell", "James Cooper", "Priya Sharma", "Lena Nguyen",
  "Tom Brady", "Emily Watson", "Mike Chen", "Jessica Lee",
  "David Kim", "Rachel Green", "Sophie Turner", "Alex Morrison",
  "Hannah Brooks", "Ben Gallagher", "Olivia Hart", "Nathan Price"
];

const MOCK_MESSAGES = [
  "Hi! I'd love a quote for a regular clean of my home please 🏡",
  "Hey, was recommended by a friend. Looking for fortnightly cleaning?",
  "Hello! Just moved to the area and need a cleaner. Can you help?",
  "Hi there, interested in your cleaning services. What do you need from me?",
  "Hey! Do you service my area? Looking for weekly cleaning.",
  "Hi, I need a deep clean + regular ongoing service. What are your rates?",
  "Hello! Saw your page on Facebook. Would love a quote please!",
  "Hey there! Looking for a reliable cleaner, my friend Sarah recommended you 💚",
];

const CHANNELS = ["messenger", "instagram", "email"];

let _idCounter = 100;
export function generateMockEnquiry(forceArea = null) {
  const id = ++_idCounter;
  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
  const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
  const message = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
  const suburb = forceArea || (Math.random() > 0.15
    ? SERVICED_AREAS[Math.floor(Math.random() * SERVICED_AREAS.length)]
    : "Caloundra");

  return {
    id, name, channel, suburb, message,
    status: "new",
    timestamp: new Date().toISOString(),
    avatar: name.split(" ").map(n => n[0]).join(""),
    details: null,
    quoteId: null,
    archived: false,
  };
}

export function generateMockFormSubmission() {
  const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
  const suburb = SERVICED_AREAS[Math.floor(Math.random() * SERVICED_AREAS.length)];
  return {
    name, suburb,
    email: name.toLowerCase().replace(" ", ".") + "@email.com",
    phone: "04" + Math.floor(10000000 + Math.random() * 90000000),
    bedrooms: 2 + Math.floor(Math.random() * 3),
    bathrooms: 1 + Math.floor(Math.random() * 2),
    living: 1 + Math.floor(Math.random() * 2),
    kitchen: 1,
    frequency: ["weekly", "fortnightly", "monthly"][Math.floor(Math.random() * 3)],
    oven: Math.random() > 0.6,
    sheets: Math.random() > 0.7,
    windows: Math.random() > 0.5,
    windowsCount: 2 + Math.floor(Math.random() * 8),
    organising: Math.random() > 0.8,
    notes: Math.random() > 0.5 ? "We have a dog, please keep the gate closed!" : "",
  };
}

// ─── Initial sample data ───
export function getInitialEnquiries() {
  const now = new Date();
  return [
    {
      id: 1, name: "Sarah Mitchell", channel: "messenger", suburb: "Buderim",
      message: "Hi! I'd love a quote for a regular clean of my 3-bed home please 🏡",
      status: "quote_ready", timestamp: new Date(now - 3600000 * 2).toISOString(),
      avatar: "SM", archived: false,
      details: { bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, frequency: "fortnightly", oven: true, sheets: false, windows: false, windowsCount: 0, organising: false, notes: "", email: "sarah.mitchell@email.com", phone: "0412345678" },
      quoteId: "Q001",
    },
    {
      id: 2, name: "James Cooper", channel: "email", suburb: "Maroochydore",
      message: "Hey, was recommended by a friend. Looking for weekly cleaning of our place?",
      status: "info_requested", timestamp: new Date(now - 3600000 * 5).toISOString(),
      avatar: "JC", details: null, quoteId: null, archived: false,
    },
    {
      id: 3, name: "Tom Brady", channel: "instagram", suburb: "Caloundra",
      message: "Hi do you clean in Caloundra? Need a fortnightly cleaner",
      status: "out_of_area", timestamp: new Date(now - 3600000 * 8).toISOString(),
      avatar: "TB", details: null, quoteId: null, archived: false,
    },
    {
      id: 4, name: "Lena Nguyen", channel: "messenger", suburb: "Mooloolaba",
      message: "Hello! Just moved here and need a regular cleaner. Have a 4 bed 2 bath.",
      status: "accepted", timestamp: new Date(now - 86400000).toISOString(),
      avatar: "LN", archived: false,
      details: { bedrooms: 4, bathrooms: 2, living: 2, kitchen: 1, frequency: "weekly", oven: false, sheets: true, windows: true, windowsCount: 8, organising: false, notes: "2 dogs, please close front gate", email: "lena.nguyen@email.com", phone: "0423456789" },
      quoteId: "Q002",
    },
    {
      id: 5, name: "Emily Watson", channel: "email", suburb: "Twin Waters",
      message: "Hi there, interested in your cleaning services for our holiday rental",
      status: "new", timestamp: new Date(now - 1800000).toISOString(),
      avatar: "EW", details: null, quoteId: null, archived: false,
    },
  ];
}

export function getInitialQuotes() {
  return [
    {
      id: "Q001", enquiryId: 1, name: "Sarah Mitchell", channel: "messenger", suburb: "Buderim",
      frequency: "Fortnightly", status: "pending_approval", createdAt: new Date(Date.now() - 3600000).toISOString(),
      details: { bedrooms: 3, bathrooms: 2, living: 1, kitchen: 1, frequency: "fortnightly", oven: true, sheets: false, windows: false, windowsCount: 0, organising: false },
    },
    {
      id: "Q002", enquiryId: 4, name: "Lena Nguyen", channel: "messenger", suburb: "Mooloolaba",
      frequency: "Weekly", status: "accepted", createdAt: new Date(Date.now() - 86400000).toISOString(),
      details: { bedrooms: 4, bathrooms: 2, living: 2, kitchen: 1, frequency: "weekly", oven: false, sheets: true, windows: true, windowsCount: 8, organising: false },
    },
  ];
}

// ─── Icon options for new services ───
export const ICON_OPTIONS = ["🧹", "🧽", "🪣", "🧴", "✨", "🏠", "🚿", "🛁", "🪟", "🚪", "🛋️", "🛏️", "🍳", "♨️", "📦", "🌿", "💨", "🧺", "🪑", "🖼️"];

// ═══════════════════════════════════════════════════════════
// SCHEDULING SYSTEM
// ═══════════════════════════════════════════════════════════

export const DEFAULT_SCHEDULE_SETTINGS = {
  workingHours: {
    start: "08:00",
    end: "16:00",
    breakDuration: 30, // minutes
    travelBuffer: 20, // minutes between jobs
  },
  durationEstimates: {
    bedroom: 25,
    bathroom: 30,
    living: 20,
    kitchen: 25,
    baseSetup: 30,
  },
  areaSchedule: {
    monday: ["Buderim", "Kuluin"],
    tuesday: ["Maroochydore", "Alexandra Headland"],
    wednesday: ["Mooloolaba", "Minyama"],
    thursday: ["Twin Waters", "Mountain Creek"],
    friday: ["Forest Glen", "Mons"],
  },
  jobsPerDay: 6,
};

export function loadScheduleSettings() {
  try {
    const stored = localStorage.getItem("db_schedule_settings");
    if (stored) return JSON.parse(stored);
  } catch {}
  return { ...DEFAULT_SCHEDULE_SETTINGS };
}

export function saveScheduleSettings(settings) {
  try {
    localStorage.setItem("db_schedule_settings", JSON.stringify(settings));
  } catch {}
}

export function loadScheduledJobs() {
  try {
    const stored = localStorage.getItem("db_scheduled_jobs");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveScheduledJobs(jobs) {
  try {
    localStorage.setItem("db_scheduled_jobs", JSON.stringify(jobs));
  } catch {}
}

export function loadScheduleClients() {
  try {
    const stored = localStorage.getItem("db_schedule_clients");
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveScheduleClients(clients) {
  try {
    localStorage.setItem("db_schedule_clients", JSON.stringify(clients));
  } catch {}
}

// ─── Calculate job duration from room counts ───
export function calculateDuration(client, settings) {
  const est = settings.durationEstimates;
  let duration = est.baseSetup;
  duration += (client.bedrooms || 0) * est.bedroom;
  duration += (client.bathrooms || 0) * est.bathroom;
  duration += (client.living || 0) * est.living;
  duration += (client.kitchen || 0) * est.kitchen;
  return duration;
}

// ─── Get day of week from date ───
export function getDayOfWeek(dateStr) {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date(dateStr).getDay()];
}

// ─── Demo Data Generator ───
const DEMO_NAMES = [
  "Sarah Mitchell", "James Cooper", "Priya Sharma", "Lena Nguyen", "Tom Wilson",
  "Emily Watson", "Mike Chen", "Jessica Lee", "David Kim", "Rachel Green",
  "Sophie Turner", "Alex Morrison", "Hannah Brooks", "Ben Gallagher", "Olivia Hart",
  "Nathan Price", "Emma Collins", "Ryan Murphy", "Chloe Adams", "Jack Thompson",
  "Mia Roberts", "Luke Anderson", "Zoe Campbell", "Ethan Wright", "Lily Scott",
  "Noah Martin", "Grace Taylor", "Mason Brown", "Ava Davis", "Logan White",
  "Isla Moore", "Carter Hall", "Amelia Clark", "Owen Lewis", "Harper Young",
  "Sebastian King", "Ella Baker", "Henry Hill", "Scarlett Reed", "William Cook",
  "Victoria Morgan", "Daniel Evans", "Penelope Shaw", "Matthew Ross", "Aria Hughes"
];

const DEMO_ADDRESSES = {
  "Buderim": [
    "5 Lindsay Road, Buderim QLD 4556",
    "23 Ballinger Crescent, Buderim QLD 4556",
    "18 Gloucester Road, Buderim QLD 4556",
    "42 King Street, Buderim QLD 4556",
    "7 Burnett Street, Buderim QLD 4556",
    "31 Church Street, Buderim QLD 4556"
  ],
  "Maroochydore": [
    "15 Duporth Avenue, Maroochydore QLD 4558",
    "28 Sixth Avenue, Maroochydore QLD 4558",
    "3 Beach Road, Maroochydore QLD 4558",
    "45 Aerodrome Road, Maroochydore QLD 4558",
    "12 Plaza Parade, Maroochydore QLD 4558"
  ],
  "Kuluin": [
    "8 Nambour Connection Road, Kuluin QLD 4558",
    "22 Dixon Road, Kuluin QLD 4558",
    "35 Kiel Mountain Road, Kuluin QLD 4558",
    "14 Jones Road, Kuluin QLD 4558"
  ],
  "Mooloolaba": [
    "5 Parkyn Parade, Mooloolaba QLD 4557",
    "19 Brisbane Road, Mooloolaba QLD 4557",
    "32 Smith Street, Mooloolaba QLD 4557",
    "48 Walan Street, Mooloolaba QLD 4557"
  ],
  "Alexandra Headland": [
    "11 Pacific Terrace, Alexandra Headland QLD 4572",
    "26 Okinja Road, Alexandra Headland QLD 4572",
    "8 Alexandra Parade, Alexandra Headland QLD 4572"
  ],
  "Twin Waters": [
    "7 Dodonaea Close, Twin Waters QLD 4564",
    "21 Cove Boulevard, Twin Waters QLD 4564",
    "38 Oceanside Drive, Twin Waters QLD 4564"
  ],
  "Mountain Creek": [
    "14 Karawatha Drive, Mountain Creek QLD 4557",
    "29 Glenfields Boulevard, Mountain Creek QLD 4557",
    "46 Mountain Ash Drive, Mountain Creek QLD 4557"
  ],
  "Minyama": [
    "9 Jessica Boulevard, Minyama QLD 4575",
    "22 Doyles Road, Minyama QLD 4575",
    "35 Wises Road, Minyama QLD 4575"
  ],
  "Forest Glen": [
    "6 Doolan Street, Forest Glen QLD 4556",
    "18 Mons School Road, Forest Glen QLD 4556",
    "31 Panorama Drive, Forest Glen QLD 4556"
  ],
  "Mons": [
    "4 Doolan Street, Mons QLD 4556",
    "16 Mooloolah Connection Road, Mons QLD 4556"
  ],
};

const DEMO_NOTES = [
  "2 dogs, keep gate closed",
  "Cat is friendly, don't let outside",
  "Baby sleeps 1-3pm, please be quiet",
  "Prefers eco products only - allergies",
  "Water plants on windowsill please",
  "Has own vacuum, use theirs",
  "",
  "",
  "",
  "",
  "",
];

const DEMO_ACCESS_NOTES = [
  "Key under front doormat",
  "Lockbox on side gate - code 5678",
  "Ring doorbell, client works from home",
  "Key in garden gnome by front door",
  "Garage code 9999, enter through laundry",
  "Alarm code: 1234#, disarm immediately",
  "Key with neighbour at #15",
  "Sliding door unlocked, enter via deck",
  "Code for keypad: 0000",
  "Client leaves door unlocked",
  "",
  "",
];

// ─── Generate schedule for clients over date range ───
export function generateScheduleForClients(clients, startDate, endDate, settings) {
  const jobs = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const getDateStr = (d) => d.toISOString().split("T")[0];
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  
  // Build a map of suburb -> preferred day based on area schedule
  const suburbToDay = {};
  Object.entries(settings.areaSchedule).forEach(([day, suburbs]) => {
    suburbs.forEach(suburb => {
      suburbToDay[suburb.toLowerCase()] = day;
    });
  });
  
  // Track team schedules: { "2025-02-17_team_a": [{ start: 480, end: 600 }, ...] }
  const teamSchedules = {};
  
  const timeToMins = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  
  const minsToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  
  const workStart = timeToMins(settings.workingHours.start);
  const workEnd = timeToMins(settings.workingHours.end);
  const breakDuration = settings.workingHours.breakDuration;
  const travelBuffer = settings.workingHours.travelBuffer;
  const middayMins = 12 * 60; // 12:00 = 720 mins
  
  // Get next available slot for a team on a date
  const getNextSlot = (dateStr, teamId, duration) => {
    const key = `${dateStr}_${teamId}`;
    if (!teamSchedules[key]) {
      teamSchedules[key] = [];
    }
    
    const schedule = teamSchedules[key];
    const jobCount = schedule.filter(s => s.type === "job").length;
    
    // Check if team is at capacity
    if (jobCount >= (settings.jobsPerDay || settings.jobsPerTeamPerDay || 6)) {
      return null;
    }
    
    // Find first available slot
    let slotStart = workStart;
    
    if (schedule.length > 0) {
      // Sort by start time
      schedule.sort((a, b) => a.start - b.start);
      const lastSlot = schedule[schedule.length - 1];
      slotStart = lastSlot.end + travelBuffer;
    }
    
    // Check if we need to insert a break (after 2nd job, closest to midday)
    if (jobCount === 2 && !schedule.some(s => s.type === "break")) {
      // Insert break now if we're past 11am or this job would push us past 1pm
      if (slotStart >= 11 * 60 || slotStart + duration > 13 * 60) {
        const breakSlot = { type: "break", start: slotStart, end: slotStart + breakDuration };
        schedule.push(breakSlot);
        slotStart = breakSlot.end + travelBuffer;
      }
    }
    
    const slotEnd = slotStart + duration;
    
    // Check if job fits within working hours
    if (slotEnd > workEnd) {
      return null;
    }
    
    return { start: slotStart, end: slotEnd };
  };
  
  // Add a job to the schedule
  const addToSchedule = (dateStr, teamId, slot) => {
    const key = `${dateStr}_${teamId}`;
    if (!teamSchedules[key]) {
      teamSchedules[key] = [];
    }
    teamSchedules[key].push({ type: "job", ...slot });
  };
  
  // Generate dates to check
  const allDates = [];
  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dayName = dayNames[currentDate.getDay()];
    if (dayName !== "saturday" && dayName !== "sunday") {
      allDates.push({
        dateStr: getDateStr(currentDate),
        dayName
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Process each client
  clients.forEach(client => {
    if (client.status !== "active") return;
    
    const duration = client.customDuration || calculateDuration(client, settings);
    
    // Determine which day this client should be scheduled based on their suburb
    const clientSuburbDay = suburbToDay[client.suburb.toLowerCase()] || client.preferredDay;
    
    // Find matching dates for this client's frequency
    let scheduledCount = 0;
    const maxSchedules = client.frequency === "weekly" ? 2 : 1; // 2 weeks of data
    
    for (const { dateStr, dayName } of allDates) {
      if (scheduledCount >= maxSchedules) break;
      
      // Check if this day matches client's suburb-assigned day
      if (dayName !== clientSuburbDay) continue;
      
      // For fortnightly, skip every other occurrence
      if (client.frequency === "fortnightly" && scheduledCount === 1) continue;
      
      // Try to get a slot for this date
      const slot = getNextSlot(dateStr, "default", duration);
      
      if (slot) {
        addToSchedule(dateStr, "default", slot);
        
        jobs.push({
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          date: dateStr,
          clientId: client.id,
          clientName: client.name,
          address: client.address || "",
          email: client.email || "",
          phone: client.phone || "",
          suburb: client.suburb,
          bedrooms: client.bedrooms ?? null,
          bathrooms: client.bathrooms ?? null,
          living: client.living ?? null,
          kitchen: client.kitchen ?? null,
          frequency: client.frequency || null,
          preferred_day: client.preferred_day || client.preferredDay || null,
          preferred_time: client.preferred_time || client.preferredTime || null,
          access_notes: client.access_notes || client.accessNotes || null,
          notes: client.notes || null,
          startTime: minsToTime(slot.start),
          endTime: minsToTime(slot.end),
          duration,
          status: "scheduled",
          isDemo: client.isDemo,
        });
        
        scheduledCount++;
        
        // Skip ahead based on frequency
        if (client.frequency === "weekly") {
          // Find the next occurrence of this day (7 days later)
          const nextIndex = allDates.findIndex(d => d.dateStr === dateStr) + 5; // roughly 7 days accounting for weekends
        }
      }
    }
  });
  
  // Add break entries to jobs for display
  Object.entries(teamSchedules).forEach(([key, schedule]) => {
    const [dateStr, teamId] = key.split("_");
    const breakSlot = schedule.find(s => s.type === "break");
    if (breakSlot) {
      jobs.push({
        id: `break_${dateStr}_${teamId}`,
        date: dateStr,
        clientId: null,
        clientName: "🍴 Break",
        suburb: "",
        startTime: minsToTime(breakSlot.start),
        endTime: minsToTime(breakSlot.end),
        duration: breakDuration,
        status: "break",
        isDemo: true,
        isBreak: true,
      });
    }
  });
  
  return jobs;
}

// ─── Wipe all demo data ───
export function wipeDemoData() {
  const clients = loadScheduleClients().filter(c => !c.isDemo);
  const jobs = loadScheduledJobs().filter(j => !j.isDemo);
  saveScheduleClients(clients);
  saveScheduledJobs(jobs);
  return { clients, jobs };
}
