import React, { useState, useEffect, useRef, useCallback } from "react";
import { T, SERVICED_AREAS, loadPricing, savePricing, loadTemplates, saveTemplates, loadClients, saveClients, calcQuote, ICON_OPTIONS, loadScheduleSettings, saveScheduleSettings, loadScheduledJobs, saveScheduledJobs, loadScheduleClients, saveScheduleClients, calculateDuration, generateDemoClients, generateScheduleForClients, wipeDemoData, DEFAULT_SCHEDULE_SETTINGS, loadEmailHistory, saveEmailHistory, addEmailToHistory, getLastEmailForClient, daysSince, getFollowUpStatus, EMAIL_TEMPLATES, CUSTOM_EMAIL_STYLES, SUBURB_COORDS, getClientCoords, loadPayments, savePayments, addPayment, loadInvoices, saveInvoices, addInvoice, savePhoto, getPhotosForJob, getPhotosForDate, getAllPhotos, CLEANER_PIN } from "./shared";
import emailjs from '@emailjs/browser';

// ─── EmailJS Config ───
const EMAILJS_SERVICE_ID = "service_v0w9y88";
const EMAILJS_TEMPLATE_ID = "template_mbaynwc"; // Quote emails
const EMAILJS_UNIVERSAL_TEMPLATE_ID = "template_kgstqkg"; // All other emails
const EMAILJS_PUBLIC_KEY = "MZs9Wz8jaU2en7Pdd";

// ─── Google Maps Config ───
const GOOGLE_MAPS_API_KEY = "AIzaSyAI5KlcXZB9gs1u4Qb95SSsrQZM60aDuhI";

// ═══════════════════════════════════════════════════════════
// DUST BUNNIES CLEANING — Admin Dashboard (Mobile-Ready)
// ═══════════════════════════════════════════════════════════

// ─── Channel Icons ───
const ChannelIcon = ({ ch, size = 16 }) => {
  const colors = { messenger: "#0084FF", instagram: "#E1306C", email: "#5B9EC4" };
  const labels = { messenger: "M", instagram: "IG", email: "@" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 8, height: size + 8, borderRadius: 6, background: colors[ch] || "#999", color: "#fff", fontSize: size * 0.55, fontWeight: 800 }}>
      {labels[ch] || "?"}
    </span>
  );
};

// ─── Status Badge ───
const StatusBadge = ({ status }) => {
  const map = {
    new: { bg: "#E6F0F7", color: "#3B82A0", label: "New" },
    info_requested: { bg: "#FFF8E7", color: "#8B6914", label: "Info Requested" },
    info_received: { bg: "#E8F5EE", color: "#2D7A5E", label: "Info Received" },
    quote_ready: { bg: "#E8F5EE", color: "#2D7A5E", label: "Quote Ready" },
    quote_sent: { bg: T.primaryLight, color: T.primaryDark, label: "Quote Sent" },
    accepted: { bg: "#D4EDDA", color: "#155724", label: "Accepted ✓" },
    declined: { bg: "#FDF0EF", color: "#D4645C", label: "Declined" },
    out_of_area: { bg: "#FDF0EF", color: "#D4645C", label: "Out of Area" },
    pending_approval: { bg: "#FFF8E7", color: "#8B6914", label: "Pending Approval" },
    sent: { bg: T.primaryLight, color: T.primaryDark, label: "Sent" },
  };
  const s = map[status] || { bg: "#eee", color: "#666", label: status };
  return (
    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

// ─── Toast ───
function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.sidebar, color: "#fff", padding: "14px 24px", borderRadius: T.radius, boxShadow: T.shadowLg, fontSize: 14, fontWeight: 600, zIndex: 9999, animation: "slideUp 0.3s ease", maxWidth: "90vw", textAlign: "center" }}>
      {message}
    </div>
  );
}

// ─── Modal ───
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,58,45,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: "24px", maxWidth: wide ? 700 : 500, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: T.shadowLg }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.textMuted, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Search Input ───
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: T.textLight }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.text, outline: "none", boxSizing: "border-box" }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 14 }}>✕</button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [page, setPage] = useState("inbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [enquiries, setEnquiries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("db_enquiries") || "[]"); } catch { return []; }
  });
  const [quotes, setQuotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("db_quotes") || "[]"); } catch { return []; }
  });
  const [pricing, setPricing] = useState(loadPricing);
  const [templates, setTemplates] = useState(loadTemplates);
  const [clients, setClients] = useState(loadClients);
  
  // Scheduling state
  const [scheduleSettings, setScheduleSettings] = useState(loadScheduleSettings);
  const [scheduleClients, setScheduleClients] = useState(loadScheduleClients);
  const [scheduledJobs, setScheduledJobs] = useState(loadScheduledJobs);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(today.setDate(diff)).toISOString().split("T")[0];
  });
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editingScheduleClient, setEditingScheduleClient] = useState(null);
  const [demoMode, setDemoMode] = useState(() => {
    return loadScheduleClients().some(c => c.isDemo);
  });
  
  // Email Center state
  const [emailHistory, setEmailHistory] = useState(loadEmailHistory);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("follow_up");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [customEmailStyle, setCustomEmailStyle] = useState("announcement");
  const [customEmailContent, setCustomEmailContent] = useState({
    subject: "",
    headline: "",
    message: "",
    buttonText: "",
    buttonLink: "",
    showButton: false,
  });
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  
  // Tools/Maps state
  const [distanceFrom, setDistanceFrom] = useState("");
  const [distanceTo, setDistanceTo] = useState("");
  const [distanceResult, setDistanceResult] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [selectedRouteDate, setSelectedRouteDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [routeData, setRouteData] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [calendarTravelTimes, setCalendarTravelTimes] = useState({}); // { "date_teamId": [{ from, to, distance, duration }] }
  
  // Payments & Invoices state
  const [payments, setPayments] = useState(loadPayments);
  const [invoices, setInvoices] = useState(loadInvoices);
  const [showInvoiceModal, setShowInvoiceModal] = useState(null); // job to invoice
  const [paymentFilter, setPaymentFilter] = useState("unpaid");
  
  // Photos state
  const [photos, setPhotos] = useState([]);
  const [photoViewDate, setPhotoViewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  // Load photos on mount
  useEffect(() => {
    getAllPhotos().then(setPhotos).catch(console.error);
  }, []);
  
  const [filter, setFilter] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [editQuoteModal, setEditQuoteModal] = useState(null);
  const [editPriceModal, setEditPriceModal] = useState(null);
  const [addServiceModal, setAddServiceModal] = useState(false);
  const [addTemplateModal, setAddTemplateModal] = useState(false);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const quoteCounter = useRef(3);

  const showToast = useCallback((msg) => setToast(msg), []);

  // ─── Responsive listener ───
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ─── Close sidebar on page change (mobile) ───
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [page, isMobile]);

  // ─── On load: pick up any recent form submission ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem("db_form_submission");
      if (!raw) return;
      const data = JSON.parse(raw);
      const already = enquiries.some(e => e.details?.submittedAt === data.submittedAt && e.name === data.name);
      if (!already) {
        const enq = {
          id: Date.now(),
          name: data.name, channel: "email", suburb: data.suburb,
          message: `Form submitted: ${data.bedrooms} bed, ${data.bathrooms} bath, ${data.frequency} clean`,
          status: "info_received",
          timestamp: new Date().toISOString(),
          avatar: data.name.split(" ").map(n => n[0]).join(""),
          details: data, quoteId: null, archived: false,
        };
        setEnquiries(prev => [enq, ...prev]);
        
        // Also add to clients list
        const client = {
          id: Date.now(),
          name: data.name,
          email: data.email,
          phone: data.phone,
          suburb: data.suburb,
          createdAt: new Date().toISOString(),
          status: "lead",
        };
        setClients(prev => {
          const exists = prev.some(c => c.email === data.email);
          return exists ? prev : [client, ...prev];
        });
        
        showToast(`📋 New form submission from ${data.name}!`);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Cross-tab: listen for customer form submissions ───
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "db_form_submission") {
        try {
          const data = JSON.parse(e.newValue);
          const enq = {
            id: Date.now(),
            name: data.name, channel: "email", suburb: data.suburb,
            message: `Form submitted: ${data.bedrooms} bed, ${data.bathrooms} bath, ${data.frequency} clean`,
            status: "info_received",
            timestamp: new Date().toISOString(),
            avatar: data.name.split(" ").map(n => n[0]).join(""),
            details: data, quoteId: null, archived: false,
          };
          setEnquiries(prev => [enq, ...prev]);
          
          const client = {
            id: Date.now(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            suburb: data.suburb,
            createdAt: new Date().toISOString(),
            status: "lead",
          };
          setClients(prev => {
            const exists = prev.some(c => c.email === data.email);
            return exists ? prev : [client, ...prev];
          });
          
          showToast(`📋 New form submission from ${data.name}!`);
        } catch (_) {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [showToast]);

  // ─── Persist to localStorage ───
  useEffect(() => {
    try { localStorage.setItem("db_enquiries", JSON.stringify(enquiries)); } catch {}
  }, [enquiries]);

  useEffect(() => {
    try { localStorage.setItem("db_quotes", JSON.stringify(quotes)); } catch {}
  }, [quotes]);

  useEffect(() => {
    savePricing(pricing);
  }, [pricing]);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  useEffect(() => {
    saveClients(clients);
  }, [clients]);

  // Persist scheduling data
  useEffect(() => {
    saveScheduleSettings(scheduleSettings);
  }, [scheduleSettings]);

  useEffect(() => {
    saveScheduleClients(scheduleClients);
    setDemoMode(scheduleClients.some(c => c.isDemo));
  }, [scheduleClients]);

  useEffect(() => {
    saveScheduledJobs(scheduledJobs);
  }, [scheduledJobs]);

  useEffect(() => {
    saveEmailHistory(emailHistory);
  }, [emailHistory]);

  useEffect(() => {
    savePayments(payments);
  }, [payments]);

  useEffect(() => {
    saveInvoices(invoices);
  }, [invoices]);

  // ─── Actions ───
  const sendInfoForm = (enqId) => {
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "info_requested" } : e));
    showToast("📤 Info form link sent!");
  };

  const generateQuote = (enqId) => {
    const enq = enquiries.find(e => e.id === enqId);
    if (!enq || !enq.details) return;
    const qId = `Q${String(quoteCounter.current++).padStart(3, "0")}`;
    const q = {
      id: qId, enquiryId: enqId, name: enq.name, channel: enq.channel, suburb: enq.suburb,
      frequency: enq.details.frequency.charAt(0).toUpperCase() + enq.details.frequency.slice(1),
      status: "pending_approval", createdAt: new Date().toISOString(), details: { ...enq.details },
    };
    setQuotes(prev => [q, ...prev]);
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "quote_ready", quoteId: qId } : e));
    showToast(`💰 Quote ${qId} generated — review & approve`);
  };

  const approveQuote = (qId) => {
    // Open email preview modal instead of sending immediately
    const q = quotes.find(q => q.id === qId);
    if (q) {
      const enq = enquiries.find(e => e.id === q.enquiryId);
      setEmailPreview({ quote: q, enquiry: enq });
    }
  };

  const sendQuoteEmail = async () => {
    if (!emailPreview) return;
    
    const { quote, enquiry } = emailPreview;
    const calc = calcQuote(quote.details, pricing);
    
    // Build quote items string
    const quoteItems = calc.items.map(item => 
      `${item.description} × ${item.qty} — $${item.total.toFixed(2)}`
    ).join('<br>');
    
    const templateParams = {
      customer_name: quote.name.split(' ')[0],
      customer_email: enquiry?.details?.email || '',
      frequency: quote.frequency,
      frequency_lower: quote.frequency.toLowerCase(),
      suburb: quote.suburb,
      quote_items: quoteItems,
      total: calc.total.toFixed(2),
      discount: calc.discount > 0 ? calc.discount.toFixed(2) : '',
      to_email: enquiry?.details?.email || '',
    };
    
    setSendingEmail(true);
    
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      
      // Mark quote as sent with timestamp
      const now = new Date().toISOString();
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: "sent" } : q));
      setEnquiries(prev => prev.map(e => e.id === quote.enquiryId ? { ...e, status: "quote_sent", quoteSentAt: now } : e));
      
      // Add to email history
      addEmailToHistory({
        clientId: enquiry.id,
        recipientName: quote.name,
        recipientEmail: enquiry?.details?.email,
        templateType: "quote",
      });
      setEmailHistory(loadEmailHistory());
      
      setEmailPreview(null);
      showToast(`✅ Quote sent to ${enquiry?.details?.email}!`);
    } catch (error) {
      console.error('Email error:', error);
      showToast(`❌ Failed to send email. Please try again.`);
    } finally {
      setSendingEmail(false);
    }
  };

  const markAccepted = (qId) => {
    setQuotes(prev => prev.map(q => q.id === qId ? { ...q, status: "accepted" } : q));
    const q = quotes.find(q => q.id === qId);
    if (q) {
      setEnquiries(prev => prev.map(e => e.id === q.enquiryId ? { ...e, status: "accepted" } : e));
      setClients(prev => prev.map(c => c.name === q.name ? { ...c, status: "client" } : c));
    }
    showToast(`🎉 Quote accepted — new client!`);
  };

  const declineOutOfArea = (enqId) => {
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "out_of_area" } : e));
    showToast("📍 Out-of-area reply sent");
  };

  const archiveEnquiry = (enqId) => {
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, archived: true } : e));
    showToast("📦 Enquiry archived");
  };

  const unarchiveEnquiry = (enqId) => {
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, archived: false } : e));
    showToast("📤 Enquiry restored");
  };

  const removeEnquiry = (enqId) => {
    if (!window.confirm("Permanently delete this enquiry?")) return;
    setEnquiries(prev => prev.filter(e => e.id !== enqId));
    setQuotes(prev => prev.filter(q => q.enquiryId !== enqId));
    showToast("🗑️ Enquiry removed");
  };

  const addService = (service) => {
    const key = service.label.toLowerCase().replace(/\s+/g, "_");
    setPricing(prev => ({ ...prev, [key]: service }));
    setAddServiceModal(false);
    showToast(`✅ ${service.label} added`);
  };

  const removeService = (key) => {
    if (!window.confirm(`Remove ${pricing[key].label}? This cannot be undone.`)) return;
    setPricing(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    showToast(`🗑️ Service removed`);
  };

  const addTemplate = (template) => {
    const newTemplate = { ...template, id: Date.now().toString(), isDefault: false };
    setTemplates(prev => [...prev, newTemplate]);
    setAddTemplateModal(false);
    showToast(`✅ Template added`);
  };

  const removeTemplate = (id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    showToast(`🗑️ Template removed`);
  };

  const copyTemplate = (content) => {
    navigator.clipboard?.writeText(content);
    showToast("📋 Copied to clipboard!");
  };

  // ─── Calendar/Scheduling Functions ───
  const regenerateSchedule = (settingsToUse = scheduleSettings) => {
    const activeClients = scheduleClients.filter(c => c.status === "active");
    if (activeClients.length === 0) {
      showToast("⚠️ No active clients to schedule");
      return;
    }
    
    // Get current 2-week window
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    
    const twoWeeksLater = new Date(monday);
    twoWeeksLater.setDate(monday.getDate() + 13);
    
    // Regenerate jobs
    const newJobs = generateScheduleForClients(
      activeClients,
      monday.toISOString().split("T")[0],
      twoWeeksLater.toISOString().split("T")[0],
      settingsToUse
    );
    
    // Keep non-demo manual jobs, replace demo/generated jobs
    const manualJobs = scheduledJobs.filter(j => !j.isDemo && !j.isBreak);
    setScheduledJobs([...manualJobs, ...newJobs]);
    
    showToast(`✅ Regenerated schedule: ${newJobs.filter(j => !j.isBreak).length} jobs scheduled`);
  };

  const loadDemoData = () => {
    const demoClients = generateDemoClients(45);
    
    // Calculate durations and assign days based on suburb
    demoClients.forEach(c => {
      c.estimatedDuration = calculateDuration(c, scheduleSettings);
      
      // Assign preferred day based on suburb and area schedule
      const suburbLower = c.suburb.toLowerCase();
      for (const [day, suburbs] of Object.entries(scheduleSettings.areaSchedule)) {
        if (suburbs.some(s => s.toLowerCase() === suburbLower)) {
          c.preferredDay = day;
          break;
        }
      }
    });
    
    // Generate 2 weeks of schedules
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    
    const twoWeeksLater = new Date(monday);
    twoWeeksLater.setDate(monday.getDate() + 13);
    
    const demoJobs = generateScheduleForClients(
      demoClients, 
      monday.toISOString().split("T")[0],
      twoWeeksLater.toISOString().split("T")[0],
      scheduleSettings
    );
    
    setScheduleClients(prev => [...prev.filter(c => !c.isDemo), ...demoClients]);
    setScheduledJobs(prev => [...prev.filter(j => !j.isDemo), ...demoJobs]);
    showToast(`✅ Loaded ${demoClients.length} demo clients with ${demoJobs.filter(j => !j.isBreak).length} scheduled jobs`);
  };

  const wipeDemo = () => {
    if (!window.confirm("Remove all demo clients and their scheduled jobs? Real clients won't be affected.")) return;
    const { clients: remainingClients, jobs: remainingJobs } = wipeDemoData();
    setScheduleClients(remainingClients);
    setScheduledJobs(remainingJobs);
    showToast("🗑️ Demo data wiped");
  };

  const getWeekDates = (startDate) => {
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const navigateWeek = (direction) => {
    const current = new Date(calendarWeekStart);
    current.setDate(current.getDate() + (direction * 7));
    setCalendarWeekStart(current.toISOString().split("T")[0]);
  };

  const getJobsForDateAndTeam = (date, teamId) => {
    return scheduledJobs
      .filter(j => j.date === date && j.teamId === teamId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const updateJob = (jobId, updates) => {
    setScheduledJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
    setEditingJob(null);
    showToast("✅ Job updated");
  };

  const deleteJob = (jobId) => {
    if (!window.confirm("Delete this job?")) return;
    setScheduledJobs(prev => prev.filter(j => j.id !== jobId));
    setEditingJob(null);
    showToast("🗑️ Job deleted");
  };

  const addNewJob = (job) => {
    setScheduledJobs(prev => [...prev, { ...job, id: `job_${Date.now()}` }]);
    showToast("✅ Job added");
  };

  const updateScheduleClient = (clientId, updates) => {
    setScheduleClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c));
    setEditingScheduleClient(null);
    showToast("✅ Client updated");
  };

  const deleteScheduleClient = (clientId) => {
    if (!window.confirm("Delete this client and all their scheduled jobs?")) return;
    setScheduleClients(prev => prev.filter(c => c.id !== clientId));
    setScheduledJobs(prev => prev.filter(j => j.clientId !== clientId));
    setEditingScheduleClient(null);
    showToast("🗑️ Client deleted");
  };

  const weekDates = getWeekDates(calendarWeekStart);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  // ─── Email Center Functions ───
  const getFilteredEmailRecipients = useCallback(() => {
    // Combine enquiries and schedule clients to get all potential recipients
    const allRecipients = [];
    
    // Add enquiries with email
    enquiries.forEach(e => {
      if (e.details?.email && !e.archived) {
        allRecipients.push({
          id: e.id,
          name: e.name,
          email: e.details.email,
          type: e.status === "quote_sent" ? "quote_sent" : e.status === "accepted" ? "active" : "lead",
          quoteSentAt: e.quoteSentAt || (e.status === "quote_sent" ? e.timestamp : null),
          status: e.status,
        });
      }
    });
    
    // Add schedule clients with email (if not already in enquiries)
    scheduleClients.forEach(c => {
      if (c.email && !allRecipients.find(r => r.email === c.email)) {
        allRecipients.push({
          id: c.id,
          name: c.name,
          email: c.email,
          type: "active",
          quoteSentAt: null,
          status: "active",
        });
      }
    });
    
    // Apply filter
    switch (recipientFilter) {
      case "leads":
        return allRecipients.filter(r => r.type === "lead" || r.status === "new" || r.status === "info_received");
      case "quote_sent":
        return allRecipients.filter(r => r.type === "quote_sent" || r.status === "quote_sent");
      case "active":
        return allRecipients.filter(r => r.type === "active" || r.status === "accepted");
      default:
        return allRecipients;
    }
  }, [enquiries, scheduleClients, recipientFilter]);

  const handleBulkEmailSend = async () => {
    if (selectedRecipients.length === 0) return;
    
    const confirmed = window.confirm(`Send ${EMAIL_TEMPLATES[selectedEmailTemplate]?.name || "email"} to ${selectedRecipients.length} recipient${selectedRecipients.length > 1 ? "s" : ""}?`);
    if (!confirmed) return;
    
    setSendingBulkEmail(true);
    const recipients = getFilteredEmailRecipients().filter(r => selectedRecipients.includes(r.id));
    
    let successCount = 0;
    let failCount = 0;
    
    for (const recipient of recipients) {
      try {
        // Build template params based on template type
        const templateParams = buildEmailTemplateParams(recipient, selectedEmailTemplate, customEmailContent, customEmailStyle);
        
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          getEmailJSTemplateId(selectedEmailTemplate),
          templateParams,
          EMAILJS_PUBLIC_KEY
        );
        
        // Record in history
        addEmailToHistory({
          clientId: recipient.id,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          templateType: selectedEmailTemplate,
          customStyle: selectedEmailTemplate === "custom" ? customEmailStyle : null,
        });
        
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        failCount++;
      }
    }
    
    // Update local state
    setEmailHistory(loadEmailHistory());
    setSendingBulkEmail(false);
    setSelectedRecipients([]);
    
    if (failCount === 0) {
      showToast(`✅ Sent ${successCount} email${successCount > 1 ? "s" : ""} successfully!`);
    } else {
      showToast(`⚠️ Sent ${successCount}, failed ${failCount}`);
    }
  };

  const buildEmailTemplateParams = (recipient, templateType, customContent, customStyle) => {
    const firstName = recipient.name?.split(" ")[0] || "there";
    
    const baseParams = {
      to_email: recipient.email,
      customer_name: firstName,
      header_color: "#1B3A2D", // Default dark green
    };
    
    switch (templateType) {
      case "follow_up":
        return {
          ...baseParams,
          subject: "Just checking in! 🌿 — Dust Bunnies Cleaning",
          headline: "",
          message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just wanted to check in about the quote we sent through a few days ago. We'd love to help get your home sparkling clean!<br><br>If you have any questions at all, or if you'd like to make any changes to the quote, just reply to this email — we're always happy to chat.<br><br>Ready to book? Simply reply "Yes" and we'll get you scheduled! 💚`,
          show_button: "",
          button_text: "",
          button_link: "",
        };
      case "review_request":
        return {
          ...baseParams,
          subject: "Loved your clean? We'd love a review! ⭐",
          headline: "We'd Love Your Feedback! ⭐",
          message: `Hey <strong>${firstName}</strong>! 👋<br><br>We hope you've been enjoying your sparkling clean home! We absolutely loved working with you.<br><br>If you have a moment, we'd really appreciate a quick Google review. It helps other families find us and means the world to our small team!`,
          show_button: "true",
          button_text: "⭐ Leave a Review",
          button_link: "https://g.page/r/YOUR_GOOGLE_REVIEW_LINK",
        };
      case "booking_confirmation":
        return {
          ...baseParams,
          subject: "You're booked in! 🎉 — Dust Bunnies Cleaning",
          headline: "You're All Booked In! 🎉",
          message: `Hey <strong>${firstName}</strong>!<br><br>Great news — you're all booked in! We can't wait to make your home sparkle.<br><br>We'll send you a reminder the day before your first clean. If you need to reschedule at any time, just reply to this email!<br><br>See you soon! 💚`,
          show_button: "",
          button_text: "",
          button_link: "",
        };
      case "reminder":
        return {
          ...baseParams,
          subject: "See you tomorrow! 🌿 — Dust Bunnies Cleaning",
          headline: "See You Tomorrow! 🏠✨",
          message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just a friendly reminder that we'll be there <strong>tomorrow</strong> to give your home a beautiful clean!<br><br><strong>Quick tip:</strong> Clear surfaces where possible, and let us know if there's anything specific you'd like us to focus on!<br><br>See you tomorrow! 💚`,
          show_button: "",
          button_text: "",
          button_link: "",
        };
      case "custom":
        const style = CUSTOM_EMAIL_STYLES[customStyle];
        return {
          ...baseParams,
          subject: customContent.subject || "Message from Dust Bunnies Cleaning 🌿",
          headline: customContent.headline || "",
          message: (customContent.message || "").replace(/{NAME}/g, firstName).replace(/\n/g, "<br>"),
          show_button: customContent.showButton ? "true" : "",
          button_text: customContent.buttonText || "",
          button_link: customContent.buttonLink || "",
          header_color: style?.headerColor || "#1B3A2D",
        };
      default:
        return baseParams;
    }
  };

  const getEmailJSTemplateId = (templateType) => {
    // Use quote template for quotes, universal template for everything else
    if (templateType === "quote") {
      return EMAILJS_TEMPLATE_ID;
    }
    return EMAILJS_UNIVERSAL_TEMPLATE_ID;
  };

  // ─── Google Maps Functions ───
  
  // Load Google Maps Script
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }
    
    if (GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") {
      console.log("Google Maps API key not configured");
      return;
    }
    
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  const calculateDistanceBetween = async (fromClient, toClient) => {
    if (!mapsLoaded || !window.google?.maps) {
      // Fallback to straight-line distance
      const from = getClientCoords(fromClient);
      const to = getClientCoords(toClient);
      const distance = haversineDistance(from, to);
      const estimatedTime = Math.round(distance / 40 * 60); // Assume 40km/h average
      return {
        distance: distance.toFixed(1),
        duration: estimatedTime,
        durationText: `~${estimatedTime} mins`,
        distanceText: `${distance.toFixed(1)} km`,
        method: "estimate"
      };
    }
    
    return new Promise((resolve, reject) => {
      const service = new window.google.maps.DistanceMatrixService();
      
      const fromAddr = fromClient.address || `${fromClient.suburb}, QLD, Australia`;
      const toAddr = toClient.address || `${toClient.suburb}, QLD, Australia`;
      
      service.getDistanceMatrix({
        origins: [fromAddr],
        destinations: [toAddr],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      }, (response, status) => {
        if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
          const element = response.rows[0].elements[0];
          resolve({
            distance: (element.distance.value / 1000).toFixed(1),
            duration: Math.round(element.duration.value / 60),
            durationText: element.duration.text,
            distanceText: element.distance.text,
            method: "google"
          });
        } else {
          // Fallback to estimate
          const from = getClientCoords(fromClient);
          const to = getClientCoords(toClient);
          const distance = haversineDistance(from, to);
          const estimatedTime = Math.round(distance / 40 * 60);
          resolve({
            distance: distance.toFixed(1),
            duration: estimatedTime,
            durationText: `~${estimatedTime} mins`,
            distanceText: `${distance.toFixed(1)} km`,
            method: "estimate"
          });
        }
      });
    });
  };

  // Haversine formula for straight-line distance
  const haversineDistance = (coord1, coord2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1.3; // Multiply by 1.3 to approximate road distance
  };

  const handleDistanceCalculation = async () => {
    if (!distanceFrom || !distanceTo) return;
    
    const fromClient = scheduleClients.find(c => c.id === distanceFrom);
    const toClient = scheduleClients.find(c => c.id === distanceTo);
    
    if (!fromClient || !toClient) return;
    
    setCalculatingDistance(true);
    try {
      const result = await calculateDistanceBetween(fromClient, toClient);
      setDistanceResult({
        ...result,
        from: fromClient,
        to: toClient
      });
    } catch (error) {
      console.error("Distance calculation error:", error);
      showToast("❌ Failed to calculate distance");
    } finally {
      setCalculatingDistance(false);
    }
  };

  const calculateRouteForDate = async (date) => {
    const jobsOnDate = scheduledJobs.filter(j => j.date === date && !j.isBreak);
    
    const teamAJobs = jobsOnDate.filter(j => j.teamId === "team_a").sort((a, b) => a.startTime.localeCompare(b.startTime));
    const teamBJobs = jobsOnDate.filter(j => j.teamId === "team_b").sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    const calculateTeamRoute = async (jobs) => {
      if (jobs.length < 2) return { totalDistance: 0, totalDuration: 0, legs: [] };
      
      const legs = [];
      let totalDistance = 0;
      let totalDuration = 0;
      
      for (let i = 0; i < jobs.length - 1; i++) {
        const fromClient = scheduleClients.find(c => c.id === jobs[i].clientId);
        const toClient = scheduleClients.find(c => c.id === jobs[i + 1].clientId);
        
        if (fromClient && toClient) {
          const result = await calculateDistanceBetween(fromClient, toClient);
          legs.push({
            from: jobs[i],
            to: jobs[i + 1],
            ...result
          });
          totalDistance += parseFloat(result.distance);
          totalDuration += result.duration;
        }
      }
      
      return { totalDistance, totalDuration, legs, jobs };
    };
    
    const [teamARoute, teamBRoute] = await Promise.all([
      calculateTeamRoute(teamAJobs),
      calculateTeamRoute(teamBJobs)
    ]);
    
    setRouteData({
      date,
      teamA: teamARoute,
      teamB: teamBRoute
    });
  };

  // Initialize map for route visualization
  const initializeMap = useCallback(() => {
    if (!mapsLoaded || !mapRef.current || !window.google?.maps) return;
    
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: -26.6590, lng: 153.0800 }, // Sunshine Coast center
        zoom: 12,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }
    return mapInstanceRef.current;
  }, [mapsLoaded]);

  // Initialize map when Tools page is active and maps are loaded
  useEffect(() => {
    if (page === "tools" && mapsLoaded && mapRef.current) {
      setTimeout(() => {
        initializeMap();
      }, 100);
    }
  }, [page, mapsLoaded, initializeMap]);

  // Draw routes when routeData changes
  useEffect(() => {
    if (routeData && mapsLoaded && page === "tools") {
      setTimeout(() => {
        drawRouteOnMap();
      }, 200);
    }
  }, [routeData, mapsLoaded, page]);

  // Calculate travel times for calendar view
  const calculateCalendarTravelTimes = useCallback(async () => {
    if (!mapsLoaded || scheduledJobs.length === 0) return;
    
    const newTravelTimes = {};
    const dates = weekDates.slice(0, 5); // Mon-Fri
    
    for (const date of dates) {
      for (const team of scheduleSettings.teams) {
        const teamJobs = scheduledJobs
          .filter(j => j.date === date && j.teamId === team.id && !j.isBreak)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        if (teamJobs.length < 2) continue;
        
        const key = `${date}_${team.id}`;
        newTravelTimes[key] = [];
        
        for (let i = 0; i < teamJobs.length - 1; i++) {
          const fromClient = scheduleClients.find(c => c.id === teamJobs[i].clientId);
          const toClient = scheduleClients.find(c => c.id === teamJobs[i + 1].clientId);
          
          if (fromClient && toClient) {
            try {
              // Use Google Maps Distance Matrix directly here
              if (window.google?.maps) {
                const service = new window.google.maps.DistanceMatrixService();
                const fromAddr = fromClient.address || `${fromClient.suburb}, QLD, Australia`;
                const toAddr = toClient.address || `${toClient.suburb}, QLD, Australia`;
                
                const result = await new Promise((resolve) => {
                  service.getDistanceMatrix({
                    origins: [fromAddr],
                    destinations: [toAddr],
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    unitSystem: window.google.maps.UnitSystem.METRIC,
                  }, (response, status) => {
                    if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
                      const element = response.rows[0].elements[0];
                      resolve({
                        distance: (element.distance.value / 1000).toFixed(1),
                        duration: Math.round(element.duration.value / 60),
                      });
                    } else {
                      resolve({ distance: "?", duration: "?" });
                    }
                  });
                });
                
                newTravelTimes[key].push({
                  from: teamJobs[i].clientId,
                  to: teamJobs[i + 1].clientId,
                  ...result
                });
              }
            } catch (e) {
              newTravelTimes[key].push({ distance: "?", duration: "?" });
            }
          }
        }
      }
    }
    
    setCalendarTravelTimes(newTravelTimes);
    showToast("✅ Travel times calculated");
  }, [mapsLoaded, scheduledJobs, scheduleClients, scheduleSettings.teams, weekDates, showToast]);

  // Load travel times when viewing calendar - REMOVED auto calc to save API calls
  // User can click "Calc Travel" button manually

  const drawRouteOnMap = useCallback(async () => {
    if (!mapRef.current || !routeData || !window.google?.maps) return;
    
    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: -26.6590, lng: 153.0800 },
        zoom: 11,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }
    
    const map = mapInstanceRef.current;
    
    // Clear existing renderers
    if (window.directionsRenderers) {
      window.directionsRenderers.forEach(r => r.setMap(null));
    }
    window.directionsRenderers = [];
    
    const directionsService = new window.google.maps.DirectionsService();
    const bounds = new window.google.maps.LatLngBounds();
    
    const drawTeamRoute = (teamRoute, color, label) => {
      return new Promise((resolve) => {
        if (!teamRoute.jobs || teamRoute.jobs.length < 1) {
          resolve();
          return;
        }
        
        // If only one job, just add a marker
        if (teamRoute.jobs.length === 1) {
          const client = scheduleClients.find(c => c.id === teamRoute.jobs[0].clientId);
          const addr = client?.address || `${teamRoute.jobs[0].suburb}, QLD, Australia`;
          
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: addr }, (results, status) => {
            if (status === "OK" && results[0]) {
              const pos = results[0].geometry.location;
              new window.google.maps.Marker({
                position: pos,
                map,
                label: { text: "1", color: "#fff" },
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#fff",
                }
              });
              bounds.extend(pos);
              map.fitBounds(bounds);
            }
            resolve();
          });
          return;
        }
        
        const waypoints = teamRoute.jobs.slice(1, -1).map(job => {
          const client = scheduleClients.find(c => c.id === job.clientId);
          const addr = client?.address || `${job.suburb}, QLD, Australia`;
          return { location: addr, stopover: true };
        });
        
        const firstClient = scheduleClients.find(c => c.id === teamRoute.jobs[0].clientId);
        const lastClient = scheduleClients.find(c => c.id === teamRoute.jobs[teamRoute.jobs.length - 1].clientId);
        
        const origin = firstClient?.address || `${teamRoute.jobs[0].suburb}, QLD, Australia`;
        const destination = lastClient?.address || `${teamRoute.jobs[teamRoute.jobs.length - 1].suburb}, QLD, Australia`;
        
        directionsService.route({
          origin,
          destination,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        }, (result, status) => {
          if (status === "OK") {
            const renderer = new window.google.maps.DirectionsRenderer({
              map,
              directions: result,
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: color,
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
              markerOptions: {
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#fff",
                }
              }
            });
            window.directionsRenderers.push(renderer);
            
            // Extend bounds
            result.routes[0].legs.forEach(leg => {
              bounds.extend(leg.start_location);
              bounds.extend(leg.end_location);
            });
            map.fitBounds(bounds);
          }
          resolve();
        });
      });
    };
    
    // Draw both team routes
    const teamA = scheduleSettings.teams.find(t => t.id === "team_a");
    const teamB = scheduleSettings.teams.find(t => t.id === "team_b");
    
    await drawTeamRoute(routeData.teamA, teamA?.color || "#4A9E7E", "Team A");
    await drawTeamRoute(routeData.teamB, teamB?.color || "#5B9EC4", "Team B");
    
  }, [routeData, scheduleClients, scheduleSettings.teams]);

  // ─── Filtered Enquiries ───
  const filtered = enquiries.filter(e => {
    // First apply archive filter
    if (filter === "archived") return e.archived;
    if (filter !== "all" && e.archived) return false;
    
    // Then apply status filter
    if (filter === "active") return !e.archived;
    if (filter === "new") return e.status === "new";
    if (filter === "awaiting") return e.status === "info_requested";
    if (filter === "received") return e.status === "info_received";
    if (filter === "quote_ready") return e.status === "quote_ready";
    if (filter === "sent") return e.status === "quote_sent";
    if (filter === "accepted") return e.status === "accepted";
    if (filter === "out") return e.status === "out_of_area";
    return true;
  }).filter(e => {
    // Then apply search
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return e.name.toLowerCase().includes(term) || e.suburb.toLowerCase().includes(term) || e.message.toLowerCase().includes(term);
  });

  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const term = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term) || c.phone?.includes(term) || c.suburb?.toLowerCase().includes(term);
  });

  const pendingQuotes = quotes.filter(q => q.status === "pending_approval");
  const sentQuotes = quotes.filter(q => q.status === "sent" || q.status === "accepted");
  const archivedCount = enquiries.filter(e => e.archived).length;

  // ─── Sidebar Items ───
  // Calculate follow-ups needed (quotes sent 3+ days ago, not accepted/declined)
  const quotesNeedingFollowUp = enquiries.filter(e => {
    if (e.status !== "quote_sent") return false;
    const days = daysSince(e.quoteSentAt || e.timestamp);
    return days >= 3;
  });

  // Calculate unpaid jobs count
  const unpaidJobsCount = scheduledJobs.filter(j => j.status === "completed" && j.paymentStatus !== "paid").length;

  const navItems = [
    { id: "inbox", label: "Inbox", icon: "📥", badge: enquiries.filter(e => !e.archived && ["new", "info_received", "quote_ready"].includes(e.status)).length },
    { id: "quotes", label: "Quotes", icon: "💰", badge: pendingQuotes.length },
    { id: "calendar", label: "Calendar", icon: "📅", badge: 0 },
    { id: "payments", label: "Payments", icon: "💳", badge: unpaidJobsCount },
    { id: "photos", label: "Photos", icon: "📸", badge: 0 },
    { id: "emails", label: "Email Center", icon: "📧", badge: quotesNeedingFollowUp.length },
    { id: "tools", label: "Tools", icon: "🗺️", badge: 0 },
    { id: "clients", label: "Clients", icon: "👥", badge: clients.length },
    { id: "templates", label: "Templates", icon: "💬", badge: 0 },
    { id: "form", label: "Customer Form", icon: "📋", badge: 0 },
    { id: "pricing", label: "Pricing", icon: "⚙️", badge: 0 },
  ];

  const formUrl = typeof window !== "undefined" ? window.location.origin + "/form" : "/form";

  // ─── Time Ago ───
  const timeAgo = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");
  const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      {/* ═══ Mobile Header ═══ */}
      {isMobile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 60, background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 100 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", padding: 8 }}>
            {sidebarOpen ? "✕" : "☰"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌿</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Dust Bunnies</span>
          </div>
          <div style={{ width: 40 }} />
        </div>
      )}

      {/* ═══ Sidebar ═══ */}
      <div style={{
        width: isMobile ? "100%" : 240,
        maxWidth: isMobile ? 280 : 240,
        background: T.sidebar,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: isMobile ? 60 : 0,
        left: isMobile ? (sidebarOpen ? 0 : -300) : 0,
        height: isMobile ? "calc(100vh - 60px)" : "100vh",
        zIndex: 99,
        transition: "left 0.3s ease",
        boxShadow: isMobile && sidebarOpen ? "4px 0 20px rgba(0,0,0,0.3)" : "none",
      }}>
        {!isMobile && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🌿</div>
            <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0 }}>Dust Bunnies</h2>
            <p style={{ color: "#8FBFA8", fontSize: 11, margin: "2px 0 0" }}>Admin Dashboard</p>
          </div>
        )}

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: T.radiusSm,
              background: page === n.id ? "rgba(255,255,255,0.12)" : "transparent",
              border: "none", cursor: "pointer", color: page === n.id ? "#fff" : "#8FBFA8", fontSize: 14, fontWeight: 600,
              textAlign: "left", width: "100%", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.badge > 0 && (
                <span style={{ background: T.accent, color: T.sidebar, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{n.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ═══ Overlay for mobile ═══ */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 98 }} />
      )}

      {/* ═══ Main Content ═══ */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : 240,
        marginTop: isMobile ? 60 : 0,
        padding: isMobile ? 16 : 28,
        maxWidth: isMobile ? "100%" : 960,
        width: "100%",
        boxSizing: "border-box",
      }}>

        {/* ─── INBOX PAGE ─── */}
        {page === "inbox" && (
          <>
            {/* Follow-up Alert Banner */}
            {quotesNeedingFollowUp.length > 0 && (
              <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#8B6914" }}>
                      {quotesNeedingFollowUp.length} quote{quotesNeedingFollowUp.length > 1 ? "s" : ""} awaiting response
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      Oldest: {Math.max(...quotesNeedingFollowUp.map(e => daysSince(e.quoteSentAt || e.timestamp)))} days ago
                    </div>
                  </div>
                </div>
                <button onClick={() => setPage("emails")} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: "#8B6914", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  📧 Send Follow-ups
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Inbox</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{enquiries.filter(e => !e.archived).length} active · {archivedCount} archived</p>
              </div>
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search enquiries..." />
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { id: "active", label: "Active" }, { id: "new", label: "New" }, { id: "awaiting", label: "Awaiting" },
                { id: "received", label: "Received" }, { id: "quote_ready", label: "Quote Ready" },
                { id: "sent", label: "Sent" }, { id: "accepted", label: "Accepted" }, { id: "archived", label: `Archived (${archivedCount})` },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: "6px 12px", borderRadius: 20, border: filter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: filter === f.id ? T.primaryLight : "#fff", color: filter === f.id ? T.primaryDark : T.textMuted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Enquiry Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(e => {
                const followUp = e.status === "quote_sent" ? getFollowUpStatus(e.quoteSentAt || e.timestamp) : null;
                return (
                <div key={e.id} style={{
                  background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "18px 20px",
                  boxShadow: T.shadow,
                  borderLeft: e.archived ? `4px solid ${T.textLight}` : followUp?.level === "urgent" ? `4px solid ${T.danger}` : followUp?.level === "warning" ? `4px solid ${T.accent}` : e.status === "new" ? `4px solid ${T.blue}` : e.status === "info_received" ? `4px solid ${T.accent}` : "4px solid transparent",
                  opacity: e.archived ? 0.7 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? 10 : 14 }}>
                    {/* Avatar */}
                    <div style={{ width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: 12, background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: isMobile ? 12 : 14, flexShrink: 0 }}>
                      {e.avatar}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: T.text }}>{e.name}</span>
                        <ChannelIcon ch={e.channel} size={isMobile ? 12 : 14} />
                        <span style={{ fontSize: 11, color: T.textLight }}>📍 {e.suburb}</span>
                        <span style={{ fontSize: 11, color: T.textLight, marginLeft: "auto" }}>{timeAgo(e.timestamp)}</span>
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{e.message}</p>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <StatusBadge status={e.status} />
                        
                        {/* Follow-up Badge */}
                        {followUp && (
                          <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: followUp.level === "urgent" ? T.dangerLight : T.accentLight, color: followUp.color }}>
                            {followUp.label}
                          </span>
                        )}

                        {/* Contact Info Quick View */}
                        {e.details?.email && (
                          <span style={{ fontSize: 11, color: T.textMuted, display: isMobile ? "none" : "inline" }}>📧 {e.details.email}</span>
                        )}

                        {/* Action Buttons */}
                        {!e.archived && (
                          <>
                            {e.status === "new" && !SERVICED_AREAS.includes(e.suburb) && (
                              <button onClick={() => declineOutOfArea(e.id)} style={actionBtn("#FDF0EF", T.danger)}>📍 Out of Area</button>
                            )}
                            {e.status === "new" && SERVICED_AREAS.includes(e.suburb) && (
                              <button onClick={() => sendInfoForm(e.id)} style={actionBtn(T.blueLight, T.blue)}>📤 Send Form</button>
                            )}
                            {e.status === "info_received" && !e.quoteId && (
                              <button onClick={() => generateQuote(e.id)} style={actionBtn(T.primaryLight, T.primaryDark)}>💰 Quote</button>
                            )}
                            {e.status === "quote_ready" && (
                              <button onClick={() => setPage("quotes")} style={actionBtn(T.primaryLight, T.primaryDark)}>👁️ Review</button>
                            )}
                            {followUp && followUp.days >= 3 && (
                              <button onClick={() => { setPage("emails"); setSelectedRecipients([e.id]); }} style={actionBtn(T.accentLight, "#8B6914")}>📩 Follow-up</button>
                            )}
                            {e.details && (
                              <button onClick={() => setSelectedEnquiry(e)} style={actionBtn(T.borderLight, T.textMuted)}>📋 Details</button>
                            )}
                            <button onClick={() => archiveEnquiry(e.id)} style={actionBtn(T.borderLight, T.textMuted)}>📦</button>
                          </>
                        )}
                        {e.archived && (
                          <>
                            <button onClick={() => unarchiveEnquiry(e.id)} style={actionBtn(T.primaryLight, T.primaryDark)}>📤 Restore</button>
                            <button onClick={() => removeEnquiry(e.id)} style={actionBtn("#FDF0EF", T.danger)}>🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );})}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <p style={{ fontSize: 15 }}>{searchTerm ? "No results found" : "No enquiries match this filter"}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── QUOTES PAGE ─── */}
        {page === "quotes" && (
          <>
            <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Quotes</h1>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>{quotes.length} total quotes</p>

            {/* Pending Approval */}
            {pendingQuotes.length > 0 && (
              <>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>⏳ Pending Your Approval</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                  {pendingQuotes.map(q => {
                    const calc = calcQuote(q.details, pricing);
                    return (
                      <div key={q.id} style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "18px 16px" : "24px 28px", boxShadow: T.shadowMd, borderTop: `3px solid ${T.accent}` }}>
                        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 800, fontSize: 16, color: T.text }}>{q.name}</span>
                            <ChannelIcon ch={q.channel} />
                            <span style={{ fontSize: 12, color: T.textLight }}>📍 {q.suburb}</span>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 900, color: T.primary }}>${calc.total.toFixed(2)}</div>
                        </div>

                        {/* Line items */}
                        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 14, fontSize: 13 }}>
                          {calc.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: T.textMuted }}>
                              <span>{item.description} × {item.qty}</span>
                              <span style={{ fontWeight: 700, color: T.text }}>${item.total.toFixed(2)}</span>
                            </div>
                          ))}
                          {calc.discountLabel && (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: T.primaryDark, fontWeight: 700, borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8 }}>
                              <span>{calc.discountLabel}</span>
                              <span>-${calc.discount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
                          📅 {q.frequency} clean · Quote #{q.id}
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button onClick={() => setEditQuoteModal(q)} style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.textMuted }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => setPreviewQuote(q)} style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.primary }}>
                            👁️ Preview
                          </button>
                          <button onClick={() => approveQuote(q.id)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 2px 8px rgba(74,158,126,0.3)" }}>
                            ✅ Approve & Send
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Sent / Accepted Quotes */}
            {sentQuotes.length > 0 && (
              <>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Sent & Accepted</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sentQuotes.map(q => {
                    const calc = calcQuote(q.details, pricing);
                    return (
                      <div key={q.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "16px 20px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <ChannelIcon ch={q.channel} size={14} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.text, minWidth: isMobile ? "auto" : 130 }}>{q.name}</span>
                        {!isMobile && <span style={{ fontSize: 12, color: T.textLight }}>📍 {q.suburb}</span>}
                        <span style={{ fontSize: 12, color: T.textMuted }}>{q.frequency}</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color: T.primary, marginLeft: "auto" }}>${calc.total.toFixed(2)}</span>
                        <StatusBadge status={q.status} />
                        {q.status === "sent" && (
                          <button onClick={() => markAccepted(q.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#D4EDDA", color: "#155724", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            ✓ Accepted
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {quotes.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                <p>No quotes yet — they'll appear when you generate them from the inbox</p>
              </div>
            )}
          </>
        )}

        {/* ─── EMAIL CENTER PAGE ─── */}
        {page === "emails" && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Email Center</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  Send emails to clients · {emailHistory.length} emails sent
                </p>
              </div>
            </div>

            {/* Follow-up Alert */}
            {quotesNeedingFollowUp.length > 0 && selectedEmailTemplate !== "follow_up" && (
              <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <span>⚠️</span>
                <span style={{ fontSize: 13, color: "#8B6914" }}>
                  <strong>{quotesNeedingFollowUp.length}</strong> clients need follow-up
                </span>
                <button onClick={() => setSelectedEmailTemplate("follow_up")} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 6, border: "none", background: "#8B6914", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  View
                </button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", gap: 20 }}>
              
              {/* Left Panel - Template & Recipients */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Template Selector */}
                <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Email Template</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.values(EMAIL_TEMPLATES).filter(t => t.id !== "quote").map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedEmailTemplate(tmpl.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: T.radiusSm,
                          border: selectedEmailTemplate === tmpl.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                          background: selectedEmailTemplate === tmpl.id ? T.primaryLight : "#fff",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: selectedEmailTemplate === tmpl.id ? T.primaryDark : T.text }}>{tmpl.name}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{tmpl.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Email Style Selector (only for custom template) */}
                {selectedEmailTemplate === "custom" && (
                  <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Email Style</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {Object.values(CUSTOM_EMAIL_STYLES).map(style => (
                        <button
                          key={style.id}
                          onClick={() => setCustomEmailStyle(style.id)}
                          style={{
                            padding: "10px",
                            borderRadius: T.radiusSm,
                            border: customEmailStyle === style.id ? `2px solid ${style.headerColor}` : `1.5px solid ${T.border}`,
                            background: customEmailStyle === style.id ? style.accentColor : "#fff",
                            textAlign: "center",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{style.icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{style.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient Filter */}
                <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Filter Recipients</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { id: "all", label: "All" },
                      { id: "leads", label: "Leads" },
                      { id: "quote_sent", label: "Quote Sent" },
                      { id: "active", label: "Active Clients" },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setRecipientFilter(f.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          border: recipientFilter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                          background: recipientFilter === f.id ? T.primaryLight : "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          color: recipientFilter === f.id ? T.primaryDark : T.textMuted,
                          cursor: "pointer",
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipients List */}
                <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow, flex: 1, minHeight: 200, maxHeight: 400, overflow: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>
                      Recipients ({selectedRecipients.length} selected)
                    </label>
                    <button
                      onClick={() => {
                        const filteredIds = getFilteredEmailRecipients().map(r => r.id);
                        setSelectedRecipients(prev => 
                          prev.length === filteredIds.length ? [] : filteredIds
                        );
                      }}
                      style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                    >
                      {selectedRecipients.length === getFilteredEmailRecipients().length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {getFilteredEmailRecipients().map(recipient => {
                      const isSelected = selectedRecipients.includes(recipient.id);
                      const lastEmail = getLastEmailForClient(recipient.id);
                      const followUp = recipient.quoteSentAt ? getFollowUpStatus(recipient.quoteSentAt) : null;
                      
                      return (
                        <div
                          key={recipient.id}
                          onClick={() => setSelectedRecipients(prev => 
                            isSelected ? prev.filter(id => id !== recipient.id) : [...prev, recipient.id]
                          )}
                          style={{
                            padding: "10px 12px",
                            borderRadius: T.radiusSm,
                            border: isSelected ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                            background: isSelected ? T.primaryLight : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 4,
                              border: isSelected ? "none" : `2px solid ${T.border}`,
                              background: isSelected ? T.primary : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#fff", fontSize: 12,
                            }}>
                              {isSelected && "✓"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{recipient.name}</div>
                              <div style={{ fontSize: 11, color: T.textMuted }}>{recipient.email || "No email"}</div>
                            </div>
                            {followUp && followUp.days >= 3 && (
                              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: followUp.level === "urgent" ? T.dangerLight : T.accentLight, color: followUp.color }}>
                                {followUp.days}d
                              </span>
                            )}
                          </div>
                          {lastEmail && (
                            <div style={{ fontSize: 10, color: T.textLight, marginTop: 4, marginLeft: 26 }}>
                              Last: {EMAIL_TEMPLATES[lastEmail.templateType]?.name || "Email"} · {daysSince(lastEmail.sentAt)}d ago
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {getFilteredEmailRecipients().length === 0 && (
                      <div style={{ textAlign: "center", padding: 20, color: T.textLight, fontSize: 13 }}>
                        No recipients match this filter
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Panel - Email Content & Preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Custom Email Builder (only for custom template) */}
                {selectedEmailTemplate === "custom" && (
                  <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 16 }}>Compose Email</label>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Subject Line</label>
                        <input
                          type="text"
                          value={customEmailContent.subject}
                          onChange={e => setCustomEmailContent(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="e.g. Exciting News from Dust Bunnies! 🌿"
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Headline</label>
                        <input
                          type="text"
                          value={customEmailContent.headline}
                          onChange={e => setCustomEmailContent(prev => ({ ...prev, headline: e.target.value }))}
                          placeholder="e.g. We're Expanding Our Services!"
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Message (use {"{NAME}"} for personalization)</label>
                        <textarea
                          value={customEmailContent.message}
                          onChange={e => setCustomEmailContent(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Hey {NAME}!&#10;&#10;We're thrilled to announce..."
                          rows={5}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical", lineHeight: 1.6 }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={customEmailContent.showButton}
                          onChange={e => setCustomEmailContent(prev => ({ ...prev, showButton: e.target.checked }))}
                          style={{ width: 18, height: 18 }}
                        />
                        <span style={{ fontSize: 13, color: T.text }}>Add call-to-action button</span>
                      </div>
                      
                      {customEmailContent.showButton && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingLeft: 28 }}>
                          <div>
                            <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Button Text</label>
                            <input
                              type="text"
                              value={customEmailContent.buttonText}
                              onChange={e => setCustomEmailContent(prev => ({ ...prev, buttonText: e.target.value }))}
                              placeholder="Learn More"
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Button Link</label>
                            <input
                              type="text"
                              value={customEmailContent.buttonLink}
                              onChange={e => setCustomEmailContent(prev => ({ ...prev, buttonLink: e.target.value }))}
                              placeholder="https://..."
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Email Preview */}
                <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Email Preview</label>
                    <span style={{ fontSize: 11, color: T.textLight }}>Showing preview for "{selectedRecipients.length > 0 ? getFilteredEmailRecipients().find(r => r.id === selectedRecipients[0])?.name || "Client" : "Client"}"</span>
                  </div>
                  
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <EmailPreviewComponent
                      templateType={selectedEmailTemplate}
                      customStyle={customEmailStyle}
                      customContent={customEmailContent}
                      recipientName={selectedRecipients.length > 0 ? getFilteredEmailRecipients().find(r => r.id === selectedRecipients[0])?.name?.split(" ")[0] || "there" : "there"}
                    />
                  </div>
                </div>

                {/* Send Button */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setShowEmailPreview(true)}
                    disabled={selectedRecipients.length === 0}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: T.radiusSm,
                      border: `1.5px solid ${T.border}`,
                      background: "#fff",
                      color: selectedRecipients.length === 0 ? T.textLight : T.textMuted,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: selectedRecipients.length === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    👁️ Full Preview
                  </button>
                  <button
                    onClick={handleBulkEmailSend}
                    disabled={selectedRecipients.length === 0 || sendingBulkEmail}
                    style={{
                      flex: 2,
                      padding: "14px",
                      borderRadius: T.radiusSm,
                      border: "none",
                      background: selectedRecipients.length === 0 || sendingBulkEmail ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.blue})`,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: selectedRecipients.length === 0 || sendingBulkEmail ? "not-allowed" : "pointer",
                      boxShadow: selectedRecipients.length > 0 && !sendingBulkEmail ? "0 4px 12px rgba(74,158,126,0.3)" : "none",
                    }}
                  >
                    {sendingBulkEmail ? "Sending..." : `📧 Send to ${selectedRecipients.length} Recipient${selectedRecipients.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Email History */}
            <div style={{ marginTop: 32 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: T.text }}>Recent Emails Sent</h3>
              {emailHistory.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: T.radius, padding: "40px", textAlign: "center", color: T.textLight }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
                  <p>No emails sent yet</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {emailHistory.slice(0, 10).map(email => (
                    <div key={email.id} style={{ background: "#fff", borderRadius: T.radiusSm, padding: "12px 16px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{EMAIL_TEMPLATES[email.templateType]?.icon || "📧"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{email.recipientName}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{EMAIL_TEMPLATES[email.templateType]?.name || "Email"}</div>
                      </div>
                      <div style={{ fontSize: 11, color: T.textLight }}>{daysSince(email.sentAt) === 0 ? "Today" : `${daysSince(email.sentAt)}d ago`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── PAYMENTS PAGE ─── */}
        {page === "payments" && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Payments</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  Track payments & generate invoices
                </p>
              </div>
            </div>

            {/* Payment Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {(() => {
                const completedJobs = scheduledJobs.filter(j => j.status === "completed");
                const unpaidJobs = completedJobs.filter(j => j.paymentStatus !== "paid");
                const paidJobs = completedJobs.filter(j => j.paymentStatus === "paid");
                const totalEarned = paidJobs.reduce((sum, j) => sum + (j.price || 0), 0);
                const totalOwed = unpaidJobs.reduce((sum, j) => sum + (j.price || 0), 0);
                
                return (
                  <>
                    <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Total Earned</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: T.primary }}>${totalEarned.toFixed(0)}</div>
                      <div style={{ fontSize: 11, color: T.textLight }}>{paidJobs.length} paid jobs</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Outstanding</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: totalOwed > 0 ? T.danger : T.text }}>${totalOwed.toFixed(0)}</div>
                      <div style={{ fontSize: 11, color: T.textLight }}>{unpaidJobs.length} unpaid jobs</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Invoices Sent</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: T.blue }}>{invoices.length}</div>
                      <div style={{ fontSize: 11, color: T.textLight }}>{invoices.filter(i => i.status === "paid").length} paid</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>This Month</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: T.text }}>
                        ${paidJobs.filter(j => {
                          const jobDate = new Date(j.date);
                          const now = new Date();
                          return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
                        }).reduce((sum, j) => sum + (j.price || 0), 0).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 11, color: T.textLight }}>collected</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[
                { id: "unpaid", label: "Unpaid" },
                { id: "paid", label: "Paid" },
                { id: "all", label: "All Jobs" },
                { id: "invoices", label: "Invoices" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setPaymentFilter(f.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: paymentFilter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                    background: paymentFilter === f.id ? T.primaryLight : "#fff",
                    color: paymentFilter === f.id ? T.primaryDark : T.textMuted,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Jobs List or Invoices List */}
            {paymentFilter === "invoices" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {invoices.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", color: T.textLight }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                    <p>No invoices yet</p>
                  </div>
                ) : (
                  invoices.map(inv => (
                    <div key={inv.id} style={{ background: "#fff", borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: T.radiusSm, background: inv.status === "paid" ? T.primaryLight : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                        🧾
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{inv.invoiceNumber}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>{inv.clientName} · {new Date(inv.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>${inv.amount?.toFixed(2)}</div>
                        <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: inv.status === "paid" ? T.primaryLight : T.accentLight, color: inv.status === "paid" ? T.primaryDark : "#8B6914" }}>
                          {inv.status === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      {inv.status !== "paid" && (
                        <button
                          onClick={() => {
                            setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "paid", paidAt: new Date().toISOString() } : i));
                            showToast("✅ Invoice marked as paid");
                          }}
                          style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(() => {
                  const completedJobs = scheduledJobs.filter(j => j.status === "completed");
                  const filteredJobs = paymentFilter === "unpaid" 
                    ? completedJobs.filter(j => j.paymentStatus !== "paid")
                    : paymentFilter === "paid"
                    ? completedJobs.filter(j => j.paymentStatus === "paid")
                    : completedJobs;
                  
                  if (filteredJobs.length === 0) {
                    return (
                      <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", color: T.textLight }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                        <p>No {paymentFilter} jobs</p>
                      </div>
                    );
                  }
                  
                  return filteredJobs.sort((a, b) => b.date.localeCompare(a.date)).map(job => {
                    const client = scheduleClients.find(c => c.id === job.clientId);
                    const isPaid = job.paymentStatus === "paid";
                    
                    return (
                      <div key={job.id} style={{ background: "#fff", borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow, borderLeft: `4px solid ${isPaid ? T.primary : T.accent}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{job.clientName}</span>
                              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: isPaid ? T.primaryLight : T.accentLight, color: isPaid ? T.primaryDark : "#8B6914" }}>
                                {isPaid ? "Paid" : "Unpaid"}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: T.textMuted }}>
                              📅 {new Date(job.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                              <span style={{ margin: "0 8px" }}>·</span>
                              📍 {job.suburb}
                              <span style={{ margin: "0 8px" }}>·</span>
                              ⏱️ {job.duration} mins
                            </div>
                            {client?.email && (
                              <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>📧 {client.email}</div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", marginRight: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 20, color: T.text }}>${job.price?.toFixed(2) || "—"}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {!isPaid && (
                              <>
                                <button
                                  onClick={() => {
                                    setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, paymentStatus: "paid", paidAt: new Date().toISOString() } : j));
                                    showToast("✅ Marked as paid");
                                  }}
                                  style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                                >
                                  💳 Mark Paid
                                </button>
                                <button
                                  onClick={() => setShowInvoiceModal(job)}
                                  style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                                >
                                  🧾 Invoice
                                </button>
                              </>
                            )}
                            {isPaid && (
                              <button
                                onClick={() => {
                                  setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, paymentStatus: "unpaid", paidAt: null } : j));
                                  showToast("Marked as unpaid");
                                }}
                                style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </>
        )}

        {/* ─── PHOTOS PAGE ─── */}
        {page === "photos" && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Job Photos</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  Before & after photos from your cleaning teams
                </p>
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
            {(() => {
              const datePhotos = photos.filter(p => p.date === photoViewDate);
              const jobsWithPhotos = [...new Set(datePhotos.map(p => p.jobId))];
              
              if (datePhotos.length === 0) {
                return (
                  <div style={{ background: "#fff", borderRadius: T.radius, padding: 60, textAlign: "center", color: T.textLight }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
                    <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16 }}>No photos for this date</p>
                    <p style={{ margin: 0, fontSize: 13 }}>Photos uploaded by cleaners will appear here</p>
                  </div>
                );
              }
              
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {jobsWithPhotos.map(jobId => {
                    const job = scheduledJobs.find(j => j.id === jobId);
                    const jobPhotos = datePhotos.filter(p => p.jobId === jobId);
                    const beforePhoto = jobPhotos.find(p => p.type === "before");
                    const afterPhoto = jobPhotos.find(p => p.type === "after");
                    const team = scheduleSettings.teams.find(t => t.id === job?.teamId);
                    
                    return (
                      <div key={jobId} style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: team?.color || T.primary }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{job?.clientName || "Unknown Job"}</div>
                              <div style={{ fontSize: 12, color: T.textMuted }}>{job?.suburb} · {team?.name}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: T.textLight }}>
                            {job?.startTime} - {job?.endTime}
                          </div>
                        </div>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          {/* Before Photo */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Before</div>
                            {beforePhoto ? (
                              <div
                                onClick={() => setSelectedPhoto(beforePhoto)}
                                style={{ cursor: "pointer", borderRadius: T.radiusSm, overflow: "hidden", aspectRatio: "4/3", background: T.bg }}
                              >
                                <img src={beforePhoto.data} alt="Before" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ) : (
                              <div style={{ aspectRatio: "4/3", background: T.bg, borderRadius: T.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight }}>
                                No photo
                              </div>
                            )}
                          </div>
                          
                          {/* After Photo */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>After</div>
                            {afterPhoto ? (
                              <div
                                onClick={() => setSelectedPhoto(afterPhoto)}
                                style={{ cursor: "pointer", borderRadius: T.radiusSm, overflow: "hidden", aspectRatio: "4/3", background: T.bg }}
                              >
                                <img src={afterPhoto.data} alt="After" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            ) : (
                              <div style={{ aspectRatio: "4/3", background: T.bg, borderRadius: T.radiusSm, display: "flex", alignItems: "center", justifyContent: "center", color: T.textLight }}>
                                No photo
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>
                          Uploaded: {jobPhotos[0] && new Date(jobPhotos[0].uploadedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Photo Lightbox Modal */}
            {selectedPhoto && (
              <div
                onClick={() => setSelectedPhoto(null)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  padding: 20,
                }}
              >
                <img
                  src={selectedPhoto.data}
                  alt={selectedPhoto.type}
                  style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: T.radius }}
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: "none",
                    background: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── TOOLS PAGE ─── */}
        {page === "tools" && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Tools</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  Distance calculator & route planning
                </p>
              </div>
              {!mapsLoaded && GOOGLE_MAPS_API_KEY !== "YOUR_API_KEY_HERE" && (
                <div style={{ padding: "8px 16px", background: T.accentLight, borderRadius: T.radiusSm, fontSize: 12, color: "#8B6914" }}>
                  Loading Maps...
                </div>
              )}
              {GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE" && (
                <div style={{ padding: "8px 16px", background: T.dangerLight, borderRadius: T.radiusSm, fontSize: 12, color: T.danger }}>
                  ⚠️ Add Google Maps API key to enable
                </div>
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
                    <select
                      value={distanceFrom}
                      onChange={e => setDistanceFrom(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
                    >
                      <option value="">Select client...</option>
                      {scheduleClients.filter(c => c.status === "active").map(c => (
                        <option key={c.id} value={c.id}>{c.name} — {c.suburb}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      onClick={() => {
                        const temp = distanceFrom;
                        setDistanceFrom(distanceTo);
                        setDistanceTo(temp);
                      }}
                      style={{ padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, cursor: "pointer", color: T.textMuted }}
                    >
                      ↕️ Swap
                    </button>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TO</label>
                    <select
                      value={distanceTo}
                      onChange={e => setDistanceTo(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
                    >
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
                      padding: "14px",
                      borderRadius: T.radiusSm,
                      border: "none",
                      background: (!distanceFrom || !distanceTo || calculatingDistance) ? T.border : T.primary,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: (!distanceFrom || !distanceTo || calculatingDistance) ? "not-allowed" : "pointer",
                    }}
                  >
                    {calculatingDistance ? "Calculating..." : "📍 Calculate Distance"}
                  </button>
                </div>
                
                {/* Result */}
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
                      <div style={{ marginTop: 12, fontSize: 11, color: T.textLight }}>
                        ℹ️ Estimated based on suburb locations
                      </div>
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
                  <div style={{ textAlign: "center", padding: 20, color: T.textLight }}>
                    No active clients yet
                  </div>
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
                  <input
                    type="date"
                    value={selectedRouteDate}
                    onChange={e => setSelectedRouteDate(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
                  />
                  <button
                    onClick={() => calculateRouteForDate(selectedRouteDate)}
                    style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Load Routes
                  </button>
                </div>
              </div>
              
              {/* Route Summary Cards */}
              {routeData && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  {/* Team A Summary */}
                  <div style={{ padding: "16px 20px", background: `${scheduleSettings.teams[0]?.color}15`, borderRadius: T.radius, borderLeft: `4px solid ${scheduleSettings.teams[0]?.color}` }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>
                      {scheduleSettings.teams[0]?.name || "Team A"}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                      <span style={{ color: T.textMuted }}>
                        🚗 <strong style={{ color: T.text }}>{routeData.teamA.totalDistance.toFixed(1)} km</strong>
                      </span>
                      <span style={{ color: T.textMuted }}>
                        ⏱️ <strong style={{ color: T.text }}>{routeData.teamA.totalDuration} mins</strong>
                      </span>
                      <span style={{ color: T.textMuted }}>
                        📍 <strong style={{ color: T.text }}>{routeData.teamA.jobs?.length || 0} stops</strong>
                      </span>
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
                  
                  {/* Team B Summary */}
                  <div style={{ padding: "16px 20px", background: `${scheduleSettings.teams[1]?.color}15`, borderRadius: T.radius, borderLeft: `4px solid ${scheduleSettings.teams[1]?.color}` }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 8 }}>
                      {scheduleSettings.teams[1]?.name || "Team B"}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                      <span style={{ color: T.textMuted }}>
                        🚗 <strong style={{ color: T.text }}>{routeData.teamB.totalDistance.toFixed(1)} km</strong>
                      </span>
                      <span style={{ color: T.textMuted }}>
                        ⏱️ <strong style={{ color: T.text }}>{routeData.teamB.totalDuration} mins</strong>
                      </span>
                      <span style={{ color: T.textMuted }}>
                        📍 <strong style={{ color: T.text }}>{routeData.teamB.jobs?.length || 0} stops</strong>
                      </span>
                    </div>
                    {routeData.teamB.legs?.length > 0 && (
                      <div style={{ marginTop: 12, fontSize: 12 }}>
                        {routeData.teamB.legs.map((leg, i) => (
                          <div key={i} style={{ padding: "6px 0", borderBottom: i < routeData.teamB.legs.length - 1 ? `1px solid ${T.border}` : "none" }}>
                            <span style={{ color: T.text }}>{leg.from.clientName}</span>
                            <span style={{ color: T.textLight }}> → </span>
                            <span style={{ color: T.text }}>{leg.to.clientName}</span>
                            <span style={{ color: T.textMuted, marginLeft: 8 }}>{leg.distanceText} · {leg.durationText}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Map Container */}
              <div
                ref={mapRef}
                style={{
                  width: "100%",
                  height: 400,
                  borderRadius: T.radius,
                  background: T.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!mapsLoaded && (
                  <div style={{ textAlign: "center", color: T.textMuted }}>
                    {GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE" ? (
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
              
              {/* Map Legend */}
              {mapsLoaded && routeData && (
                <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 4, borderRadius: 2, background: scheduleSettings.teams[0]?.color }} />
                    <span style={{ fontSize: 12, color: T.textMuted }}>{scheduleSettings.teams[0]?.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 4, borderRadius: 2, background: scheduleSettings.teams[1]?.color }} />
                    <span style={{ fontSize: 12, color: T.textMuted }}>{scheduleSettings.teams[1]?.name}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── CALENDAR PAGE ─── */}
        {page === "calendar" && (
          <>
            {/* Header with Demo Controls */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Calendar</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
                  {scheduleClients.filter(c => c.status === "active").length} active clients · {scheduledJobs.length} scheduled jobs
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {scheduleClients.length > 0 && (
                  <button onClick={() => regenerateSchedule()} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.blue}`, background: T.blueLight, fontSize: 12, fontWeight: 700, color: T.blue, cursor: "pointer" }}>
                    🔄 Regenerate
                  </button>
                )}
                {mapsLoaded && scheduledJobs.length > 0 && (
                  <button onClick={() => calculateCalendarTravelTimes()} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: T.primaryLight, fontSize: 12, fontWeight: 700, color: T.primaryDark, cursor: "pointer" }}>
                    🚗 Calc Travel
                  </button>
                )}
                <button onClick={() => setShowScheduleSettings(true)} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
                  ⚙️ Settings
                </button>
                <button onClick={() => setEditingScheduleClient({})} style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: "none", background: T.primary, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                  + Add Client
                </button>
              </div>
            </div>

            {/* Demo Mode Controls */}
            <div style={{ background: demoMode ? T.accentLight : T.blueLight, borderRadius: T.radius, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🧪</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: demoMode ? "#8B6914" : T.blue }}>
                    {demoMode ? "Demo Mode Active" : "Demo Mode"}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    {demoMode ? `${scheduleClients.filter(c => c.isDemo).length} demo clients loaded` : "Load sample data to test the calendar"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!demoMode ? (
                  <button onClick={loadDemoData} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.blue, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Load 45 Demo Clients
                  </button>
                ) : (
                  <button onClick={wipeDemo} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: T.danger, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ⚠️ Wipe Demo Data
                  </button>
                )}
              </div>
            </div>

            {/* Week Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => navigateWeek(-1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
                ← Prev Week
              </button>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>
                {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
              </div>
              <button onClick={() => navigateWeek(1)} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
                Next Week →
              </button>
            </div>

            {/* Team Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              {scheduleSettings.teams.map(team => (
                <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: team.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{team.name}</span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    ({scheduledJobs.filter(j => j.teamId === team.id && weekDates.includes(j.date)).length} jobs this week)
                  </span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(5, minmax(140px, 1fr))" : "repeat(5, 1fr)", gap: 12, minWidth: isMobile ? 700 : "auto" }}>
                {weekDates.slice(0, 5).map((date, i) => {
                  const isToday = date === new Date().toISOString().split("T")[0];
                  const areaForDay = scheduleSettings.areaSchedule[dayNames[i].toLowerCase()] || [];
                  
                  return (
                    <div key={date} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: isToday ? `2px solid ${T.primary}` : "none" }}>
                      {/* Day Header */}
                      <div style={{ background: isToday ? T.primary : T.sidebar, padding: "12px 14px", color: "#fff" }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{dayNames[i]}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{formatDate(date)}</div>
                        {areaForDay.length > 0 && (
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>📍 {areaForDay.join(", ")}</div>
                        )}
                      </div>
                      
                      {/* Teams */}
                      <div style={{ padding: "12px" }}>
                        {scheduleSettings.teams.map(team => {
                          const teamJobs = getJobsForDateAndTeam(date, team.id);
                          return (
                            <div key={team.id} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: team.color, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: team.color }} />
                                {team.name} ({teamJobs.length}/{scheduleSettings.jobsPerTeamPerDay})
                              </div>
                              
                              {teamJobs.length === 0 ? (
                                <div style={{ padding: "8px 10px", background: T.bg, borderRadius: 6, fontSize: 11, color: T.textLight, textAlign: "center" }}>
                                  No jobs
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                                  {teamJobs.map((job, jobIndex) => {
                                    // Get travel info to next job
                                    const nextJob = teamJobs[jobIndex + 1];
                                    const travelKey = `${date}_${team.id}`;
                                    const travelData = calendarTravelTimes[travelKey]?.[jobIndex];
                                    
                                    return (
                                      <React.Fragment key={job.id}>
                                        <div
                                          onClick={() => !job.isBreak && setEditingJob(job)}
                                          style={{
                                            padding: "8px 10px",
                                            background: job.isBreak 
                                              ? T.accentLight 
                                              : job.status === "completed" 
                                                ? "#D4EDDA" 
                                                : `${team.color}15`,
                                            borderLeft: job.isBreak 
                                              ? `3px solid ${T.accent}` 
                                              : `3px solid ${team.color}`,
                                            borderRadius: "0 6px 6px 0",
                                            cursor: job.isBreak ? "default" : "pointer",
                                            transition: "all 0.15s",
                                          }}
                                        >
                                          <div style={{ fontWeight: 700, fontSize: 12, color: job.isBreak ? "#8B6914" : T.text, marginBottom: 2 }}>
                                            {job.isBreak ? "🍴 Lunch Break" : job.clientName}
                                          </div>
                                          <div style={{ fontSize: 10, color: T.textMuted }}>
                                            {job.startTime} - {job.endTime}
                                            {!job.isBreak && <span> ({job.duration} mins)</span>}
                                          </div>
                                          {!job.isBreak && (
                                            <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                                              📍 {job.suburb}
                                              {job.status === "completed" && <span style={{ color: "#155724" }}>✓</span>}
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Travel time indicator to next job */}
                                        {nextJob && (
                                          <div style={{ 
                                            padding: "4px 10px 4px 14px", 
                                            fontSize: 9, 
                                            color: T.textLight,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                            borderLeft: `3px solid ${T.border}`,
                                            marginLeft: 0,
                                          }}>
                                            {travelData ? (
                                              <>
                                                <span>↓</span>
                                                <span style={{ color: T.textMuted }}>{travelData.duration} mins</span>
                                                <span>·</span>
                                                <span>{travelData.distance} km</span>
                                              </>
                                            ) : (
                                              <>
                                                <span>↓</span>
                                                <span style={{ fontStyle: "italic" }}>travel</span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Add Job Button */}
                        <button
                          onClick={() => setEditingJob({ date, teamId: scheduleSettings.teams[0].id, isNew: true })}
                          style={{ width: "100%", padding: "6px", borderRadius: 6, border: `1.5px dashed ${T.border}`, background: "transparent", fontSize: 11, color: T.textMuted, cursor: "pointer", marginTop: 4 }}
                        >
                          + Add Job
                        </button>
                        
                        {/* Daily Travel Summary */}
                        {(() => {
                          // Calculate total travel for this day
                          let totalDistance = 0;
                          let totalDuration = 0;
                          let hasData = false;
                          
                          scheduleSettings.teams.forEach(team => {
                            const key = `${date}_${team.id}`;
                            const travelData = calendarTravelTimes[key];
                            if (travelData) {
                              travelData.forEach(t => {
                                if (t.distance && !isNaN(parseFloat(t.distance))) {
                                  totalDistance += parseFloat(t.distance);
                                  hasData = true;
                                }
                                if (t.duration && !isNaN(parseInt(t.duration))) {
                                  totalDuration += parseInt(t.duration);
                                }
                              });
                            }
                          });
                          
                          if (!hasData) return null;
                          
                          return (
                            <div style={{ 
                              marginTop: 8, 
                              padding: "8px 10px", 
                              background: T.bg, 
                              borderRadius: 6, 
                              fontSize: 10, 
                              color: T.textMuted,
                              display: "flex",
                              justifyContent: "center",
                              gap: 12,
                            }}>
                              <span>🚗 {totalDistance.toFixed(1)} km</span>
                              <span>⏱️ {totalDuration} mins</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scheduled Clients List */}
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Scheduled Clients</h3>
                <span style={{ fontSize: 13, color: T.textMuted }}>
                  {scheduleClients.filter(c => !c.isDemo).length} real · {scheduleClients.filter(c => c.isDemo).length} demo
                </span>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
                {scheduleClients.slice(0, 12).map(client => {
                  const team = scheduleSettings.teams.find(t => t.id === client.assignedTeam);
                  const duration = client.customDuration || calculateDuration(client, scheduleSettings);
                  const nextJob = scheduledJobs.find(j => j.clientId === client.id && j.date >= new Date().toISOString().split("T")[0]);
                  
                  return (
                    <div
                      key={client.id}
                      onClick={() => setEditingScheduleClient(client)}
                      style={{
                        background: "#fff",
                        borderRadius: T.radius,
                        padding: "14px 16px",
                        boxShadow: T.shadow,
                        cursor: "pointer",
                        borderLeft: `4px solid ${team?.color || T.border}`,
                        opacity: client.isDemo ? 0.8 : 1,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>
                            {client.name}
                            {client.isDemo && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", background: T.accentLight, color: "#8B6914", borderRadius: 4 }}>DEMO</span>}
                          </div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>📍 {client.suburb}</div>
                        </div>
                        <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: team?.color + "20", color: team?.color, fontWeight: 700 }}>
                          {team?.name}
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.textMuted }}>
                        <span>🕐 {duration} mins</span>
                        <span>📅 {client.frequency}</span>
                        <span>📆 {client.preferredDay}</span>
                      </div>
                      
                      {nextJob && (
                        <div style={{ marginTop: 8, fontSize: 11, color: T.primary, fontWeight: 600 }}>
                          Next: {formatDate(nextJob.date)} at {nextJob.startTime}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {scheduleClients.length > 12 && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <span style={{ fontSize: 13, color: T.textMuted }}>
                    + {scheduleClients.length - 12} more clients
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── CLIENTS PAGE ─── */}
        {page === "clients" && (
          <>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Clients</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{clients.length} contacts</p>
              </div>
              <SearchInput value={clientSearch} onChange={setClientSearch} placeholder="Search name, email, phone..." />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredClients.map(c => (
                <div key={c.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "18px 20px", boxShadow: T.shadow }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: c.status === "client" ? `linear-gradient(135deg, ${T.primary}, ${T.blue})` : T.border, display: "flex", alignItems: "center", justifyContent: "center", color: c.status === "client" ? "#fff" : T.textMuted, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                      {c.name?.split(" ").map(n => n[0]).join("") || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>📍 {c.suburb}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                      {c.email && (
                        <a href={`mailto:${c.email}`} style={{ color: T.blue, textDecoration: "none" }}>📧 {c.email}</a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} style={{ color: T.primary, textDecoration: "none" }}>📱 {c.phone}</a>
                      )}
                    </div>
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: c.status === "client" ? "#D4EDDA" : T.accentLight,
                      color: c.status === "client" ? "#155724" : "#8B6914",
                    }}>
                      {c.status === "client" ? "Client ✓" : "Lead"}
                    </span>
                  </div>
                </div>
              ))}
              {filteredClients.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <p>{clientSearch ? "No results found" : "No clients yet — they'll appear when customers submit the form"}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TEMPLATES PAGE ─── */}
        {page === "templates" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Message Templates</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Quick-copy messages for common responses</p>
              </div>
              <button onClick={() => setAddTemplateModal(true)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                + Add Template
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {templates.map(t => (
                <div key={t.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px 24px", boxShadow: T.shadow }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{t.name}</span>
                      {t.isDefault && <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: T.blueLight, color: T.blue }}>DEFAULT</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => copyTemplate(t.content)} style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${T.primary}`, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.primary }}>
                        📋 Copy
                      </button>
                      {!t.isDefault && (
                        <button onClick={() => removeTemplate(t.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#FDF0EF", cursor: "pointer", fontSize: 12, color: T.danger }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.content}</p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, background: T.blueLight, borderRadius: T.radius, padding: "16px 20px" }}>
              <h4 style={{ margin: "0 0 8px", fontWeight: 700, color: T.blue }}>💡 Tip: Using placeholders</h4>
              <p style={{ margin: 0, fontSize: 13, color: T.text }}>
                Use <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{"{NAME}"}</code> for customer name, <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>{"{FREQUENCY}"}</code> for clean frequency, and <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>[FORM LINK]</code> as a reminder to paste your form link.
              </p>
            </div>
          </>
        )}

        {/* ─── CUSTOMER FORM PAGE ─── */}
        {page === "form" && (
          <>
            <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Customer Form</h1>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>This is the form your customers will fill in. Share the link below.</p>

            <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "20px" : "28px 32px", boxShadow: T.shadowMd, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: T.text }}>📎 Shareable Form Link</h3>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: T.radiusSm, background: T.bg, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.primary, fontWeight: 600, wordBreak: "break-all" }}>
                  {formUrl}
                </div>
                <button onClick={() => { navigator.clipboard?.writeText(formUrl); showToast("📋 Link copied!"); }}
                  style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Copy Link
                </button>
                <a href="/form" target="_blank" rel="noopener noreferrer"
                  style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: "#fff", color: T.primary, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Open Form ↗
                </a>
              </div>
            </div>

            <div style={{ background: T.blueLight, borderRadius: T.radius, padding: "20px 24px" }}>
              <h4 style={{ margin: "0 0 8px", fontWeight: 700, color: T.blue }}>How it works</h4>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 2 }}>
                1️⃣ Customer clicks the link (from your auto-reply message)<br />
                2️⃣ They select their suburb first to check we service their area<br />
                3️⃣ They fill in their details, room counts, frequency & add-ons<br />
                4️⃣ Submission appears in your Inbox with status "Info Received"<br />
                5️⃣ You click "Generate Quote" → review → approve & send
              </div>
            </div>
          </>
        )}

        {/* ─── PRICING PAGE ─── */}
        {page === "pricing" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Pricing</h1>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Manage services & prices. Changes update the customer form automatically.</p>
              </div>
              <button onClick={() => setAddServiceModal(true)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                + Add Service
              </button>
            </div>

            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Room Pricing</h3>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "140px" : "180px"}, 1fr))`, gap: 12, marginBottom: 28 }}>
              {roomServices.map(([k, v]) => (
                <div key={k} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px", boxShadow: T.shadow, textAlign: "center", position: "relative" }}>
                  <button onClick={() => removeService(k)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: T.textLight, fontSize: 14 }}>✕</button>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{v.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: T.textLight, marginBottom: 10 }}>{v.unit}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: T.primary }}>${v.price}</div>
                  <button onClick={() => setEditPriceModal(k)} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>

            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Add-on Pricing</h3>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "140px" : "180px"}, 1fr))`, gap: 12, marginBottom: 28 }}>
              {addonServices.map(([k, v]) => (
                <div key={k} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px", boxShadow: T.shadow, textAlign: "center", position: "relative" }}>
                  <button onClick={() => removeService(k)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: T.textLight, fontSize: 14 }}>✕</button>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{v.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: T.textLight, marginBottom: 10 }}>{v.unit}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: T.blue }}>${v.price}</div>
                  <button onClick={() => setEditPriceModal(k)} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
              <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "18px 22px" }}>
                <h4 style={{ margin: "0 0 6px", fontWeight: 700, color: "#8B6914" }}>🎉 Weekly Discount</h4>
                <p style={{ margin: 0, fontSize: 13, color: T.text }}>10% automatically applied to all weekly bookings</p>
              </div>
              <div style={{ background: T.primaryLight, borderRadius: T.radius, padding: "18px 22px" }}>
                <h4 style={{ margin: "0 0 6px", fontWeight: 700, color: T.primaryDark }}>📍 Service Areas</h4>
                <p style={{ margin: 0, fontSize: 13, color: T.text }}>{SERVICED_AREAS.join(", ")}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Enquiry Details Modal */}
      {selectedEnquiry && (
        <Modal title={`${selectedEnquiry.name}'s Details`} onClose={() => setSelectedEnquiry(null)}>
          {selectedEnquiry.details && (
            <>
              {/* Contact Info */}
              <div style={{ background: T.blueLight, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, marginBottom: 8, textTransform: "uppercase" }}>Contact Info</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedEnquiry.details.email && (
                    <a href={`mailto:${selectedEnquiry.details.email}`} style={{ fontSize: 14, color: T.text, textDecoration: "none" }}>📧 {selectedEnquiry.details.email}</a>
                  )}
                  {selectedEnquiry.details.phone && (
                    <a href={`tel:${selectedEnquiry.details.phone}`} style={{ fontSize: 14, color: T.text, textDecoration: "none" }}>📱 {selectedEnquiry.details.phone}</a>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                {Object.entries({
                  "Bedrooms": selectedEnquiry.details.bedrooms,
                  "Bathrooms": selectedEnquiry.details.bathrooms,
                  "Living Rooms": selectedEnquiry.details.living,
                  "Kitchens": selectedEnquiry.details.kitchen,
                  "Frequency": selectedEnquiry.details.frequency,
                }).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div>
                    <div style={{ fontWeight: 700, color: T.text }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Addons */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Add-ons Selected</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {addonServices.map(([key, service]) => {
                    const isActive = selectedEnquiry.details[key];
                    const qty = service.hasQuantity ? selectedEnquiry.details[`${key}Count`] : null;
                    if (!isActive) return null;
                    return (
                      <span key={key} style={{ padding: "6px 12px", borderRadius: 8, background: T.primaryLight, color: T.primaryDark, fontSize: 12, fontWeight: 600 }}>
                        {service.icon} {service.label}{qty ? ` (${qty})` : ""}
                      </span>
                    );
                  })}
                  {!addonServices.some(([key]) => selectedEnquiry.details[key]) && (
                    <span style={{ color: T.textLight, fontSize: 13 }}>None selected</span>
                  )}
                </div>
              </div>

              {selectedEnquiry.details.notes && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: T.bg, borderRadius: T.radiusSm }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>NOTES</div>
                  <div style={{ fontSize: 13, color: T.text }}>{selectedEnquiry.details.notes}</div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {/* Edit Quote Modal */}
      {editQuoteModal && (
        <EditQuoteModal
          quote={editQuoteModal}
          pricing={pricing}
          onSave={(updated) => {
            setQuotes(prev => prev.map(q => q.id === updated.id ? updated : q));
            setEditQuoteModal(null);
            showToast("✏️ Quote updated");
          }}
          onClose={() => setEditQuoteModal(null)}
        />
      )}

      {/* Edit Price Modal */}
      {editPriceModal && (
        <EditPriceModal
          serviceKey={editPriceModal}
          pricing={pricing}
          onSave={(key, newPrice) => {
            setPricing(prev => ({ ...prev, [key]: { ...prev[key], price: newPrice } }));
            setEditPriceModal(null);
            showToast(`💰 ${pricing[editPriceModal].label} price updated to $${newPrice}`);
          }}
          onClose={() => setEditPriceModal(null)}
        />
      )}

      {/* Add Service Modal */}
      {addServiceModal && (
        <AddServiceModal
          onSave={addService}
          onClose={() => setAddServiceModal(false)}
        />
      )}

      {/* Add Template Modal */}
      {addTemplateModal && (
        <AddTemplateModal
          onSave={addTemplate}
          onClose={() => setAddTemplateModal(false)}
        />
      )}

      {/* Quote Preview Modal */}
      {previewQuote && (
        <Modal title="Quote Preview" onClose={() => setPreviewQuote(null)} wide>
          <QuotePreviewInline quote={previewQuote} pricing={pricing} />
          <button onClick={() => setPreviewQuote(null)} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.textMuted }}>
            Close
          </button>
        </Modal>
      )}

      {/* Email Preview Modal */}
      {emailPreview && (
        <EmailPreviewModal
          quote={emailPreview.quote}
          enquiry={emailPreview.enquiry}
          pricing={pricing}
          onSend={sendQuoteEmail}
          onClose={() => setEmailPreview(null)}
          sending={sendingEmail}
        />
      )}

      {/* Schedule Settings Modal */}
      {showScheduleSettings && (
        <ScheduleSettingsModal
          settings={scheduleSettings}
          onSave={(updated) => { 
            setScheduleSettings(updated); 
            setShowScheduleSettings(false); 
            showToast("✅ Settings saved"); 
          }}
          onSaveAndRegenerate={(updated) => {
            setScheduleSettings(updated);
            setShowScheduleSettings(false);
            // Use setTimeout to ensure state is updated before regenerating
            setTimeout(() => regenerateSchedule(updated), 100);
          }}
          onClose={() => setShowScheduleSettings(false)}
        />
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          clients={scheduleClients}
          settings={scheduleSettings}
          onSave={editingJob.isNew ? addNewJob : (updates) => updateJob(editingJob.id, updates)}
          onDelete={editingJob.isNew ? null : () => deleteJob(editingJob.id)}
          onClose={() => setEditingJob(null)}
        />
      )}

      {/* Edit Schedule Client Modal */}
      {editingScheduleClient && (
        <EditScheduleClientModal
          client={editingScheduleClient}
          settings={scheduleSettings}
          onSave={editingScheduleClient.id ? (updates) => updateScheduleClient(editingScheduleClient.id, updates) : (newClient) => {
            const client = {
              ...newClient,
              id: `client_${Date.now()}`,
              isDemo: false,
              createdAt: new Date().toISOString(),
              status: "active",
            };
            client.estimatedDuration = calculateDuration(client, scheduleSettings);
            setScheduleClients(prev => [...prev, client]);
            setEditingScheduleClient(null);
            showToast("✅ Client added");
          }}
          onDelete={editingScheduleClient.id ? () => deleteScheduleClient(editingScheduleClient.id) : null}
          onClose={() => setEditingScheduleClient(null)}
        />
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          job={showInvoiceModal}
          client={scheduleClients.find(c => c.id === showInvoiceModal.clientId)}
          pricing={pricing}
          onGenerate={(invoice) => {
            const newInvoice = addInvoice(invoice);
            setInvoices(loadInvoices());
            setShowInvoiceModal(null);
            showToast(`✅ Invoice ${newInvoice.invoiceNumber} created`);
          }}
          onClose={() => setShowInvoiceModal(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        button:hover:not(:disabled) { opacity: 0.9; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// ─── Helper: action button style ───
function actionBtn(bg, color) {
  return {
    padding: "5px 10px", borderRadius: 8, border: "none", background: bg,
    color, fontSize: 11, fontWeight: 700, cursor: "pointer",
  };
}

// ─── Edit Quote Modal Component ───
function EditQuoteModal({ quote, pricing, onSave, onClose }) {
  const [details, setDetails] = useState({ ...quote.details });
  const u = (k, v) => setDetails(prev => ({ ...prev, [k]: v }));
  const calc = calcQuote(details, pricing);

  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");

  return (
    <Modal title={`Edit Quote — ${quote.name}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {roomServices.map(([k, v]) => (
          <div key={k}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{v.label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <button onClick={() => u(k, Math.max(0, (details[k] || 0) - 1))} style={counterBtn}>−</button>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{details[k] || 0}</span>
              <button onClick={() => u(k, (details[k] || 0) + 1)} style={counterBtnPlus}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>Frequency</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {["weekly", "fortnightly", "monthly"].map(f => (
            <button key={f} onClick={() => u("frequency", f)} style={{
              padding: "8px 16px", borderRadius: 8, border: details.frequency === f ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
              background: details.frequency === f ? T.primaryLight : "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
              color: details.frequency === f ? T.primaryDark : T.textMuted,
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)} {f === "weekly" && "(-10%)"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>Updated Total: <span style={{ fontSize: 22, color: T.primary }}>${calc.total.toFixed(2)}</span></div>
        {calc.discountLabel && <div style={{ fontSize: 12, color: T.primaryDark }}>Includes {calc.discountLabel}</div>}
      </div>

      <button onClick={() => onSave({ ...quote, details, frequency: details.frequency.charAt(0).toUpperCase() + details.frequency.slice(1) })}
        style={{ width: "100%", padding: "12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        Save Changes
      </button>
    </Modal>
  );
}

const counterBtn = { width: 32, height: 32, borderRadius: 8, border: `1.5px solid #E2EBE6`, background: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600, color: "#7A8F85", display: "flex", alignItems: "center", justifyContent: "center" };
const counterBtnPlus = { ...counterBtn, border: `1.5px solid #4A9E7E`, background: "#E8F5EE", color: "#4A9E7E" };

// ─── Edit Price Modal ───
function EditPriceModal({ serviceKey, pricing, onSave, onClose }) {
  const [price, setPrice] = useState(pricing[serviceKey].price);
  return (
    <Modal title={`Edit ${pricing[serviceKey].label} Price`} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>Price ($)</label>
        <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} step={5}
          style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 20, fontWeight: 800, marginTop: 6, color: T.primary }} />
      </div>
      <button onClick={() => onSave(serviceKey, price)}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        Update Price
      </button>
    </Modal>
  );
}

// ─── Add Service Modal ───
function AddServiceModal({ onSave, onClose }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState(25);
  const [unit, setUnit] = useState("per room");
  const [icon, setIcon] = useState("🧹");
  const [category, setCategory] = useState("room");
  const [hasQuantity, setHasQuantity] = useState(false);

  const canSave = label.trim() && price > 0;

  return (
    <Modal title="Add New Service" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>SERVICE NAME</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Garage Clean"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>ICON</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ICON_OPTIONS.map(i => (
              <button key={i} onClick={() => setIcon(i)} style={{
                width: 40, height: 40, borderRadius: 8, fontSize: 20, cursor: "pointer",
                border: icon === i ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                background: icon === i ? T.primaryLight : "#fff",
              }}>{i}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PRICE ($)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 16, fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>UNIT</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="per room"
              style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 8 }}>CATEGORY</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[{ id: "room", label: "Room (counted)" }, { id: "addon", label: "Add-on (optional)" }].map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                flex: 1, padding: "12px", borderRadius: 8, cursor: "pointer",
                border: category === c.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                background: category === c.id ? T.primaryLight : "#fff",
                fontWeight: 700, fontSize: 13, color: category === c.id ? T.primaryDark : T.textMuted,
              }}>{c.label}</button>
            ))}
          </div>
        </div>

        {category === "addon" && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={hasQuantity} onChange={e => setHasQuantity(e.target.checked)} />
            <span style={{ fontSize: 13, color: T.text }}>Allow quantity selection (e.g. "How many windows?")</span>
          </label>
        )}

        <button onClick={() => canSave && onSave({ label, price, unit, icon, category, hasQuantity: category === "addon" && hasQuantity })}
          disabled={!canSave}
          style={{
            width: "100%", padding: "12px", borderRadius: 8, border: "none",
            background: canSave ? T.primary : T.border,
            color: canSave ? "#fff" : T.textLight,
            fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed",
          }}>
          Add Service
        </button>
      </div>
    </Modal>
  );
}

// ─── Add Template Modal ───
function AddTemplateModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const canSave = name.trim() && content.trim();

  return (
    <Modal title="Add Message Template" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TEMPLATE NAME</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reschedule Request"
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>MESSAGE CONTENT</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Type your message template here..."
            style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        <div style={{ background: T.bg, borderRadius: 8, padding: "12px 16px", fontSize: 12, color: T.textMuted }}>
          💡 Use {"{NAME}"} for customer name, {"{FREQUENCY}"} for clean frequency
        </div>

        <button onClick={() => canSave && onSave({ name, content })}
          disabled={!canSave}
          style={{
            width: "100%", padding: "12px", borderRadius: 8, border: "none",
            background: canSave ? T.primary : T.border,
            color: canSave ? "#fff" : T.textLight,
            fontWeight: 700, fontSize: 14, cursor: canSave ? "pointer" : "not-allowed",
          }}>
          Add Template
        </button>
      </div>
    </Modal>
  );
}

// ─── Email Preview Modal ───
function EmailPreviewModal({ quote, enquiry, pricing, onSend, onClose, sending }) {
  const calc = calcQuote(quote.details, pricing);
  const customerEmail = enquiry?.details?.email || 'No email found';
  const customerName = quote.name.split(' ')[0];
  
  return (
    <Modal title="📧 Preview Email" onClose={onClose} wide>
      {/* Email To */}
      <div style={{ background: T.blueLight, borderRadius: T.radiusSm, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: T.textMuted }}>Sending to:</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{customerEmail}</span>
      </div>
      
      {/* Email Preview */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", marginBottom: 20 }}>
        {/* Email Header */}
        <div style={{ background: T.sidebar, padding: "24px", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🌿</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Dust Bunnies Cleaning</div>
          <div style={{ fontSize: 12, color: "#8FBFA8", marginTop: 4 }}>Eco-conscious cleaning · Sunshine Coast</div>
        </div>
        
        <div style={{ background: T.primary, padding: "10px 24px", textAlign: "center" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>YOUR CLEANING QUOTE</span>
        </div>
        
        {/* Email Body */}
        <div style={{ padding: "24px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, color: T.text }}>
            Hey <strong>{customerName}</strong>! 👋
          </p>
          
          <p style={{ margin: "0 0 20px", fontSize: 14, color: T.textMuted, lineHeight: 1.7 }}>
            Thanks so much for getting in touch! We've put together a personalised quote for your <strong style={{ color: T.text }}>{quote.frequency}</strong> clean in <strong style={{ color: T.text }}>{quote.suburb}</strong>.
          </p>
          
          {/* Quote Summary Box */}
          <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "20px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Quote Summary</div>
            {calc.items.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: T.text }}>
                <span>{item.description} × {item.qty}</span>
                <span style={{ fontWeight: 600 }}>${item.total.toFixed(2)}</span>
              </div>
            ))}
            {calc.discountLabel && (
              <>
                <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.primaryDark, fontWeight: 700 }}>
                  <span>🎉 Weekly Discount (10%)</span>
                  <span>-${calc.discount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          
          {/* Total Box */}
          <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, borderRadius: T.radiusSm, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>TOTAL PER CLEAN</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>per {quote.frequency.toLowerCase()} visit</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>${calc.total.toFixed(2)}</div>
          </div>
          
          {/* CTA */}
          <div style={{ background: T.primaryLight, borderRadius: T.radiusSm, padding: "16px 20px", borderLeft: `4px solid ${T.primary}` }}>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: T.primaryDark }}>Ready to get started? 💚</p>
            <p style={{ margin: 0, fontSize: 13, color: T.text }}>Simply reply to this email and we'll get your first clean booked in!</p>
          </div>
        </div>
        
        {/* Email Footer */}
        <div style={{ background: T.bg, padding: "16px 24px", textAlign: "center", borderTop: `1px solid ${T.border}` }}>
          <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>Chat soon! 💚</p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textLight }}>Dust Bunnies Cleaning · Sunshine Coast, QLD</p>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onClose} disabled={sending} style={{
          flex: 1, padding: "14px", borderRadius: T.radiusSm,
          border: `1.5px solid ${T.border}`, background: "#fff",
          fontWeight: 700, fontSize: 14, cursor: sending ? "not-allowed" : "pointer", color: T.textMuted,
        }}>
          Cancel
        </button>
        <button onClick={onSend} disabled={sending || !enquiry?.details?.email} style={{
          flex: 2, padding: "14px", borderRadius: T.radiusSm, border: "none",
          background: (!enquiry?.details?.email || sending) ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.blue})`,
          fontWeight: 700, fontSize: 14, cursor: (!enquiry?.details?.email || sending) ? "not-allowed" : "pointer", color: "#fff",
          boxShadow: enquiry?.details?.email && !sending ? "0 4px 12px rgba(74,158,126,0.3)" : "none",
        }}>
          {sending ? "Sending..." : `📧 Send to ${customerEmail}`}
        </button>
      </div>
      
      {!enquiry?.details?.email && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "#FDF0EF", borderRadius: T.radiusSm, fontSize: 13, color: T.danger }}>
          ⚠️ No email address found for this customer. Please check the enquiry details.
        </div>
      )}
    </Modal>
  );
}

// ─── Inline Quote Preview ───
function QuotePreviewInline({ quote, pricing }) {
  const calc = calcQuote(quote.details, pricing);

  return (
    <div style={{ borderRadius: T.radius, overflow: "hidden", border: `1px solid ${T.border}` }}>
      {/* Header */}
      <div style={{ background: T.sidebar, padding: "20px 24px", color: "#fff" }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🌿 Dust Bunnies Cleaning</div>
        <div style={{ fontSize: 12, color: "#8FBFA8", marginTop: 2 }}>Eco-conscious cleaning | Sunshine Coast</div>
      </div>
      <div style={{ background: T.primary, padding: "8px 24px", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>CLEANING QUOTE</span><span>#{quote.id}</span>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Customer */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Prepared For</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{quote.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{quote.suburb}, Sunshine Coast</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Frequency</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.primaryDark }}>
              {quote.frequency} {quote.details.frequency === "weekly" && <span style={{ background: T.accentLight, padding: "2px 8px", borderRadius: 8, fontSize: 10, color: "#8B6914" }}>SAVE 10%</span>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div style={{ borderRadius: T.radiusSm, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: T.sidebar, padding: "8px 14px", display: "flex", color: "#fff", fontSize: 11, fontWeight: 700 }}>
            <span style={{ flex: 1 }}>SERVICE</span><span style={{ width: 50, textAlign: "center" }}>QTY</span><span style={{ width: 60, textAlign: "center" }}>UNIT</span><span style={{ width: 70, textAlign: "right" }}>TOTAL</span>
          </div>
          {calc.items.map((item, i) => (
            <div key={i} style={{ padding: "10px 14px", display: "flex", fontSize: 13, background: i % 2 ? T.bg : "#fff", alignItems: "center" }}>
              <span style={{ flex: 1, color: T.text }}>{item.description}</span>
              <span style={{ width: 50, textAlign: "center", color: T.textMuted }}>{item.qty}</span>
              <span style={{ width: 60, textAlign: "center", color: T.textMuted }}>${item.unitPrice}</span>
              <span style={{ width: 70, textAlign: "right", fontWeight: 700, color: T.text }}>${item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.textMuted }}>Subtotal: <span style={{ fontWeight: 700, color: T.text }}>${calc.subtotal.toFixed(2)}</span></div>
          {calc.discountLabel && (
            <div style={{ fontSize: 13, color: T.primaryDark, fontWeight: 700, marginTop: 4 }}>{calc.discountLabel}: -${calc.discount.toFixed(2)}</div>
          )}
        </div>

        <div style={{ background: T.primary, borderRadius: T.radiusSm, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>TOTAL PER CLEAN</span>
          <span style={{ fontSize: 26, fontWeight: 900 }}>${calc.total.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 11, color: T.textLight }}>Dust Bunnies Cleaning · Sunshine Coast · Eco-conscious 🌿</p>
      </div>
    </div>
  );
}

// ─── Schedule Settings Modal ───
function ScheduleSettingsModal({ settings, onSave, onSaveAndRegenerate, onClose }) {
  const [local, setLocal] = useState({ ...settings });
  const u = (path, value) => {
    const keys = path.split(".");
    setLocal(prev => {
      const updated = { ...prev };
      let obj = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  return (
    <Modal title="⚙️ Schedule Settings" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Teams */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Teams</label>
          {local.teams.map((team, i) => (
            <div key={team.id} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <input
                type="text"
                value={team.name}
                onChange={e => {
                  const teams = [...local.teams];
                  teams[i] = { ...teams[i], name: e.target.value };
                  setLocal({ ...local, teams });
                }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
              />
              <input
                type="color"
                value={team.color}
                onChange={e => {
                  const teams = [...local.teams];
                  teams[i] = { ...teams[i], color: e.target.value };
                  setLocal({ ...local, teams });
                }}
                style={{ width: 50, height: 42, borderRadius: 8, border: `1.5px solid ${T.border}`, cursor: "pointer" }}
              />
            </div>
          ))}
        </div>

        {/* Working Hours */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Working Hours</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Start</div>
              <input type="time" value={local.workingHours.start} onChange={e => u("workingHours.start", e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>End</div>
              <input type="time" value={local.workingHours.end} onChange={e => u("workingHours.end", e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Break (mins)</div>
              <input type="number" value={local.workingHours.breakDuration} onChange={e => u("workingHours.breakDuration", Number(e.target.value))}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>Travel Buffer</div>
              <input type="number" value={local.workingHours.travelBuffer} onChange={e => u("workingHours.travelBuffer", Number(e.target.value))}
                style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
            </div>
          </div>
        </div>

        {/* Duration Estimates */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Duration Estimates (minutes per room)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            {[["bedroom", "🛏️"], ["bathroom", "🚿"], ["living", "🛋️"], ["kitchen", "🍳"], ["baseSetup", "🏠 Setup"]].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{label}</div>
                <input type="number" value={local.durationEstimates[key]} onChange={e => u(`durationEstimates.${key}`, Number(e.target.value))}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Jobs Per Team */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Jobs Per Team Per Day</label>
          <input type="number" value={local.jobsPerTeamPerDay} onChange={e => setLocal({ ...local, jobsPerTeamPerDay: Number(e.target.value) })} min={1} max={6}
            style={{ width: 100, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        {/* Area Schedule */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Area Schedule (suburbs per day)</label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.textMuted }}>Clients will be auto-assigned to days based on their suburb</p>
          {["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 80, fontSize: 13, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>{day}</div>
              <input
                type="text"
                value={(local.areaSchedule[day] || []).join(", ")}
                onChange={e => {
                  const areas = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                  setLocal({ ...local, areaSchedule: { ...local.areaSchedule, [day]: areas } });
                }}
                placeholder="e.g. Buderim, Kuluin"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }}
              />
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onSave(local)} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Save Only
          </button>
          <button onClick={() => onSaveAndRegenerate(local)} style={{ flex: 2, padding: "14px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            💫 Save & Regenerate Schedule
          </button>
        </div>
        
        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, textAlign: "center" }}>
          "Save & Regenerate" will rebuild the schedule based on new area assignments
        </p>
      </div>
    </Modal>
  );
}

// ─── Edit Job Modal ───
function EditJobModal({ job, clients, settings, onSave, onDelete, onClose }) {
  const [local, setLocal] = useState({
    date: job.date || "",
    clientId: job.clientId || "",
    teamId: job.teamId || settings.teams[0]?.id,
    startTime: job.startTime || "08:00",
    duration: job.duration || 120,
    status: job.status || "scheduled",
  });

  const selectedClient = clients.find(c => c.id === local.clientId);
  const u = (k, v) => setLocal({ ...local, [k]: v });

  const handleSave = () => {
    if (!local.date || !local.clientId) return;
    const client = clients.find(c => c.id === local.clientId);
    
    // Calculate end time
    const [h, m] = local.startTime.split(":").map(Number);
    const endMins = h * 60 + m + local.duration;
    const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    
    onSave({
      date: local.date,
      clientId: local.clientId,
      clientName: client?.name || "Unknown",
      suburb: client?.suburb || "",
      teamId: local.teamId,
      startTime: local.startTime,
      endTime,
      duration: local.duration,
      status: local.status,
      isDemo: client?.isDemo || false,
    });
    onClose();
  };

  return (
    <Modal title={job.isNew ? "Add Job" : "Edit Job"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DATE</label>
          <input type="date" value={local.date} onChange={e => u("date", e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>CLIENT</label>
          <select value={local.clientId} onChange={e => {
            const client = clients.find(c => c.id === e.target.value);
            u("clientId", e.target.value);
            if (client) {
              setLocal(prev => ({ ...prev, clientId: e.target.value, duration: client.customDuration || client.estimatedDuration || 120 }));
            }
          }} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="">Select client...</option>
            {clients.filter(c => c.status === "active").map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.suburb}){c.isDemo ? " [Demo]" : ""}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TEAM</label>
            <select value={local.teamId} onChange={e => u("teamId", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {settings.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>STATUS</label>
            <select value={local.status} onChange={e => u("status", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>START TIME</label>
            <input type="time" value={local.startTime} onChange={e => u("startTime", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DURATION (mins)</label>
            <input type="number" value={local.duration} onChange={e => u("duration", Number(e.target.value))} min={30} step={15}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
        </div>

        {selectedClient && (
          <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "12px 14px", fontSize: 12, color: T.textMuted }}>
            📍 {selectedClient.suburb} · 🛏️ {selectedClient.bedrooms} bed · 🚿 {selectedClient.bathrooms} bath
            {selectedClient.notes && <div style={{ marginTop: 6, color: T.text }}>📝 {selectedClient.notes}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: "12px 18px", borderRadius: T.radiusSm, border: "none", background: "#FDF0EF", color: T.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🗑️ Delete
            </button>
          )}
          <button onClick={handleSave} disabled={!local.date || !local.clientId}
            style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: "none", background: local.date && local.clientId ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: local.date && local.clientId ? "pointer" : "not-allowed" }}>
            {job.isNew ? "Add Job" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit Schedule Client Modal ───
function EditScheduleClientModal({ client, settings, onSave, onDelete, onClose }) {
  const isNew = !client.id;
  const [local, setLocal] = useState({
    name: client.name || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    suburb: client.suburb || SERVICED_AREAS[0],
    bedrooms: client.bedrooms || 3,
    bathrooms: client.bathrooms || 2,
    living: client.living || 1,
    kitchen: client.kitchen || 1,
    frequency: client.frequency || "fortnightly",
    preferredDay: client.preferredDay || "monday",
    preferredTime: client.preferredTime || "anytime",
    assignedTeam: client.assignedTeam || settings.teams[0]?.id,
    customDuration: client.customDuration || null,
    notes: client.notes || "",
    status: client.status || "active",
  });

  const u = (k, v) => setLocal({ ...local, [k]: v });
  const estimatedDuration = calculateDuration(local, settings);

  return (
    <Modal title={isNew ? "Add Client" : `Edit: ${client.name}`} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* Basic Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>NAME</label>
            <input type="text" value={local.name} onChange={e => u("name", e.target.value)} placeholder="Client name"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>SUBURB</label>
            <select value={local.suburb} onChange={e => u("suburb", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {SERVICED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Full Address */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>FULL ADDRESS (for accurate distance)</label>
          <input type="text" value={local.address} onChange={e => u("address", e.target.value)} 
            placeholder="e.g. 123 Smith Street, Buderim QLD 4556"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textLight }}>
            Used for precise route calculations. Leave blank to use suburb center.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={local.email} onChange={e => u("email", e.target.value)} placeholder="email@example.com"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PHONE</label>
            <input type="tel" value={local.phone} onChange={e => u("phone", e.target.value)} placeholder="0412 345 678"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
          </div>
        </div>

        {/* Room Counts */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 10 }}>ROOMS</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[["bedrooms", "🛏️ Bed"], ["bathrooms", "🚿 Bath"], ["living", "🛋️ Living"], ["kitchen", "🍳 Kitchen"]].map(([key, label]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <button onClick={() => u(key, Math.max(0, local[key] - 1))} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 14 }}>-</button>
                  <span style={{ fontWeight: 700, width: 20, textAlign: "center" }}>{local[key]}</span>
                  <button onClick={() => u(key, local[key] + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T.primary}`, background: T.primaryLight, cursor: "pointer", fontSize: 14, color: T.primary }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Settings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>FREQUENCY</label>
            <select value={local.frequency} onChange={e => u("frequency", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>PREFERRED DAY</label>
            <select value={local.preferredDay} onChange={e => u("preferredDay", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {["monday", "tuesday", "wednesday", "thursday", "friday"].map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>TEAM</label>
            <select value={local.assignedTeam} onChange={e => u("assignedTeam", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              {settings.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Duration */}
        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Estimated Duration: {estimatedDuration} mins</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Based on room counts</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>Override:</span>
              <input
                type="number"
                value={local.customDuration || ""}
                onChange={e => u("customDuration", e.target.value ? Number(e.target.value) : null)}
                placeholder={String(estimatedDuration)}
                style={{ width: 80, padding: "8px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`, fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: T.textMuted }}>mins</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>NOTES</label>
          <textarea value={local.notes} onChange={e => u("notes", e.target.value)} placeholder="e.g. Has 2 dogs, keep gate closed..."
            rows={2} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, resize: "vertical" }} />
        </div>

        {/* Status (for existing clients) */}
        {!isNew && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>STATUS</label>
            <select value={local.status} onChange={e => u("status", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ padding: "12px 18px", borderRadius: T.radiusSm, border: "none", background: "#FDF0EF", color: T.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🗑️ Delete
            </button>
          )}
          <button onClick={() => { onSave(local); onClose(); }} disabled={!local.name}
            style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: "none", background: local.name ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: local.name ? "pointer" : "not-allowed" }}>
            {isNew ? "Add Client" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Email Preview Component ───
function EmailPreviewComponent({ templateType, customStyle, customContent, recipientName }) {
  const style = CUSTOM_EMAIL_STYLES[customStyle] || CUSTOM_EMAIL_STYLES.announcement;
  
  // Render different previews based on template type
  const renderEmailContent = () => {
    switch (templateType) {
      case "follow_up":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>
              Hey <strong>{recipientName}</strong>! 👋
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              Just wanted to check in about the quote we sent through a few days ago. We'd love to help get your home sparkling clean!
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              If you have any questions at all, or if you'd like to make any changes to the quote, just reply to this email — we're always happy to chat.
            </p>
            <div style={{ background: "#E8F5EE", borderRadius: 8, padding: "14px 18px", borderLeft: "4px solid #4A9E7E" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#2D7A5E", fontWeight: 600 }}>
                Ready to book? Simply reply "Yes" and we'll get you scheduled! 💚
              </p>
            </div>
          </>
        );
      
      case "review_request":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>
              Hey <strong>{recipientName}</strong>! 👋
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              We hope you've been enjoying your sparkling clean home! We absolutely loved working with you.
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              If you have a moment, we'd really appreciate a quick Google review. It helps other families find us and means the world to our small team! ⭐
            </p>
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <div style={{ display: "inline-block", padding: "14px 28px", background: "#4A9E7E", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14 }}>
                ⭐ Leave a Review
              </div>
            </div>
          </>
        );
      
      case "booking_confirmation":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>
              Hey <strong>{recipientName}</strong>! 🎉
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              Great news — you're all booked in! We can't wait to make your home sparkle.
            </p>
            <div style={{ background: "#E8F5EE", borderRadius: 8, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#7A8F85", marginBottom: 6 }}>YOUR FIRST CLEAN</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3E36" }}>Date & time will be confirmed shortly</div>
            </div>
            <p style={{ margin: "0", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              We'll send a reminder the day before. If you need to reschedule, just reply to this email!
            </p>
          </>
        );
      
      case "reminder":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>
              Hey <strong>{recipientName}</strong>! 👋
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>
              Just a friendly reminder that we'll be there <strong>tomorrow</strong> to give your home a beautiful clean! 🏠✨
            </p>
            <div style={{ background: "#FFF8E7", borderRadius: 8, padding: "14px 18px", borderLeft: "4px solid #E8C86A", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#8B6914" }}>
                <strong>Quick checklist:</strong> Clear surfaces where possible, and let us know if there's anything specific you'd like us to focus on!
              </p>
            </div>
            <p style={{ margin: "0", fontSize: 14, color: "#7A8F85" }}>
              See you tomorrow! 💚
            </p>
          </>
        );
      
      case "custom":
        return (
          <>
            {customContent.headline && (
              <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "#2C3E36" }}>
                {customContent.headline}
              </h2>
            )}
            <div style={{ fontSize: 14, color: "#7A8F85", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {(customContent.message || "Your message will appear here...").replace(/{NAME}/g, recipientName)}
            </div>
            {customContent.showButton && customContent.buttonText && (
              <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
                <div style={{ display: "inline-block", padding: "14px 28px", background: style.headerColor, borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {customContent.buttonText}
                </div>
              </div>
            )}
          </>
        );
      
      default:
        return <p style={{ color: "#7A8F85" }}>Select a template to preview</p>;
    }
  };

  const headerColor = templateType === "custom" ? style.headerColor : "#1B3A2D";
  const bannerColor = templateType === "custom" ? style.headerColor : "#4A9E7E";

  return (
    <div style={{ background: "#F4F8F6" }}>
      {/* Header */}
      <div style={{ background: headerColor, padding: "20px 24px", textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>🌿</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Dust Bunnies Cleaning</div>
        <div style={{ fontSize: 11, color: "#8FBFA8", marginTop: 2 }}>Eco-conscious cleaning · Sunshine Coast</div>
      </div>
      
      {/* Banner */}
      <div style={{ background: bannerColor, padding: "8px 24px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          {templateType === "follow_up" && "CHECKING IN"}
          {templateType === "review_request" && "WE'D LOVE YOUR FEEDBACK"}
          {templateType === "booking_confirmation" && "BOOKING CONFIRMED"}
          {templateType === "reminder" && "REMINDER"}
          {templateType === "custom" && (CUSTOM_EMAIL_STYLES[customStyle]?.name?.toUpperCase() || "MESSAGE")}
        </span>
      </div>
      
      {/* Body */}
      <div style={{ padding: "24px", background: "#fff" }}>
        {renderEmailContent()}
      </div>
      
      {/* Footer */}
      <div style={{ padding: "16px 24px", textAlign: "center", borderTop: "1px solid #E2EBE6" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#7A8F85" }}>Chat soon! 💚</p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#A3B5AD" }}>Dust Bunnies Cleaning · Sunshine Coast, QLD</p>
      </div>
    </div>
  );
}

// ─── Invoice Modal Component ───
function InvoiceModal({ job, client, pricing, onGenerate, onClose }) {
  const [invoiceDetails, setInvoiceDetails] = useState({
    description: `Cleaning service - ${job.suburb}`,
    amount: job.price || 0,
    notes: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 days from now
  });

  const handleGenerate = () => {
    const invoice = {
      jobId: job.id,
      clientId: job.clientId,
      clientName: job.clientName,
      clientEmail: client?.email || "",
      clientAddress: client?.address || job.suburb,
      serviceDate: job.date,
      description: invoiceDetails.description,
      amount: invoiceDetails.amount,
      notes: invoiceDetails.notes,
      dueDate: invoiceDetails.dueDate,
    };
    onGenerate(invoice);
  };

  const printInvoice = () => {
    const invoiceNumber = `INV-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #2C3E36; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: 800; color: #4A9E7E; }
          .logo-sub { font-size: 12px; color: #7A8F85; }
          .invoice-title { text-align: right; }
          .invoice-number { font-size: 24px; font-weight: 800; color: #2C3E36; }
          .invoice-date { font-size: 14px; color: #7A8F85; }
          .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .address-block h3 { font-size: 11px; text-transform: uppercase; color: #7A8F85; margin: 0 0 8px; }
          .address-block p { margin: 0; line-height: 1.6; }
          .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .line-items th { text-align: left; padding: 12px; background: #F4F8F6; font-size: 11px; text-transform: uppercase; color: #7A8F85; }
          .line-items td { padding: 16px 12px; border-bottom: 1px solid #E2EBE6; }
          .total-row { background: #E8F5EE; }
          .total-row td { font-weight: 800; font-size: 18px; }
          .notes { background: #F4F8F6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .notes-title { font-size: 11px; text-transform: uppercase; color: #7A8F85; margin: 0 0 8px; }
          .footer { text-align: center; color: #7A8F85; font-size: 12px; border-top: 1px solid #E2EBE6; padding-top: 20px; }
          .due-date { background: #FFF8E7; padding: 12px 20px; border-radius: 8px; display: inline-block; margin-bottom: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">🌿 Dust Bunnies Cleaning</div>
            <div class="logo-sub">Eco-conscious cleaning · Sunshine Coast</div>
          </div>
          <div class="invoice-title">
            <div class="invoice-number">${invoiceNumber}</div>
            <div class="invoice-date">Date: ${new Date().toLocaleDateString("en-AU")}</div>
          </div>
        </div>

        <div class="addresses">
          <div class="address-block">
            <h3>Bill To</h3>
            <p><strong>${job.clientName}</strong><br>
            ${client?.address || job.suburb}<br>
            ${client?.email || ""}<br>
            ${client?.phone || ""}</p>
          </div>
          <div class="address-block">
            <h3>Service Details</h3>
            <p>Service Date: ${new Date(job.date).toLocaleDateString("en-AU")}<br>
            Location: ${job.suburb}<br>
            Duration: ${job.duration} minutes</p>
          </div>
        </div>

        <div class="due-date">
          <strong>Payment Due:</strong> ${new Date(invoiceDetails.dueDate).toLocaleDateString("en-AU")}
        </div>

        <table class="line-items">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoiceDetails.description}</td>
              <td style="text-align: right;">$${invoiceDetails.amount.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>Total Due</td>
              <td style="text-align: right;">$${invoiceDetails.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${invoiceDetails.notes ? `
        <div class="notes">
          <div class="notes-title">Notes</div>
          <p>${invoiceDetails.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for choosing Dust Bunnies! 💚</p>
          <p>Payment can be made via bank transfer or cash</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Modal title="🧾 Generate Invoice" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Client Info */}
        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>{job.clientName}</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            {client?.address || job.suburb}<br />
            {client?.email && <span>{client.email}<br /></span>}
            Service Date: {new Date(job.date).toLocaleDateString("en-AU")}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DESCRIPTION</label>
          <input
            type="text"
            value={invoiceDetails.description}
            onChange={e => setInvoiceDetails(prev => ({ ...prev, description: e.target.value }))}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
          />
        </div>

        {/* Amount & Due Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>AMOUNT ($)</label>
            <input
              type="number"
              value={invoiceDetails.amount}
              onChange={e => setInvoiceDetails(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DUE DATE</label>
            <input
              type="date"
              value={invoiceDetails.dueDate}
              onChange={e => setInvoiceDetails(prev => ({ ...prev, dueDate: e.target.value }))}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>NOTES (optional)</label>
          <textarea
            value={invoiceDetails.notes}
            onChange={e => setInvoiceDetails(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional notes for the invoice..."
            rows={3}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={printInvoice}
            style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            🖨️ Print / PDF
          </button>
          <button
            onClick={handleGenerate}
            style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            ✅ Save Invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}
