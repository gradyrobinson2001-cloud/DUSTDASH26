import React, { useState, useEffect, useRef, useCallback } from "react";
import emailjs from "@emailjs/browser";

import {
  T, SERVICED_AREAS, loadPricing, savePricing, loadTemplates, saveTemplates, loadClients, saveClients,
  calcQuote, loadScheduleSettings, saveScheduleSettings, loadScheduledJobs, saveScheduledJobs,
  loadScheduleClients, saveScheduleClients, calculateDuration, generateDemoClients,
  generateScheduleForClients, wipeDemoData, loadEmailHistory, saveEmailHistory, addEmailToHistory,
  daysSince, getFollowUpStatus, EMAIL_TEMPLATES, CUSTOM_EMAIL_STYLES, getClientCoords,
  loadPayments, savePayments, loadInvoices, saveInvoices, addInvoice, getAllPhotos,
} from "./shared";

import { Toast, Modal } from "./components/ui";

// Tab components
import InboxTab from "./enquiries/InboxTab";
import QuotesTab from "./quotes/QuotesTab";
import EmailCenterTab from "./emails/EmailCenterTab";
import PaymentsTab from "./finance/PaymentsTab";
import PhotosTab from "./photos/PhotosTab";
import ToolsTab from "./tools/ToolsTab";
import CalendarTab from "./scheduling/CalendarTab";
import ClientsTab from "./clients/ClientsTab";
import TemplatesTab from "./settings/TemplatesTab";
import PricingTab from "./settings/PricingTab";
import FormTab from "./settings/FormTab";

// Modal components
import EditQuoteModal from "./modals/EditQuoteModal";
import EditPriceModal from "./modals/EditPriceModal";
import AddServiceModal from "./modals/AddServiceModal";
import AddTemplateModal from "./modals/AddTemplateModal";
import EmailPreviewModal from "./modals/EmailPreviewModal";
import ScheduleSettingsModal from "./modals/ScheduleSettingsModal";
import EditJobModal from "./modals/EditJobModal";
import EditScheduleClientModal from "./modals/EditScheduleClientModal";
import InvoiceModal from "./modals/InvoiceModal";
import QuotePreviewInline from "./modals/QuotePreviewInline";
import EmailPreviewComponent from "./modals/EmailPreviewComponent";

// ─── Config ───
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_UNIVERSAL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function Dashboard() {
  const [page, setPage] = useState("inbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Core data
  const [enquiries, setEnquiries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("db_enquiries") || "[]"); } catch { return []; }
  });
  const [quotes, setQuotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("db_quotes") || "[]"); } catch { return []; }
  });
  const [pricing, setPricing] = useState(loadPricing);
  const [templates, setTemplates] = useState(loadTemplates);
  const [clients, setClients] = useState(loadClients);

  // Scheduling
  const [scheduleSettings, setScheduleSettings] = useState(loadScheduleSettings);
  const [scheduleClients, setScheduleClients] = useState(loadScheduleClients);
  const [scheduledJobs, setScheduledJobs] = useState(loadScheduledJobs);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff)).toISOString().split("T")[0];
  });
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [editingScheduleClient, setEditingScheduleClient] = useState(null);
  const [demoMode, setDemoMode] = useState(() => loadScheduleClients().some(c => c.isDemo));

  // Email Center
  const [emailHistory, setEmailHistory] = useState(loadEmailHistory);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState("follow_up");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [customEmailStyle, setCustomEmailStyle] = useState("announcement");
  const [customEmailContent, setCustomEmailContent] = useState({ subject: "", headline: "", message: "", buttonText: "", buttonLink: "", showButton: false });
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);

  // Tools / Maps
  const [distanceFrom, setDistanceFrom] = useState("");
  const [distanceTo, setDistanceTo] = useState("");
  const [distanceResult, setDistanceResult] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [selectedRouteDate, setSelectedRouteDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [routeData, setRouteData] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [calendarTravelTimes, setCalendarTravelTimes] = useState({});

  // Finance
  const [payments, setPayments] = useState(loadPayments);
  const [invoices, setInvoices] = useState(loadInvoices);
  const [showInvoiceModal, setShowInvoiceModal] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("unpaid");

  // Photos
  const [photos, setPhotos] = useState([]);
  const [photoViewDate, setPhotoViewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // UI
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

  // ─── Effects ───
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [page, isMobile]);

  useEffect(() => {
    getAllPhotos().then(setPhotos).catch(console.error);
  }, []);

  // On load: pick up any recent form submission
  useEffect(() => {
    try {
      const raw = localStorage.getItem("db_form_submission");
      if (!raw) return;
      const data = JSON.parse(raw);
      const already = enquiries.some(e => e.details?.submittedAt === data.submittedAt && e.name === data.name);
      if (!already) {
        const enq = { id: Date.now(), name: data.name, channel: "email", suburb: data.suburb, message: `Form submitted: ${data.bedrooms} bed, ${data.bathrooms} bath, ${data.frequency} clean`, status: "info_received", timestamp: new Date().toISOString(), avatar: data.name.split(" ").map(n => n[0]).join(""), details: data, quoteId: null, archived: false };
        setEnquiries(prev => [enq, ...prev]);
        const client = { id: Date.now(), name: data.name, email: data.email, phone: data.phone, suburb: data.suburb, createdAt: new Date().toISOString(), status: "lead" };
        setClients(prev => prev.some(c => c.email === data.email) ? prev : [client, ...prev]);
        showToast(`📋 New form submission from ${data.name}!`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab: listen for form submissions
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "db_form_submission") return;
      try {
        const data = JSON.parse(e.newValue);
        const enq = { id: Date.now(), name: data.name, channel: "email", suburb: data.suburb, message: `Form submitted: ${data.bedrooms} bed, ${data.bathrooms} bath, ${data.frequency} clean`, status: "info_received", timestamp: new Date().toISOString(), avatar: data.name.split(" ").map(n => n[0]).join(""), details: data, quoteId: null, archived: false };
        setEnquiries(prev => [enq, ...prev]);
        const client = { id: Date.now(), name: data.name, email: data.email, phone: data.phone, suburb: data.suburb, createdAt: new Date().toISOString(), status: "lead" };
        setClients(prev => prev.some(c => c.email === data.email) ? prev : [client, ...prev]);
        showToast(`📋 New form submission from ${data.name}!`);
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [showToast]);

  // Persist
  useEffect(() => { try { localStorage.setItem("db_enquiries", JSON.stringify(enquiries)); } catch {} }, [enquiries]);
  useEffect(() => { try { localStorage.setItem("db_quotes", JSON.stringify(quotes)); } catch {} }, [quotes]);
  useEffect(() => { savePricing(pricing); }, [pricing]);
  useEffect(() => { saveTemplates(templates); }, [templates]);
  useEffect(() => { saveClients(clients); }, [clients]);
  useEffect(() => { saveScheduleSettings(scheduleSettings); }, [scheduleSettings]);
  useEffect(() => { saveScheduleClients(scheduleClients); setDemoMode(scheduleClients.some(c => c.isDemo)); }, [scheduleClients]);
  useEffect(() => { saveScheduledJobs(scheduledJobs); }, [scheduledJobs]);
  useEffect(() => { saveEmailHistory(emailHistory); }, [emailHistory]);
  useEffect(() => { savePayments(payments); }, [payments]);
  useEffect(() => { saveInvoices(invoices); }, [invoices]);

  // ─── Enquiry Actions ───
  const sendInfoForm = (enqId) => { setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "info_requested" } : e)); showToast("📤 Info form link sent!"); };
  const generateQuote = (enqId) => {
    const enq = enquiries.find(e => e.id === enqId);
    if (!enq?.details) return;
    const qId = `Q${String(quoteCounter.current++).padStart(3, "0")}`;
    const q = { id: qId, enquiryId: enqId, name: enq.name, channel: enq.channel, suburb: enq.suburb, frequency: enq.details.frequency.charAt(0).toUpperCase() + enq.details.frequency.slice(1), status: "pending_approval", createdAt: new Date().toISOString(), details: { ...enq.details } };
    setQuotes(prev => [q, ...prev]);
    setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "quote_ready", quoteId: qId } : e));
    showToast(`💰 Quote ${qId} generated — review & approve`);
  };
  const approveQuote = (qId) => {
    const q = quotes.find(q => q.id === qId);
    if (q) setEmailPreview({ quote: q, enquiry: enquiries.find(e => e.id === q.enquiryId) });
  };
  const sendQuoteEmail = async () => {
    if (!emailPreview) return;
    const { quote, enquiry } = emailPreview;
    const calc = calcQuote(quote.details, pricing);
    const quoteItems = calc.items.map(item => `${item.description} × ${item.qty} — $${item.total.toFixed(2)}`).join("<br>");
    setSendingEmail(true);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { customer_name: quote.name.split(" ")[0], customer_email: enquiry?.details?.email || "", frequency: quote.frequency, frequency_lower: quote.frequency.toLowerCase(), suburb: quote.suburb, quote_items: quoteItems, total: calc.total.toFixed(2), discount: calc.discount > 0 ? calc.discount.toFixed(2) : "", to_email: enquiry?.details?.email || "" }, EMAILJS_PUBLIC_KEY);
      const now = new Date().toISOString();
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: "sent" } : q));
      setEnquiries(prev => prev.map(e => e.id === quote.enquiryId ? { ...e, status: "quote_sent", quoteSentAt: now } : e));
      addEmailToHistory({ clientId: enquiry.id, recipientName: quote.name, recipientEmail: enquiry?.details?.email, templateType: "quote" });
      setEmailHistory(loadEmailHistory());
      setEmailPreview(null);
      showToast(`✅ Quote sent to ${enquiry?.details?.email}!`);
    } catch { showToast("❌ Failed to send email. Please try again."); }
    finally { setSendingEmail(false); }
  };
  const markAccepted = (qId) => {
    setQuotes(prev => prev.map(q => q.id === qId ? { ...q, status: "accepted" } : q));
    const q = quotes.find(q => q.id === qId);
    if (q) { setEnquiries(prev => prev.map(e => e.id === q.enquiryId ? { ...e, status: "accepted" } : e)); setClients(prev => prev.map(c => c.name === q.name ? { ...c, status: "client" } : c)); }
    showToast("🎉 Quote accepted — new client!");
  };
  const declineOutOfArea = (enqId) => { setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, status: "out_of_area" } : e)); showToast("📍 Out-of-area reply sent"); };
  const archiveEnquiry = (enqId) => { setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, archived: true } : e)); showToast("📦 Enquiry archived"); };
  const unarchiveEnquiry = (enqId) => { setEnquiries(prev => prev.map(e => e.id === enqId ? { ...e, archived: false } : e)); showToast("📤 Enquiry restored"); };
  const removeEnquiry = (enqId) => { if (!window.confirm("Permanently delete this enquiry?")) return; setEnquiries(prev => prev.filter(e => e.id !== enqId)); setQuotes(prev => prev.filter(q => q.enquiryId !== enqId)); showToast("🗑️ Enquiry removed"); };

  // ─── Pricing/Templates ───
  const addService = (service) => { const key = service.label.toLowerCase().replace(/\s+/g, "_"); setPricing(prev => ({ ...prev, [key]: service })); setAddServiceModal(false); showToast(`✅ ${service.label} added`); };
  const removeService = (key) => { if (!window.confirm(`Remove ${pricing[key].label}?`)) return; setPricing(prev => { const u = { ...prev }; delete u[key]; return u; }); showToast("🗑️ Service removed"); };
  const addTemplate = (template) => { setTemplates(prev => [...prev, { ...template, id: Date.now().toString(), isDefault: false }]); setAddTemplateModal(false); showToast("✅ Template added"); };
  const removeTemplate = (id) => { setTemplates(prev => prev.filter(t => t.id !== id)); showToast("🗑️ Template removed"); };
  const copyTemplate = (content) => { navigator.clipboard?.writeText(content); showToast("📋 Copied to clipboard!"); };

  // ─── Calendar/Scheduling ───
  const getWeekDates = (startDate) => Array.from({ length: 7 }, (_, i) => { const d = new Date(startDate); d.setDate(d.getDate() + i); return d.toISOString().split("T")[0]; });
  const weekDates = getWeekDates(calendarWeekStart);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const navigateWeek = (dir) => { const d = new Date(calendarWeekStart); d.setDate(d.getDate() + dir * 7); setCalendarWeekStart(d.toISOString().split("T")[0]); };
  const regenerateSchedule = (settingsToUse = scheduleSettings) => {
    const active = scheduleClients.filter(c => c.status === "active");
    if (active.length === 0) { showToast("⚠️ No active clients to schedule"); return; }
    const today = new Date(); const day = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    const end = new Date(monday); end.setDate(monday.getDate() + 13);
    const newJobs = generateScheduleForClients(active, monday.toISOString().split("T")[0], end.toISOString().split("T")[0], settingsToUse);
    setScheduledJobs([...scheduledJobs.filter(j => !j.isDemo && !j.isBreak), ...newJobs]);
    showToast(`✅ Regenerated schedule: ${newJobs.filter(j => !j.isBreak).length} jobs`);
  };
  const loadDemoData = () => {
    const demoClients = generateDemoClients(45);
    demoClients.forEach(c => {
      c.estimatedDuration = calculateDuration(c, scheduleSettings);
      const suburbLower = c.suburb.toLowerCase();
      for (const [day, suburbs] of Object.entries(scheduleSettings.areaSchedule)) {
        if (suburbs.some(s => s.toLowerCase() === suburbLower)) { c.preferredDay = day; break; }
      }
    });
    const today = new Date(); const day = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    const end = new Date(monday); end.setDate(monday.getDate() + 13);
    const demoJobs = generateScheduleForClients(demoClients, monday.toISOString().split("T")[0], end.toISOString().split("T")[0], scheduleSettings);
    setScheduleClients(prev => [...prev.filter(c => !c.isDemo), ...demoClients]);
    setScheduledJobs(prev => [...prev.filter(j => !j.isDemo), ...demoJobs]);
    showToast(`✅ Loaded ${demoClients.length} demo clients with ${demoJobs.filter(j => !j.isBreak).length} jobs`);
  };
  const wipeDemo = () => {
    if (!window.confirm("Remove all demo clients and their scheduled jobs?")) return;
    const { clients: rc, jobs: rj } = wipeDemoData();
    setScheduleClients(rc); setScheduledJobs(rj); showToast("🗑️ Demo data wiped");
  };
  const updateJob = (jobId, updates) => { setScheduledJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j)); setEditingJob(null); showToast("✅ Job updated"); };
  const deleteJob = (jobId) => { if (!window.confirm("Delete this job?")) return; setScheduledJobs(prev => prev.filter(j => j.id !== jobId)); setEditingJob(null); showToast("🗑️ Job deleted"); };
  const addNewJob = (job) => { setScheduledJobs(prev => [...prev, { ...job, id: `job_${Date.now()}` }]); showToast("✅ Job added"); };
  const updateScheduleClient = (clientId, updates) => { setScheduleClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updates } : c)); setEditingScheduleClient(null); showToast("✅ Client updated"); };
  const deleteScheduleClient = (clientId) => { if (!window.confirm("Delete this client and all their scheduled jobs?")) return; setScheduleClients(prev => prev.filter(c => c.id !== clientId)); setScheduledJobs(prev => prev.filter(j => j.clientId !== clientId)); setEditingScheduleClient(null); showToast("🗑️ Client deleted"); };

  // ─── Email Center ───
  const getFilteredEmailRecipients = useCallback(() => {
    const all = [];
    enquiries.forEach(e => {
      if (e.details?.email && !e.archived) all.push({ id: e.id, name: e.name, email: e.details.email, type: e.status === "quote_sent" ? "quote_sent" : e.status === "accepted" ? "active" : "lead", quoteSentAt: e.quoteSentAt || (e.status === "quote_sent" ? e.timestamp : null), status: e.status });
    });
    scheduleClients.forEach(c => {
      if (c.email && !all.find(r => r.email === c.email)) all.push({ id: c.id, name: c.name, email: c.email, type: "active", quoteSentAt: null, status: "active" });
    });
    switch (recipientFilter) {
      case "leads": return all.filter(r => r.type === "lead" || r.status === "new" || r.status === "info_received");
      case "quote_sent": return all.filter(r => r.type === "quote_sent" || r.status === "quote_sent");
      case "active": return all.filter(r => r.type === "active" || r.status === "accepted");
      default: return all;
    }
  }, [enquiries, scheduleClients, recipientFilter]);

  const buildEmailTemplateParams = (recipient, templateType, customContent, customStyle) => {
    const firstName = recipient.name?.split(" ")[0] || "there";
    const base = { to_email: recipient.email, customer_name: firstName, header_color: "#1B3A2D" };
    const msgs = {
      follow_up: { subject: "Just checking in! 🌿 — Dust Bunnies Cleaning", headline: "", message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just wanted to check in about the quote we sent through a few days ago...`, show_button: "", button_text: "", button_link: "" },
      review_request: { subject: "Loved your clean? We'd love a review! ⭐", headline: "We'd Love Your Feedback! ⭐", message: `Hey <strong>${firstName}</strong>! 👋<br><br>We hope you've been enjoying your sparkling clean home!`, show_button: "true", button_text: "⭐ Leave a Review", button_link: "https://g.page/r/YOUR_GOOGLE_REVIEW_LINK" },
      booking_confirmation: { subject: "You're booked in! 🎉 — Dust Bunnies Cleaning", headline: "You're All Booked In! 🎉", message: `Hey <strong>${firstName}</strong>!<br><br>Great news — you're all booked in!`, show_button: "", button_text: "", button_link: "" },
      reminder: { subject: "See you tomorrow! 🌿 — Dust Bunnies Cleaning", headline: "See You Tomorrow! 🏠✨", message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just a friendly reminder that we'll be there <strong>tomorrow</strong>!`, show_button: "", button_text: "", button_link: "" },
    };
    if (templateType === "custom") {
      const style = CUSTOM_EMAIL_STYLES[customStyle];
      return { ...base, subject: customContent.subject || "Message from Dust Bunnies Cleaning 🌿", headline: customContent.headline || "", message: (customContent.message || "").replace(/{NAME}/g, firstName).replace(/\n/g, "<br>"), show_button: customContent.showButton ? "true" : "", button_text: customContent.buttonText || "", button_link: customContent.buttonLink || "", header_color: style?.headerColor || "#1B3A2D" };
    }
    return { ...base, ...(msgs[templateType] || {}) };
  };

  const handleBulkEmailSend = async () => {
    if (selectedRecipients.length === 0) return;
    if (!window.confirm(`Send ${EMAIL_TEMPLATES[selectedEmailTemplate]?.name || "email"} to ${selectedRecipients.length} recipient${selectedRecipients.length > 1 ? "s" : ""}?`)) return;
    setSendingBulkEmail(true);
    const recipients = getFilteredEmailRecipients().filter(r => selectedRecipients.includes(r.id));
    let success = 0; let fail = 0;
    for (const r of recipients) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_UNIVERSAL_TEMPLATE_ID, buildEmailTemplateParams(r, selectedEmailTemplate, customEmailContent, customEmailStyle), EMAILJS_PUBLIC_KEY);
        addEmailToHistory({ clientId: r.id, recipientName: r.name, recipientEmail: r.email, templateType: selectedEmailTemplate, customStyle: selectedEmailTemplate === "custom" ? customEmailStyle : null });
        success++;
      } catch { fail++; }
    }
    setEmailHistory(loadEmailHistory());
    setSendingBulkEmail(false);
    setSelectedRecipients([]);
    showToast(fail === 0 ? `✅ Sent ${success} email${success > 1 ? "s" : ""}!` : `⚠️ Sent ${success}, failed ${fail}`);
  };

  // ─── Google Maps ───
  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return; }
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (page === "tools" && mapsLoaded && mapRef.current && !mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center: { lat: -26.6590, lng: 153.0800 }, zoom: 12, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
      }, 100);
    }
  }, [page, mapsLoaded]);

  useEffect(() => {
    if (routeData && mapsLoaded && page === "tools") setTimeout(() => drawRouteOnMap(), 200);
  }, [routeData, mapsLoaded, page]);

  const haversineDistance = (c1, c2) => {
    const R = 6371; const dLat = (c2.lat - c1.lat) * Math.PI / 180; const dLon = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
  };

  const calculateDistanceBetween = async (fromClient, toClient) => {
    if (!mapsLoaded || !window.google?.maps) {
      const d = haversineDistance(getClientCoords(fromClient), getClientCoords(toClient));
      const t = Math.round(d / 40 * 60);
      return { distance: d.toFixed(1), duration: t, durationText: `~${t} mins`, distanceText: `${d.toFixed(1)} km`, method: "estimate" };
    }
    return new Promise((resolve) => {
      const svc = new window.google.maps.DistanceMatrixService();
      svc.getDistanceMatrix({ origins: [fromClient.address || `${fromClient.suburb}, QLD, Australia`], destinations: [toClient.address || `${toClient.suburb}, QLD, Australia`], travelMode: window.google.maps.TravelMode.DRIVING, unitSystem: window.google.maps.UnitSystem.METRIC }, (res, status) => {
        if (status === "OK" && res.rows[0]?.elements[0]?.status === "OK") {
          const el = res.rows[0].elements[0];
          resolve({ distance: (el.distance.value / 1000).toFixed(1), duration: Math.round(el.duration.value / 60), durationText: el.duration.text, distanceText: el.distance.text, method: "google" });
        } else {
          const d = haversineDistance(getClientCoords(fromClient), getClientCoords(toClient));
          const t = Math.round(d / 40 * 60);
          resolve({ distance: d.toFixed(1), duration: t, durationText: `~${t} mins`, distanceText: `${d.toFixed(1)} km`, method: "estimate" });
        }
      });
    });
  };

  const handleDistanceCalculation = async () => {
    const from = scheduleClients.find(c => c.id === distanceFrom);
    const to = scheduleClients.find(c => c.id === distanceTo);
    if (!from || !to) return;
    setCalculatingDistance(true);
    try { const r = await calculateDistanceBetween(from, to); setDistanceResult({ ...r, from, to }); }
    catch { showToast("❌ Failed to calculate distance"); }
    finally { setCalculatingDistance(false); }
  };

  const calculateRouteForDate = async (date) => {
    const jobs = scheduledJobs.filter(j => j.date === date && !j.isBreak);
    const calc = async (teamJobs) => {
      if (teamJobs.length < 2) return { totalDistance: 0, totalDuration: 0, legs: [], jobs: teamJobs };
      const legs = []; let totalDistance = 0; let totalDuration = 0;
      for (let i = 0; i < teamJobs.length - 1; i++) {
        const fc = scheduleClients.find(c => c.id === teamJobs[i].clientId);
        const tc = scheduleClients.find(c => c.id === teamJobs[i + 1].clientId);
        if (fc && tc) { const r = await calculateDistanceBetween(fc, tc); legs.push({ from: teamJobs[i], to: teamJobs[i + 1], ...r }); totalDistance += parseFloat(r.distance); totalDuration += r.duration; }
      }
      return { totalDistance, totalDuration, legs, jobs: teamJobs };
    };
    const [teamARoute, teamBRoute] = await Promise.all([
      calc(jobs.filter(j => j.teamId === "team_a").sort((a, b) => a.startTime.localeCompare(b.startTime))),
      calc(jobs.filter(j => j.teamId === "team_b").sort((a, b) => a.startTime.localeCompare(b.startTime))),
    ]);
    setRouteData({ date, teamA: teamARoute, teamB: teamBRoute });
  };

  const drawRouteOnMap = useCallback(async () => {
    if (!mapRef.current || !routeData || !window.google?.maps) return;
    if (!mapInstanceRef.current) mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center: { lat: -26.6590, lng: 153.0800 }, zoom: 11 });
    const map = mapInstanceRef.current;
    if (window.directionsRenderers) window.directionsRenderers.forEach(r => r.setMap(null));
    window.directionsRenderers = [];
    const ds = new window.google.maps.DirectionsService();
    const bounds = new window.google.maps.LatLngBounds();
    const drawTeamRoute = (teamRoute, color) => new Promise((resolve) => {
      if (!teamRoute.jobs || teamRoute.jobs.length < 2) { resolve(); return; }
      const waypoints = teamRoute.jobs.slice(1, -1).map(job => { const c = scheduleClients.find(cl => cl.id === job.clientId); return { location: c?.address || `${job.suburb}, QLD, Australia`, stopover: true }; });
      const fc = scheduleClients.find(c => c.id === teamRoute.jobs[0].clientId);
      const lc = scheduleClients.find(c => c.id === teamRoute.jobs[teamRoute.jobs.length - 1].clientId);
      ds.route({ origin: fc?.address || `${teamRoute.jobs[0].suburb}, QLD, Australia`, destination: lc?.address || `${teamRoute.jobs[teamRoute.jobs.length - 1].suburb}, QLD, Australia`, waypoints, travelMode: window.google.maps.TravelMode.DRIVING, optimizeWaypoints: false }, (result, status) => {
        if (status === "OK") {
          const renderer = new window.google.maps.DirectionsRenderer({ map, directions: result, polylineOptions: { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.8 }, markerOptions: { icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" } } });
          window.directionsRenderers.push(renderer);
          result.routes[0].legs.forEach(leg => { bounds.extend(leg.start_location); bounds.extend(leg.end_location); });
          map.fitBounds(bounds);
        }
        resolve();
      });
    });
    const teamA = scheduleSettings.teams.find(t => t.id === "team_a");
    const teamB = scheduleSettings.teams.find(t => t.id === "team_b");
    await drawTeamRoute(routeData.teamA, teamA?.color || "#4A9E7E");
    await drawTeamRoute(routeData.teamB, teamB?.color || "#5B9EC4");
  }, [routeData, scheduleClients, scheduleSettings.teams]);

  const calculateCalendarTravelTimes = useCallback(async () => {
    if (!mapsLoaded || scheduledJobs.length === 0) return;
    const newTimes = {};
    for (const date of weekDates.slice(0, 5)) {
      for (const team of scheduleSettings.teams) {
        const teamJobs = scheduledJobs.filter(j => j.date === date && j.teamId === team.id && !j.isBreak).sort((a, b) => a.startTime.localeCompare(b.startTime));
        if (teamJobs.length < 2) continue;
        const key = `${date}_${team.id}`;
        newTimes[key] = [];
        for (let i = 0; i < teamJobs.length - 1; i++) {
          const fc = scheduleClients.find(c => c.id === teamJobs[i].clientId);
          const tc = scheduleClients.find(c => c.id === teamJobs[i + 1].clientId);
          if (fc && tc) {
            try {
              if (window.google?.maps) {
                const svc = new window.google.maps.DistanceMatrixService();
                const r = await new Promise((resolve) => { svc.getDistanceMatrix({ origins: [fc.address || `${fc.suburb}, QLD, Australia`], destinations: [tc.address || `${tc.suburb}, QLD, Australia`], travelMode: window.google.maps.TravelMode.DRIVING, unitSystem: window.google.maps.UnitSystem.METRIC }, (res, status) => { if (status === "OK" && res.rows[0]?.elements[0]?.status === "OK") { const el = res.rows[0].elements[0]; resolve({ distance: (el.distance.value / 1000).toFixed(1), duration: Math.round(el.duration.value / 60) }); } else { resolve({ distance: "?", duration: "?" }); } }); });
                newTimes[key].push({ from: teamJobs[i].clientId, to: teamJobs[i + 1].clientId, ...r });
              }
            } catch { newTimes[key].push({ distance: "?", duration: "?" }); }
          }
        }
      }
    }
    setCalendarTravelTimes(newTimes);
    showToast("✅ Travel times calculated");
  }, [mapsLoaded, scheduledJobs, scheduleClients, scheduleSettings.teams, weekDates, showToast]);

  // ─── Derived state ───
  const archivedCount = enquiries.filter(e => e.archived).length;
  const quotesNeedingFollowUp = enquiries.filter(e => e.status === "quote_sent" && daysSince(e.quoteSentAt || e.timestamp) >= 3);
  const unpaidJobsCount = scheduledJobs.filter(j => j.status === "completed" && j.paymentStatus !== "paid").length;
  const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");

  const navGroups = [
    {
      label: "Work",
      items: [
        { id: "inbox", label: "Inbox", icon: "📥", badge: enquiries.filter(e => !e.archived && ["new", "info_received", "quote_ready"].includes(e.status)).length },
        { id: "quotes", label: "Quotes", icon: "💰", badge: quotes.filter(q => q.status === "pending_approval").length },
        { id: "calendar", label: "Calendar", icon: "📅", badge: 0 },
        { id: "emails", label: "Email Center", icon: "📧", badge: quotesNeedingFollowUp.length },
      ],
    },
    {
      label: "Finance",
      items: [
        { id: "payments", label: "Payments", icon: "💳", badge: unpaidJobsCount },
        { id: "photos", label: "Job Photos", icon: "📸", badge: 0 },
      ],
    },
    {
      label: "Route & Maps",
      items: [
        { id: "tools", label: "Distance Tools", icon: "🗺️", badge: 0 },
      ],
    },
    {
      label: "Clients",
      items: [
        { id: "clients", label: "Client List", icon: "👥", badge: clients.length },
      ],
    },
    {
      label: "Admin",
      items: [
        { id: "templates", label: "Templates", icon: "💬", badge: 0 },
        { id: "form", label: "Customer Form", icon: "📋", badge: 0 },
        { id: "pricing", label: "Pricing", icon: "⚙️", badge: 0 },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
      {/* Mobile Header */}
      {isMobile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 60, background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 100 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer", padding: 8 }}>{sidebarOpen ? "✕" : "☰"}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>🌿</span><span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Dust Bunnies</span></div>
          <div style={{ width: 40 }} />
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: isMobile ? "100%" : 240, maxWidth: isMobile ? 280 : 240, background: T.sidebar, padding: "24px 16px", display: "flex", flexDirection: "column", position: "fixed", top: isMobile ? 60 : 0, left: isMobile ? (sidebarOpen ? 0 : -300) : 0, height: isMobile ? "calc(100vh - 60px)" : "100vh", zIndex: 99, transition: "left 0.3s ease", boxShadow: isMobile && sidebarOpen ? "4px 0 20px rgba(0,0,0,0.3)" : "none" }}>
        {!isMobile && (
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🌿</div>
            <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0 }}>Dust Bunnies</h2>
            <p style={{ color: "#8FBFA8", fontSize: 11, margin: "2px 0 0" }}>Admin Dashboard</p>
          </div>
        )}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, overflowY: "auto" }}>
          {navGroups.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#4A7A62", textTransform: "uppercase", letterSpacing: 1, padding: "10px 14px 4px" }}>
                {group.label}
              </div>
              {group.items.map(n => (
                <button key={n.id} onClick={() => { setPage(n.id); if (isMobile) setSidebarOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: T.radiusSm, background: page === n.id ? "rgba(255,255,255,0.12)" : "transparent", border: "none", cursor: "pointer", color: page === n.id ? "#fff" : "#8FBFA8", fontSize: 14, fontWeight: 600, textAlign: "left", width: "100%", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {n.badge > 0 && <span style={{ background: T.accent, color: T.sidebar, padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{n.badge}</span>}
                </button>
              ))}
              {gi < navGroups.length - 1 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 14px 0" }} />
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 98 }} />}

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : 240, marginTop: isMobile ? 60 : 0, padding: isMobile ? 16 : 28, maxWidth: isMobile ? "100%" : 960, width: "100%", boxSizing: "border-box" }}>

        {page === "inbox" && <InboxTab enquiries={enquiries} quotes={quotes} filter={filter} setFilter={setFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} quotesNeedingFollowUp={quotesNeedingFollowUp} archivedCount={archivedCount} isMobile={isMobile} setPage={setPage} setSelectedEnquiry={setSelectedEnquiry} setSelectedRecipients={setSelectedRecipients} sendInfoForm={sendInfoForm} generateQuote={generateQuote} declineOutOfArea={declineOutOfArea} archiveEnquiry={archiveEnquiry} unarchiveEnquiry={unarchiveEnquiry} removeEnquiry={removeEnquiry} />}

        {page === "quotes" && <QuotesTab quotes={quotes} pricing={pricing} isMobile={isMobile} setEditQuoteModal={setEditQuoteModal} setPreviewQuote={setPreviewQuote} approveQuote={approveQuote} markAccepted={markAccepted} />}

        {page === "emails" && <EmailCenterTab emailHistory={emailHistory} quotesNeedingFollowUp={quotesNeedingFollowUp} selectedEmailTemplate={selectedEmailTemplate} setSelectedEmailTemplate={setSelectedEmailTemplate} selectedRecipients={selectedRecipients} setSelectedRecipients={setSelectedRecipients} recipientFilter={recipientFilter} setRecipientFilter={setRecipientFilter} customEmailStyle={customEmailStyle} setCustomEmailStyle={setCustomEmailStyle} customEmailContent={customEmailContent} setCustomEmailContent={setCustomEmailContent} showEmailPreview={showEmailPreview} setShowEmailPreview={setShowEmailPreview} sendingBulkEmail={sendingBulkEmail} handleBulkEmailSend={handleBulkEmailSend} getFilteredEmailRecipients={getFilteredEmailRecipients} EmailPreviewComponent={EmailPreviewComponent} isMobile={isMobile} />}

        {page === "payments" && <PaymentsTab scheduledJobs={scheduledJobs} setScheduledJobs={setScheduledJobs} scheduleClients={scheduleClients} invoices={invoices} setInvoices={setInvoices} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} setShowInvoiceModal={setShowInvoiceModal} showToast={showToast} isMobile={isMobile} />}

        {page === "photos" && <PhotosTab photos={photos} setPhotos={setPhotos} photoViewDate={photoViewDate} setPhotoViewDate={setPhotoViewDate} selectedPhoto={selectedPhoto} setSelectedPhoto={setSelectedPhoto} scheduledJobs={scheduledJobs} scheduleSettings={scheduleSettings} showToast={showToast} isMobile={isMobile} />}

        {page === "tools" && <ToolsTab scheduleClients={scheduleClients} scheduledJobs={scheduledJobs} scheduleSettings={scheduleSettings} mapsLoaded={mapsLoaded} mapRef={mapRef} distanceFrom={distanceFrom} setDistanceFrom={setDistanceFrom} distanceTo={distanceTo} setDistanceTo={setDistanceTo} distanceResult={distanceResult} calculatingDistance={calculatingDistance} handleDistanceCalculation={handleDistanceCalculation} selectedRouteDate={selectedRouteDate} setSelectedRouteDate={setSelectedRouteDate} calculateRouteForDate={calculateRouteForDate} routeData={routeData} isMobile={isMobile} />}

        {page === "calendar" && <CalendarTab scheduledJobs={scheduledJobs} scheduleClients={scheduleClients} scheduleSettings={scheduleSettings} weekDates={weekDates} calendarWeekStart={calendarWeekStart} calendarTravelTimes={calendarTravelTimes} demoMode={demoMode} mapsLoaded={mapsLoaded} isMobile={isMobile} navigateWeek={navigateWeek} regenerateSchedule={regenerateSchedule} calculateCalendarTravelTimes={calculateCalendarTravelTimes} setShowScheduleSettings={setShowScheduleSettings} setEditingJob={setEditingJob} setEditingScheduleClient={setEditingScheduleClient} loadDemoData={loadDemoData} wipeDemo={wipeDemo} formatDate={formatDate} />}

        {page === "clients" && <ClientsTab clients={clients} clientSearch={clientSearch} setClientSearch={setClientSearch} isMobile={isMobile} />}

        {page === "templates" && <TemplatesTab templates={templates} copyTemplate={copyTemplate} removeTemplate={removeTemplate} setAddTemplateModal={setAddTemplateModal} isMobile={isMobile} />}

        {page === "form" && <FormTab showToast={showToast} isMobile={isMobile} />}

        {page === "pricing" && <PricingTab pricing={pricing} setEditPriceModal={setEditPriceModal} setAddServiceModal={setAddServiceModal} removeService={removeService} isMobile={isMobile} />}
      </div>

      {/* ═══ MODALS ═══ */}

      {selectedEnquiry && (
        <Modal title={`${selectedEnquiry.name}'s Details`} onClose={() => setSelectedEnquiry(null)}>
          {selectedEnquiry.details && (
            <>
              <div style={{ background: T.blueLight, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, marginBottom: 8, textTransform: "uppercase" }}>Contact Info</div>
                {selectedEnquiry.details.email && <a href={`mailto:${selectedEnquiry.details.email}`} style={{ fontSize: 14, color: T.text, textDecoration: "none", display: "block" }}>📧 {selectedEnquiry.details.email}</a>}
                {selectedEnquiry.details.phone && <a href={`tel:${selectedEnquiry.details.phone}`} style={{ fontSize: 14, color: T.text, textDecoration: "none", display: "block" }}>📱 {selectedEnquiry.details.phone}</a>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                {Object.entries({ Bedrooms: selectedEnquiry.details.bedrooms, Bathrooms: selectedEnquiry.details.bathrooms, "Living Rooms": selectedEnquiry.details.living, Kitchens: selectedEnquiry.details.kitchen, Frequency: selectedEnquiry.details.frequency }).map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div><div style={{ fontWeight: 700, color: T.text }}>{v}</div></div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Add-ons Selected</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {addonServices.map(([key, service]) => { const isActive = selectedEnquiry.details[key]; if (!isActive) return null; const qty = service.hasQuantity ? selectedEnquiry.details[`${key}Count`] : null; return <span key={key} style={{ padding: "6px 12px", borderRadius: 8, background: T.primaryLight, color: T.primaryDark, fontSize: 12, fontWeight: 600 }}>{service.icon} {service.label}{qty ? ` (${qty})` : ""}</span>; })}
                  {!addonServices.some(([key]) => selectedEnquiry.details[key]) && <span style={{ color: T.textLight, fontSize: 13 }}>None selected</span>}
                </div>
              </div>
              {selectedEnquiry.details.notes && <div style={{ marginTop: 16, padding: "12px 16px", background: T.bg, borderRadius: T.radiusSm }}><div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>NOTES</div><div style={{ fontSize: 13, color: T.text }}>{selectedEnquiry.details.notes}</div></div>}
            </>
          )}
        </Modal>
      )}

      {editQuoteModal && <EditQuoteModal quote={editQuoteModal} pricing={pricing} onSave={(updated) => { setQuotes(prev => prev.map(q => q.id === updated.id ? updated : q)); setEditQuoteModal(null); showToast("✏️ Quote updated"); }} onClose={() => setEditQuoteModal(null)} />}
      {editPriceModal && <EditPriceModal serviceKey={editPriceModal} pricing={pricing} onSave={(key, newPrice) => { setPricing(prev => ({ ...prev, [key]: { ...prev[key], price: newPrice } })); setEditPriceModal(null); showToast(`💰 ${pricing[editPriceModal].label} price updated to $${newPrice}`); }} onClose={() => setEditPriceModal(null)} />}
      {addServiceModal && <AddServiceModal onSave={addService} onClose={() => setAddServiceModal(false)} />}
      {addTemplateModal && <AddTemplateModal onSave={addTemplate} onClose={() => setAddTemplateModal(false)} />}
      {previewQuote && <Modal title="Quote Preview" onClose={() => setPreviewQuote(null)} wide><QuotePreviewInline quote={previewQuote} pricing={pricing} /><button onClick={() => setPreviewQuote(null)} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.textMuted }}>Close</button></Modal>}
      {emailPreview && <EmailPreviewModal quote={emailPreview.quote} enquiry={emailPreview.enquiry} pricing={pricing} onSend={sendQuoteEmail} onClose={() => setEmailPreview(null)} sending={sendingEmail} />}
      {showScheduleSettings && <ScheduleSettingsModal settings={scheduleSettings} onSave={(updated) => { setScheduleSettings(updated); setShowScheduleSettings(false); showToast("✅ Settings saved"); }} onSaveAndRegenerate={(updated) => { setScheduleSettings(updated); setShowScheduleSettings(false); setTimeout(() => regenerateSchedule(updated), 100); }} onClose={() => setShowScheduleSettings(false)} />}
      {editingJob && <EditJobModal job={editingJob} clients={scheduleClients} settings={scheduleSettings} onSave={editingJob.isNew ? addNewJob : (updates) => updateJob(editingJob.id, updates)} onDelete={editingJob.isNew ? null : () => deleteJob(editingJob.id)} onClose={() => setEditingJob(null)} />}
      {editingScheduleClient && <EditScheduleClientModal client={editingScheduleClient} settings={scheduleSettings} onSave={editingScheduleClient.id ? (updates) => updateScheduleClient(editingScheduleClient.id, updates) : (newClient) => { const c = { ...newClient, id: `client_${Date.now()}`, isDemo: false, createdAt: new Date().toISOString(), status: "active" }; c.estimatedDuration = calculateDuration(c, scheduleSettings); setScheduleClients(prev => [...prev, c]); setEditingScheduleClient(null); showToast("✅ Client added"); }} onDelete={editingScheduleClient.id ? () => deleteScheduleClient(editingScheduleClient.id) : null} onClose={() => setEditingScheduleClient(null)} />}
      {showInvoiceModal && <InvoiceModal job={showInvoiceModal} client={scheduleClients.find(c => c.id === showInvoiceModal.clientId)} pricing={pricing} onGenerate={(invoice) => { const newInvoice = addInvoice(invoice); setInvoices(loadInvoices()); setShowInvoiceModal(null); showToast(`✅ Invoice ${newInvoice.invoiceNumber} created`); }} onClose={() => setShowInvoiceModal(null)} />}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        button:hover:not(:disabled) { opacity: 0.9; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
