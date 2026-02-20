import React, { useState, useEffect, useRef, useCallback } from "react";
import emailjs from "@emailjs/browser";

import {
  T, SERVICED_AREAS, calcQuote, calculateDuration, generateDemoClients,
  generateScheduleForClients, wipeDemoData, daysSince, getFollowUpStatus,
  EMAIL_TEMPLATES, CUSTOM_EMAIL_STYLES, getClientCoords, addInvoice, getAllPhotos,
} from "./shared";

import { supabase, supabaseReady } from "./lib/supabase";
import { useAuth } from "./auth/AuthProvider";

// Data hooks
import { useClients }          from "./hooks/useClients";
import { useEnquiries }        from "./hooks/useEnquiries";
import { useQuotes }           from "./hooks/useQuotes";
import { useScheduledJobs }    from "./hooks/useScheduledJobs";
import { useInvoices }         from "./hooks/useInvoices";
import { useEmailHistory }     from "./hooks/useEmailHistory";
import { usePricing }          from "./hooks/usePricing";
import { useTemplates }        from "./hooks/useTemplates";
import { useScheduleSettings } from "./hooks/useScheduleSettings";
import { usePhotos }           from "./hooks/usePhotos";
import { useProfiles }         from "./hooks/useProfiles";

import { Toast, Modal } from "./components/ui";

// Tab components
import InboxTab        from "./enquiries/InboxTab";
import QuotesTab       from "./quotes/QuotesTab";
import EmailCenterTab  from "./emails/EmailCenterTab";
import PaymentsTab     from "./finance/PaymentsTab";
import PayrollTab      from "./finance/PayrollTab";
import PhotosTab       from "./photos/PhotosTab";
import ToolsTab        from "./tools/ToolsTab";
import CalendarTab     from "./scheduling/CalendarTab";
import RotaTab         from "./scheduling/RotaTab";
import ClientsTab      from "./clients/ClientsTab";
import TemplatesTab    from "./settings/TemplatesTab";
import PricingTab      from "./settings/PricingTab";
import FormTab         from "./settings/FormTab";
import StaffTab        from "./settings/StaffTab";

// Modal components
import EditQuoteModal          from "./modals/EditQuoteModal";
import EditPriceModal          from "./modals/EditPriceModal";
import AddServiceModal         from "./modals/AddServiceModal";
import AddTemplateModal        from "./modals/AddTemplateModal";
import EmailPreviewModal       from "./modals/EmailPreviewModal";
import ScheduleSettingsModal   from "./modals/ScheduleSettingsModal";
import EditJobModal            from "./modals/EditJobModal";
import EditScheduleClientModal from "./modals/EditScheduleClientModal";
import InvoiceModal            from "./modals/InvoiceModal";
import QuotePreviewInline      from "./modals/QuotePreviewInline";
import EmailPreviewComponent   from "./modals/EmailPreviewComponent";

// ─── Config ───
const EMAILJS_SERVICE_ID           = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID          = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_UNIVERSAL_TEMPLATE_ID= import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY           = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const GOOGLE_MAPS_API_KEY          = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function Dashboard() {
  const { profile, signOut } = useAuth();

  // ─── Data from hooks (Supabase or localStorage fallback) ───
  const { clients,  addClient,  updateClient,  removeClient }          = useClients();
  const { enquiries, setEnquiries, addEnquiry, updateEnquiry, removeEnquiry } = useEnquiries();
  const { quotes,   setQuotes,  addQuote,    updateQuote }             = useQuotes();
  const { scheduledJobs, setScheduledJobs, addJob, updateJob: updateJobDB, removeJob, bulkUpsertJobs, publishWeek, unpublishWeek } = useScheduledJobs();
  const { invoices, setInvoices, addInvoice: addInvoiceDB, updateInvoice } = useInvoices();
  const { emailHistory, setEmailHistory, addEmailHistory }             = useEmailHistory();
  const { pricing,  setPricing }                                        = usePricing();
  const { templates, addTemplate: addTemplateDB, removeTemplate: removeTemplateDB, saveAllTemplates } = useTemplates();
  const { scheduleSettings, setScheduleSettings }                      = useScheduleSettings();
  const { photos,  uploadPhoto }                                        = usePhotos();
  const { staffMembers }                                                = useProfiles();

  // scheduleClients = active clients with scheduling info (subset of clients)
  const scheduleClients = clients.filter(c => c.status === "active");

  // ─── UI State ───
  const [page, setPage]               = useState("inbox");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [openGroups, setOpenGroups]   = useState(() => new Set(["Work", "Finance", "Route & Maps", "Clients", "Admin"]));
  const [toast, setToast]             = useState(null);
  const [filter, setFilter]           = useState("active");
  const [searchTerm, setSearchTerm]   = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Calendar
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const today = new Date(); const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff)).toISOString().split("T")[0];
  });
  const [calendarTravelTimes, setCalendarTravelTimes] = useState({});
  const [demoMode, setDemoMode] = useState(false);

  // Email Center
  const [selectedEmailTemplate, setSelectedEmailTemplate]   = useState("follow_up");
  const [selectedRecipients,    setSelectedRecipients]       = useState([]);
  const [recipientFilter,       setRecipientFilter]          = useState("all");
  const [customEmailStyle,      setCustomEmailStyle]         = useState("announcement");
  const [customEmailContent,    setCustomEmailContent]       = useState({ subject: "", headline: "", message: "", buttonText: "", buttonLink: "", showButton: false });
  const [showEmailPreview,      setShowEmailPreview]         = useState(false);
  const [sendingBulkEmail,      setSendingBulkEmail]         = useState(false);

  // Tools / Maps
  const [distanceFrom,       setDistanceFrom]       = useState("");
  const [distanceTo,         setDistanceTo]         = useState("");
  const [distanceResult,     setDistanceResult]     = useState(null);
  const [calculatingDistance,setCalculatingDistance]= useState(false);
  const [selectedRouteDate,  setSelectedRouteDate]  = useState(() => new Date().toISOString().split("T")[0]);
  const [routeData,          setRouteData]           = useState(null);
  const [mapsLoaded,         setMapsLoaded]          = useState(false);
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);

  // Finance
  const [showInvoiceModal, setShowInvoiceModal] = useState(null);
  const [paymentFilter,    setPaymentFilter]    = useState("unpaid");

  // Photos UI
  const [photoViewDate, setPhotoViewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Modals
  const [selectedEnquiry,        setSelectedEnquiry]        = useState(null);
  const [editQuoteModal,         setEditQuoteModal]          = useState(null);
  const [editPriceModal,         setEditPriceModal]          = useState(null);
  const [addServiceModal,        setAddServiceModal]         = useState(false);
  const [addTemplateModal,       setAddTemplateModal]        = useState(false);
  const [previewQuote,           setPreviewQuote]            = useState(null);
  const [emailPreview,           setEmailPreview]            = useState(null);
  const [sendingEmail,           setSendingEmail]            = useState(false);
  const [showScheduleSettings,   setShowScheduleSettings]    = useState(false);
  const [editingJob,             setEditingJob]              = useState(null);
  const [editingScheduleClient,  setEditingScheduleClient]   = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);
  const getAccessToken = useCallback(async () => {
    if (!supabaseReady || !supabase) throw new Error("Supabase auth is not configured.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || "Failed to load auth session.");
    const token = data?.session?.access_token;
    if (!token) throw new Error("Admin session required. Please sign in again.");
    return token;
  }, []);

  const callSecureQuoteApi = useCallback(async (path, payload) => {
    const token = await getAccessToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    let body = {};
    try { body = await res.json(); } catch {}

    if (!res.ok || body?.error) {
      const message = body?.error || body?.details || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return body;
  }, [getAccessToken]);

  // ─── Effects ───
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [page, isMobile]);

  // Auto-expand the group that contains the active page
  useEffect(() => {
    const activeGroup = navGroups.find(g => g.items.some(i => i.id === page));
    if (activeGroup) setOpenGroups(prev => new Set([...prev, activeGroup.label]));
  }, [page]);

  // Realtime: listen for new form submissions (Supabase will push via hook subscription)
  // The useEnquiries hook already subscribes to postgres_changes on enquiries table.
  // Show a toast when enquiries count increases.
  const prevEnqCount = useRef(enquiries.length);
  useEffect(() => {
    if (enquiries.length > prevEnqCount.current) {
      showToast(`📋 New enquiry received!`);
    }
    prevEnqCount.current = enquiries.length;
  }, [enquiries.length]);

  // Google Maps
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
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: -26.6590, lng: 153.0800 }, zoom: 12,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
      }, 100);
    }
  }, [page, mapsLoaded]);

  useEffect(() => {
    if (routeData && mapsLoaded && page === "tools") setTimeout(() => drawRouteOnMap(), 200);
  }, [routeData, mapsLoaded, page]);

  // ─── Enquiry Actions ───
  const sendInfoForm = (enqId) => {
    updateEnquiry(enqId, { status: "info_requested" });
    showToast("📤 Info form link sent!");
  };

  const generateQuote = async (enqId) => {
    const enq = enquiries.find(e => e.id === enqId);
    if (!enq) {
      showToast("❌ Enquiry not found");
      return;
    }
    if (!enq.details) {
      console.warn("[quote:create] enquiry has no details", { enqId });
      showToast("⚠️ Enquiry has no form details yet");
      return;
    }
    try {
      const result = await callSecureQuoteApi("/api/quotes/create", { enquiryId: enqId });
      const quoteId = result?.quote?.id || "new";
      showToast(`💰 Quote ${quoteId} generated — review & approve`);
    } catch (err) {
      console.error("[quote:create] failed", { enqId, error: err });
      showToast(`❌ Failed to generate quote: ${err.message}`);
    }
  };

  const approveQuote = (qId) => {
    const q = quotes.find(q => q.id === qId);
    if (q) setEmailPreview({ quote: q, enquiry: enquiries.find(e => e.id === (q.enquiry_id || q.enquiryId)) });
  };

  const sendQuoteEmail = async () => {
    if (!emailPreview) return;
    const { quote, enquiry } = emailPreview;
    const calc = calcQuote(quote.details, pricing);
    const quoteItems = calc.items.map(item => `${item.description} × ${item.qty} — $${item.total.toFixed(2)}`).join("<br>");
    setSendingEmail(true);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        customer_name: quote.name.split(" ")[0],
        customer_email: enquiry?.details?.email || "",
        frequency: quote.frequency,
        frequency_lower: quote.frequency?.toLowerCase(),
        suburb: quote.suburb,
        quote_items: quoteItems,
        total: calc.total.toFixed(2),
        discount: calc.discount > 0 ? calc.discount.toFixed(2) : "",
        to_email: enquiry?.details?.email || "",
      }, EMAILJS_PUBLIC_KEY);
      const now = new Date().toISOString();
      await callSecureQuoteApi("/api/quotes/mark-sent", { quoteId: quote.id, sentAt: now });
      try {
        await addEmailHistory({ client_id: enquiry.id, recipient_name: quote.name, recipient_email: enquiry?.details?.email, template_type: "quote" });
      } catch (historyErr) {
        console.error("[quote:mark-sent] email sent but failed to save history", historyErr);
      }
      setEmailPreview(null);
      showToast(`✅ Quote sent to ${enquiry?.details?.email}!`);
    } catch (err) {
      console.error("[quote:send-email] failed", err);
      showToast(`❌ Failed to send email: ${err.message || "Please try again."}`);
    }
    finally { setSendingEmail(false); }
  };

  const markAccepted = async (qId) => {
    try {
      const result = await callSecureQuoteApi("/api/quotes/accept", { quoteId: qId });
      const clientName = result?.client?.name;
      showToast(clientName ? `🎉 Quote accepted — ${clientName} is now a client` : "🎉 Quote accepted — new client!");
    } catch (err) {
      console.error("[quote:accept] failed", { qId, error: err });
      showToast(`❌ Failed to mark accepted: ${err.message}`);
    }
  };

  const declineOutOfArea = (enqId) => {
    updateEnquiry(enqId, { status: "out_of_area" });
    showToast("📍 Out-of-area reply sent");
  };

  const archiveEnquiry = (enqId) => {
    updateEnquiry(enqId, { archived: true });
    showToast("📦 Enquiry archived");
  };

  const unarchiveEnquiry = (enqId) => {
    updateEnquiry(enqId, { archived: false });
    showToast("📤 Enquiry restored");
  };

  const handleRemoveEnquiry = async (enqId) => {
    if (!window.confirm("Permanently delete this enquiry?")) return;
    await removeEnquiry(enqId);
    showToast("🗑️ Enquiry removed");
  };

  // ─── Pricing/Templates ───
  const addService = async (service) => {
    const key = service.label.toLowerCase().replace(/\s+/g, "_");
    const updated = { ...pricing, [key]: service };
    await setPricing(updated);
    setAddServiceModal(false);
    showToast(`✅ ${service.label} added`);
  };

  const removeService = async (key) => {
    if (!window.confirm(`Remove ${pricing[key].label}?`)) return;
    const updated = { ...pricing };
    delete updated[key];
    await setPricing(updated);
    showToast("🗑️ Service removed");
  };

  const addTemplate = async (template) => {
    await addTemplateDB({ ...template, is_default: false });
    setAddTemplateModal(false);
    showToast("✅ Template added");
  };

  const removeTemplate = async (id) => {
    await removeTemplateDB(id);
    showToast("🗑️ Template removed");
  };

  const copyTemplate = (content) => {
    navigator.clipboard?.writeText(content);
    showToast("📋 Copied to clipboard!");
  };

  // ─── Calendar/Scheduling ───
  const getWeekDates = (startDate) => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate); d.setDate(d.getDate() + i); return d.toISOString().split("T")[0];
  });
  const weekDates = getWeekDates(calendarWeekStart);
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const navigateWeek = (dir) => {
    const d = new Date(calendarWeekStart);
    d.setDate(d.getDate() + dir * 7);
    setCalendarWeekStart(d.toISOString().split("T")[0]);
  };

  const regenerateSchedule = async (settingsToUse = scheduleSettings) => {
    const active = scheduleClients.filter(c => c.status === "active");
    if (active.length === 0) { showToast("⚠️ No active clients to schedule"); return; }
    const today = new Date(); const day = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
    const end = new Date(monday); end.setDate(monday.getDate() + 13);
    const newJobs = generateScheduleForClients(active, monday.toISOString().split("T")[0], end.toISOString().split("T")[0], settingsToUse);
    const existing = scheduledJobs.filter(j => !j.isDemo && !j.is_demo && !j.isBreak && !j.is_break);
    await bulkUpsertJobs([...existing, ...newJobs]);
    showToast(`✅ Regenerated schedule: ${newJobs.filter(j => !j.isBreak).length} jobs`);
  };

  const loadDemoData = async () => {
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
    // Add demo clients and jobs
    for (const c of demoClients) {
      try { await addClient({ ...c, is_demo: true }); } catch {}
    }
    const existingNonDemo = scheduledJobs.filter(j => !j.isDemo && !j.is_demo);
    await bulkUpsertJobs([...existingNonDemo, ...demoJobs]);
    setDemoMode(true);
    showToast(`✅ Loaded ${demoClients.length} demo clients`);
  };

  const wipeDemo = async () => {
    if (!window.confirm("Remove all demo clients and their scheduled jobs?")) return;
    for (const c of clients.filter(c => c.is_demo || c.isDemo)) {
      try { await removeClient(c.id); } catch {}
    }
    for (const j of scheduledJobs.filter(j => j.is_demo || j.isDemo)) {
      try { await removeJob(j.id); } catch {}
    }
    setDemoMode(false);
    showToast("🗑️ Demo data wiped");
  };

  const updateJob = async (jobId, updates) => {
    try {
      await updateJobDB(jobId, updates);
      setEditingJob(null);
      showToast("✅ Job updated");
    } catch (err) {
      console.error("[calendar:update-job] failed", { jobId, updates, error: err });
      showToast(`❌ Failed to update job: ${err.message}`);
      throw err;
    }
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm("Delete this job?")) return;
    await removeJob(jobId);
    setEditingJob(null);
    showToast("🗑️ Job deleted");
  };

  const addNewJob = async (job) => {
    try {
      await addJob(job);
      showToast("✅ Job added");
    } catch (err) {
      console.error("[calendar:add-job] failed", { job, error: err });
      showToast(`❌ Failed to add job: ${err.message}`);
      throw err;
    }
  };

  const updateScheduleClient = async (clientId, updates) => {
    await updateClient(clientId, updates);
    setEditingScheduleClient(null);
    showToast("✅ Client updated");
  };

  const deleteScheduleClient = async (clientId) => {
    if (!window.confirm("Delete this client and all their scheduled jobs?")) return;
    await removeClient(clientId);
    for (const j of scheduledJobs.filter(j => j.clientId === clientId || j.client_id === clientId)) {
      await removeJob(j.id);
    }
    setEditingScheduleClient(null);
    showToast("🗑️ Client deleted");
  };

  // ─── Email Center ───
  const getFilteredEmailRecipients = useCallback(() => {
    const all = [];
    enquiries.forEach(e => {
      if (e.details?.email && !e.archived) all.push({
        id: e.id, name: e.name, email: e.details.email,
        type: e.status === "quote_sent" ? "quote_sent" : e.status === "accepted" ? "active" : "lead",
        quoteSentAt: e.quote_sent_at || e.quoteSentAt || null, status: e.status,
      });
    });
    scheduleClients.forEach(c => {
      if (c.email && !all.find(r => r.email === c.email))
        all.push({ id: c.id, name: c.name, email: c.email, type: "active", quoteSentAt: null, status: "active" });
    });
    switch (recipientFilter) {
      case "leads":      return all.filter(r => r.type === "lead" || ["new","info_received"].includes(r.status));
      case "quote_sent": return all.filter(r => r.type === "quote_sent" || r.status === "quote_sent");
      case "active":     return all.filter(r => r.type === "active" || r.status === "accepted");
      default:           return all;
    }
  }, [enquiries, scheduleClients, recipientFilter]);

  const buildEmailTemplateParams = (recipient, templateType, customContent, customStyle) => {
    const firstName = recipient.name?.split(" ")[0] || "there";
    const base = { to_email: recipient.email, customer_name: firstName, header_color: "#1B3A2D" };
    const msgs = {
      follow_up:           { subject: "Just checking in! 🌿 — Dust Bunnies Cleaning", headline: "", message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just wanted to check in about the quote we sent through...`, show_button: "", button_text: "", button_link: "" },
      review_request:      { subject: "Loved your clean? We'd love a review! ⭐", headline: "We'd Love Your Feedback! ⭐", message: `Hey <strong>${firstName}</strong>! 👋<br><br>We hope you've been enjoying your sparkling clean home!`, show_button: "true", button_text: "⭐ Leave a Review", button_link: "https://g.page/r/YOUR_GOOGLE_REVIEW_LINK" },
      booking_confirmation:{ subject: "You're booked in! 🎉 — Dust Bunnies Cleaning", headline: "You're All Booked In! 🎉", message: `Hey <strong>${firstName}</strong>!<br><br>Great news — you're all booked in!`, show_button: "", button_text: "", button_link: "" },
      reminder:            { subject: "See you tomorrow! 🌿 — Dust Bunnies Cleaning", headline: "See You Tomorrow! 🏠✨", message: `Hey <strong>${firstName}</strong>! 👋<br><br>Just a friendly reminder that we'll be there <strong>tomorrow</strong>!`, show_button: "", button_text: "", button_link: "" },
    };
    if (templateType === "custom") {
      const style = CUSTOM_EMAIL_STYLES[customStyle];
      return { ...base, subject: customContent.subject || "Message from Dust Bunnies Cleaning 🌿", headline: customContent.headline || "", message: (customContent.message || "").replace(/{NAME}/g, firstName).replace(/\n/g, "<br>"), show_button: customContent.showButton ? "true" : "", button_text: customContent.buttonText || "", button_link: customContent.buttonLink || "", header_color: style?.headerColor || "#1B3A2D" };
    }
    return { ...base, ...(msgs[templateType] || {}) };
  };

  const handleBulkEmailSend = async () => {
    if (selectedRecipients.length === 0) return;
    if (!window.confirm(`Send ${EMAIL_TEMPLATES[selectedEmailTemplate]?.name || "email"} to ${selectedRecipients.length} recipient(s)?`)) return;
    setSendingBulkEmail(true);
    const recipients = getFilteredEmailRecipients().filter(r => selectedRecipients.includes(r.id));
    let success = 0, fail = 0;
    for (const r of recipients) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_UNIVERSAL_TEMPLATE_ID, buildEmailTemplateParams(r, selectedEmailTemplate, customEmailContent, customEmailStyle), EMAILJS_PUBLIC_KEY);
        await addEmailHistory({ client_id: r.id, recipient_name: r.name, recipient_email: r.email, template_type: selectedEmailTemplate, custom_style: selectedEmailTemplate === "custom" ? customEmailStyle : null });
        success++;
      } catch { fail++; }
    }
    setSendingBulkEmail(false);
    setSelectedRecipients([]);
    showToast(fail === 0 ? `✅ Sent ${success} email${success > 1 ? "s" : ""}!` : `⚠️ Sent ${success}, failed ${fail}`);
  };

  // ─── Google Maps ───
  const haversineDistance = (c1, c2) => {
    const R = 6371; const dLat = (c2.lat - c1.lat) * Math.PI / 180; const dLon = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(c1.lat*Math.PI/180)*Math.cos(c2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3;
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
          resolve({ distance: (el.distance.value/1000).toFixed(1), duration: Math.round(el.duration.value/60), durationText: el.duration.text, distanceText: el.distance.text, method: "google" });
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
    const to   = scheduleClients.find(c => c.id === distanceTo);
    if (!from || !to) return;
    setCalculatingDistance(true);
    try { const r = await calculateDistanceBetween(from, to); setDistanceResult({ ...r, from, to }); }
    catch { showToast("❌ Failed to calculate distance"); }
    finally { setCalculatingDistance(false); }
  };

  const calculateRouteForDate = async (date) => {
    const jobs = scheduledJobs.filter(j => j.date === date && !j.isBreak && !j.is_break);
    const calc = async (teamJobs) => {
      if (teamJobs.length < 2) return { totalDistance: 0, totalDuration: 0, legs: [], jobs: teamJobs };
      const legs = []; let totalDistance = 0; let totalDuration = 0;
      for (let i = 0; i < teamJobs.length - 1; i++) {
        const fc = scheduleClients.find(c => c.id === (teamJobs[i].clientId || teamJobs[i].client_id));
        const tc = scheduleClients.find(c => c.id === (teamJobs[i+1].clientId || teamJobs[i+1].client_id));
        if (fc && tc) {
          const r = await calculateDistanceBetween(fc, tc);
          legs.push({ from: teamJobs[i], to: teamJobs[i+1], ...r });
          totalDistance += parseFloat(r.distance); totalDuration += r.duration;
        }
      }
      return { totalDistance, totalDuration, legs, jobs: teamJobs };
    };
    const allJobsSorted = jobs.sort((a,b) => (a.startTime||a.start_time).localeCompare(b.startTime||b.start_time));
    const allRoute = await calc(allJobsSorted);
    setRouteData({ date, teamA: allRoute, teamB: { totalDistance: 0, totalDuration: 0, legs: [], jobs: [] } });
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
      const waypoints = teamRoute.jobs.slice(1, -1).map(job => {
        const c = scheduleClients.find(cl => cl.id === (job.clientId || job.client_id));
        return { location: c?.address || `${job.suburb}, QLD, Australia`, stopover: true };
      });
      const fc = scheduleClients.find(c => c.id === (teamRoute.jobs[0].clientId || teamRoute.jobs[0].client_id));
      const lc = scheduleClients.find(c => c.id === (teamRoute.jobs[teamRoute.jobs.length-1].clientId || teamRoute.jobs[teamRoute.jobs.length-1].client_id));
      ds.route({ origin: fc?.address || `${teamRoute.jobs[0].suburb}, QLD, Australia`, destination: lc?.address || `${teamRoute.jobs[teamRoute.jobs.length-1].suburb}, QLD, Australia`, waypoints, travelMode: window.google.maps.TravelMode.DRIVING, optimizeWaypoints: false }, (result, status) => {
        if (status === "OK") {
          const renderer = new window.google.maps.DirectionsRenderer({ map, directions: result, polylineOptions: { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.8 }, markerOptions: { icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeWeight: 2, strokeColor: "#fff" } } });
          window.directionsRenderers.push(renderer);
          result.routes[0].legs.forEach(leg => { bounds.extend(leg.start_location); bounds.extend(leg.end_location); });
          map.fitBounds(bounds);
        }
        resolve();
      });
    });
    await drawTeamRoute(routeData.teamA, "#4A9E7E");
    if (routeData.teamB?.jobs?.length > 0) await drawTeamRoute(routeData.teamB, "#5B9EC4");
  }, [routeData, scheduleClients, scheduleSettings]);

  const calculateCalendarTravelTimes = useCallback(async () => {
    if (!mapsLoaded || scheduledJobs.length === 0) return;
    const newTimes = {};
    for (const date of weekDates.slice(0, 5)) {
      const dayJobs = scheduledJobs
        .filter(j => j.date === date && !j.isBreak && !j.is_break)
        .sort((a,b) => (a.startTime||a.start_time).localeCompare(b.startTime||b.start_time));
      if (dayJobs.length < 2) continue;
      const key = `${date}_default`;
      newTimes[key] = [];
      for (let i = 0; i < dayJobs.length - 1; i++) {
        const fc = scheduleClients.find(c => c.id === (dayJobs[i].clientId || dayJobs[i].client_id));
        const tc = scheduleClients.find(c => c.id === (dayJobs[i+1].clientId || dayJobs[i+1].client_id));
        if (fc && tc) {
          try {
            if (window.google?.maps) {
              const svc = new window.google.maps.DistanceMatrixService();
              const r = await new Promise((resolve) => {
                svc.getDistanceMatrix({ origins: [fc.address||`${fc.suburb}, QLD, Australia`], destinations: [tc.address||`${tc.suburb}, QLD, Australia`], travelMode: window.google.maps.TravelMode.DRIVING, unitSystem: window.google.maps.UnitSystem.METRIC }, (res, status) => {
                  if (status==="OK"&&res.rows[0]?.elements[0]?.status==="OK") { const el=res.rows[0].elements[0]; resolve({distance:(el.distance.value/1000).toFixed(1),duration:Math.round(el.duration.value/60)}); }
                  else { resolve({distance:"?",duration:"?"}); }
                });
              });
              newTimes[key].push({ from: dayJobs[i].clientId||dayJobs[i].client_id, to: dayJobs[i+1].clientId||dayJobs[i+1].client_id, ...r });
            }
          } catch { newTimes[key].push({ distance: "?", duration: "?" }); }
        }
      }
    }
    setCalendarTravelTimes(newTimes);
    showToast("✅ Travel times calculated");
  }, [mapsLoaded, scheduledJobs, scheduleClients, weekDates, showToast]);

  // ─── Derived state ───
  const archivedCount         = enquiries.filter(e => e.archived).length;
  const quotesNeedingFollowUp = enquiries.filter(e => e.status === "quote_sent" && daysSince(e.quote_sent_at || e.quoteSentAt || e.timestamp) >= 3);
  const unpaidJobsCount       = scheduledJobs.filter(j => j.status === "completed" && j.payment_status !== "paid" && j.paymentStatus !== "paid").length;
  const addonServices         = Object.entries(pricing).filter(([_, v]) => v.category === "addon");

  // ─── Nav Groups (Phase 2 accordion) ───
  const navGroups = [
    {
      label: "Work",
      icon: "💼",
      items: [
        { id: "inbox",    label: "Inbox",        icon: "📥", badge: enquiries.filter(e => !e.archived && ["new","info_received","quote_ready"].includes(e.status)).length },
        { id: "quotes",   label: "Quotes",       icon: "💰", badge: quotes.filter(q => q.status === "pending_approval").length },
        { id: "calendar", label: "Calendar",     icon: "📅", badge: 0 },
        { id: "rota",     label: "Rota",         icon: "🗓️", badge: 0 },
        { id: "emails",   label: "Email Center", icon: "📧", badge: quotesNeedingFollowUp.length },
      ],
    },
    {
      label: "Finance",
      icon: "💳",
      items: [
        { id: "payments", label: "Payments",   icon: "💳", badge: unpaidJobsCount },
        { id: "payroll",  label: "Payroll",    icon: "💵", badge: 0 },
        { id: "photos",   label: "Job Photos", icon: "📸", badge: 0 },
      ],
    },
    {
      label: "Route & Maps",
      icon: "🗺️",
      items: [
        { id: "tools", label: "Maps & Routing", icon: "🗺️", badge: 0 },
      ],
    },
    {
      label: "Clients",
      icon: "👥",
      items: [
        { id: "clients", label: "Client List", icon: "👥", badge: clients.length },
      ],
    },
    {
      label: "Admin",
      icon: "⚙️",
      items: [
        { id: "staff",     label: "Staff Manager", icon: "👤", badge: 0 },
        { id: "templates", label: "Templates",     icon: "💬", badge: 0 },
        { id: "form",      label: "Customer Form", icon: "📋", badge: 0 },
        { id: "pricing",   label: "Pricing",       icon: "⚙️", badge: 0 },
      ],
    },
  ];

  const toggleGroup = (label) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

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
      <div style={{ width: isMobile ? "100%" : 240, maxWidth: isMobile ? 280 : 240, background: T.sidebar, padding: "24px 12px", display: "flex", flexDirection: "column", position: "fixed", top: isMobile ? 60 : 0, left: isMobile ? (sidebarOpen ? 0 : -300) : 0, height: isMobile ? "calc(100vh - 60px)" : "100vh", zIndex: 99, transition: "left 0.3s ease", boxShadow: isMobile && sidebarOpen ? "4px 0 20px rgba(0,0,0,0.3)" : "none", overflowY: "auto" }}>
        {!isMobile && (
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🌿</div>
            <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0 }}>Dust Bunnies</h2>
            <p style={{ color: "#8FBFA8", fontSize: 11, margin: "2px 0 0" }}>Admin Dashboard</p>
            {profile && <p style={{ color: "#5A8A72", fontSize: 10, margin: "6px 0 0" }}>{profile.full_name || profile.email}</p>}
          </div>
        )}

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navGroups.map((group, gi) => {
            const isOpen    = openGroups.has(group.label);
            const groupBadge = group.items.reduce((sum, i) => sum + (i.badge || 0), 0);
            const hasActive  = group.items.some(i => i.id === page);

            return (
              <div key={group.label} style={{ marginBottom: 2 }}>
                {/* Group header button */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 8, background: hasActive && !isOpen ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", color: hasActive ? "#fff" : "#6A9E85", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, transition: "all 0.15s" }}
                >
                  <span style={{ fontSize: 13 }}>{group.icon}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{group.label}</span>
                  {!isOpen && groupBadge > 0 && (
                    <span style={{ background: T.accent, color: T.sidebar, padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 800 }}>{groupBadge}</span>
                  )}
                  <span style={{ fontSize: 10, color: "#4A7A62", transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                </button>

                {/* Collapsible items */}
                <div style={{ overflow: "hidden", maxHeight: isOpen ? "400px" : "0px", transition: "max-height 0.25s ease", paddingLeft: 4 }}>
                  {group.items.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setPage(n.id); if (isMobile) setSidebarOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: page === n.id ? "rgba(255,255,255,0.14)" : "transparent", border: page === n.id ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent", cursor: "pointer", color: page === n.id ? "#fff" : "#7AAFA0", fontSize: 13, fontWeight: page === n.id ? 700 : 500, textAlign: "left", width: "100%", transition: "all 0.12s", marginBottom: 1 }}
                    >
                      <span style={{ fontSize: 15 }}>{n.icon}</span>
                      <span style={{ flex: 1 }}>{n.label}</span>
                      {n.badge > 0 && <span style={{ background: T.accent, color: T.sidebar, padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{n.badge}</span>}
                    </button>
                  ))}
                </div>

                {gi < navGroups.length - 1 && (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "4px 8px" }} />
                )}
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={signOut}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#5A7A6A", fontSize: 12, fontWeight: 600, marginTop: 8, width: "100%" }}
        >
          <span>🚪</span><span>Sign Out</span>
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 98 }} />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : 240, marginTop: isMobile ? 60 : 0, padding: isMobile ? 16 : 28, maxWidth: isMobile ? "100%" : 960, width: "100%", boxSizing: "border-box" }}>

        {page === "inbox"    && <InboxTab enquiries={enquiries} quotes={quotes} filter={filter} setFilter={setFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} quotesNeedingFollowUp={quotesNeedingFollowUp} archivedCount={archivedCount} isMobile={isMobile} setPage={setPage} setSelectedEnquiry={setSelectedEnquiry} setSelectedRecipients={setSelectedRecipients} sendInfoForm={sendInfoForm} generateQuote={generateQuote} declineOutOfArea={declineOutOfArea} archiveEnquiry={archiveEnquiry} unarchiveEnquiry={unarchiveEnquiry} removeEnquiry={handleRemoveEnquiry} />}
        {page === "quotes"   && <QuotesTab quotes={quotes} pricing={pricing} isMobile={isMobile} setEditQuoteModal={setEditQuoteModal} setPreviewQuote={setPreviewQuote} approveQuote={approveQuote} markAccepted={markAccepted} />}
        {page === "emails"   && <EmailCenterTab emailHistory={emailHistory} quotesNeedingFollowUp={quotesNeedingFollowUp} selectedEmailTemplate={selectedEmailTemplate} setSelectedEmailTemplate={setSelectedEmailTemplate} selectedRecipients={selectedRecipients} setSelectedRecipients={setSelectedRecipients} recipientFilter={recipientFilter} setRecipientFilter={setRecipientFilter} customEmailStyle={customEmailStyle} setCustomEmailStyle={setCustomEmailStyle} customEmailContent={customEmailContent} setCustomEmailContent={setCustomEmailContent} showEmailPreview={showEmailPreview} setShowEmailPreview={setShowEmailPreview} sendingBulkEmail={sendingBulkEmail} handleBulkEmailSend={handleBulkEmailSend} getFilteredEmailRecipients={getFilteredEmailRecipients} EmailPreviewComponent={EmailPreviewComponent} isMobile={isMobile} />}
        {page === "payroll"  && <PayrollTab showToast={showToast} isMobile={isMobile} />}
        {page === "payments" && <PaymentsTab scheduledJobs={scheduledJobs} setScheduledJobs={setScheduledJobs} scheduleClients={scheduleClients} invoices={invoices} setInvoices={setInvoices} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} setShowInvoiceModal={setShowInvoiceModal} showToast={showToast} isMobile={isMobile} />}
        {page === "photos"   && <PhotosTab photos={photos} photoViewDate={photoViewDate} setPhotoViewDate={setPhotoViewDate} selectedPhoto={selectedPhoto} setSelectedPhoto={setSelectedPhoto} scheduledJobs={scheduledJobs} scheduleSettings={scheduleSettings} showToast={showToast} isMobile={isMobile} />}
        {page === "tools"    && <ToolsTab scheduleClients={scheduleClients} scheduledJobs={scheduledJobs} scheduleSettings={scheduleSettings} mapsLoaded={mapsLoaded} mapRef={mapRef} distanceFrom={distanceFrom} setDistanceFrom={setDistanceFrom} distanceTo={distanceTo} setDistanceTo={setDistanceTo} distanceResult={distanceResult} calculatingDistance={calculatingDistance} handleDistanceCalculation={handleDistanceCalculation} selectedRouteDate={selectedRouteDate} setSelectedRouteDate={setSelectedRouteDate} calculateRouteForDate={calculateRouteForDate} routeData={routeData} isMobile={isMobile} />}
        {page === "calendar" && <CalendarTab scheduledJobs={scheduledJobs} scheduleClients={scheduleClients} scheduleSettings={scheduleSettings} weekDates={weekDates} calendarWeekStart={calendarWeekStart} calendarTravelTimes={calendarTravelTimes} demoMode={demoMode} mapsLoaded={mapsLoaded} isMobile={isMobile} navigateWeek={navigateWeek} regenerateSchedule={regenerateSchedule} calculateCalendarTravelTimes={calculateCalendarTravelTimes} setShowScheduleSettings={setShowScheduleSettings} setEditingJob={setEditingJob} setEditingScheduleClient={setEditingScheduleClient} loadDemoData={loadDemoData} wipeDemo={wipeDemo} formatDate={formatDate} staffMembers={staffMembers} publishWeek={publishWeek} updateJob={updateJobDB} showToast={showToast} />}
        {page === "rota"     && <RotaTab
          scheduledJobs={scheduledJobs}
          staffMembers={staffMembers}
          showToast={showToast}
          isMobile={isMobile}
          publishWeek={publishWeek}
          unpublishWeek={unpublishWeek}
          initialWeekStart={calendarWeekStart}
        />}
        {page === "clients"  && <ClientsTab
          clients={clients}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          scheduleSettings={scheduleSettings}
          onAddClient={async (c) => {
            const newClient = { ...c, is_demo: false, status: c.status || "active" };
            newClient.estimated_duration = calculateDuration(newClient, scheduleSettings);
            await addClient(newClient);
            showToast("✅ Client added — go to Calendar to regenerate schedule");
          }}
          onUpdateClient={async (id, u) => { await updateClient(id, u); showToast("✅ Client updated"); }}
          onDeleteClient={async (id) => {
            for (const j of scheduledJobs.filter(j => j.clientId === id || j.client_id === id)) {
              try { await removeJob(j.id); } catch {}
            }
            await removeClient(id);
            showToast("🗑️ Client deleted");
          }}
          onLoadDemoClients={async (action) => {
            if (action === "remove") {
              const demos = clients.filter(c => c.is_demo || c.isDemo);
              for (const c of demos) {
                for (const j of scheduledJobs.filter(j => j.clientId === c.id || j.client_id === c.id)) {
                  try { await removeJob(j.id); } catch {}
                }
                try { await removeClient(c.id); } catch {}
              }
              showToast(`🗑️ Removed ${demos.length} demo clients`);
            } else {
              const demoClients = generateDemoClients();
              let added = 0;
              for (const c of demoClients) {
                try {
                  c.estimated_duration = calculateDuration(c, scheduleSettings);
                  await addClient(c);
                  added++;
                } catch {}
              }
              showToast(`🧪 Loaded ${added} demo clients!`);
            }
          }}
          isMobile={isMobile}
        />}
        {page === "staff"    && <StaffTab showToast={showToast} isMobile={isMobile} />}
        {page === "templates"&& <TemplatesTab templates={templates} copyTemplate={copyTemplate} removeTemplate={removeTemplate} setAddTemplateModal={setAddTemplateModal} isMobile={isMobile} />}
        {page === "form"     && <FormTab showToast={showToast} isMobile={isMobile} />}
        {page === "pricing"  && <PricingTab pricing={pricing} setEditPriceModal={setEditPriceModal} setAddServiceModal={setAddServiceModal} removeService={removeService} isMobile={isMobile} />}
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
                  {addonServices.map(([key, service]) => {
                    const isActive = selectedEnquiry.details[key];
                    if (!isActive) return null;
                    const qty = service.hasQuantity ? selectedEnquiry.details[`${key}Count`] : null;
                    return <span key={key} style={{ padding: "6px 12px", borderRadius: 8, background: T.primaryLight, color: T.primaryDark, fontSize: 12, fontWeight: 600 }}>{service.icon} {service.label}{qty ? ` (${qty})` : ""}</span>;
                  })}
                  {!addonServices.some(([key]) => selectedEnquiry.details[key]) && <span style={{ color: T.textMuted, fontSize: 13 }}>None selected</span>}
                </div>
              </div>
              {selectedEnquiry.details.notes && <div style={{ marginTop: 16, padding: "12px 16px", background: T.bg, borderRadius: T.radiusSm }}><div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>NOTES</div><div style={{ fontSize: 13, color: T.text }}>{selectedEnquiry.details.notes}</div></div>}
            </>
          )}
        </Modal>
      )}

      {editQuoteModal && <EditQuoteModal quote={editQuoteModal} pricing={pricing} onSave={async (updated) => { await updateQuote(updated.id, updated); setEditQuoteModal(null); showToast("✏️ Quote updated"); }} onClose={() => setEditQuoteModal(null)} />}
      {editPriceModal && <EditPriceModal serviceKey={editPriceModal} pricing={pricing} onSave={async (key, newPrice) => { await setPricing({ ...pricing, [key]: { ...pricing[key], price: newPrice } }); setEditPriceModal(null); showToast(`💰 ${pricing[editPriceModal].label} updated to $${newPrice}`); }} onClose={() => setEditPriceModal(null)} />}
      {addServiceModal  && <AddServiceModal  onSave={addService}   onClose={() => setAddServiceModal(false)} />}
      {addTemplateModal && <AddTemplateModal onSave={addTemplate}  onClose={() => setAddTemplateModal(false)} />}
      {previewQuote && <Modal title="Quote Preview" onClose={() => setPreviewQuote(null)} wide><QuotePreviewInline quote={previewQuote} pricing={pricing} /><button onClick={() => setPreviewQuote(null)} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: T.textMuted }}>Close</button></Modal>}
      {emailPreview && <EmailPreviewModal quote={emailPreview.quote} enquiry={emailPreview.enquiry} pricing={pricing} onSend={sendQuoteEmail} onClose={() => setEmailPreview(null)} sending={sendingEmail} />}
      {showScheduleSettings && <ScheduleSettingsModal settings={scheduleSettings} onSave={async (updated) => { await setScheduleSettings(updated); setShowScheduleSettings(false); showToast("✅ Settings saved"); }} onSaveAndRegenerate={async (updated) => { await setScheduleSettings(updated); setShowScheduleSettings(false); setTimeout(() => regenerateSchedule(updated), 100); }} onClose={() => setShowScheduleSettings(false)} />}
      {editingJob && <EditJobModal job={editingJob} clients={scheduleClients} settings={scheduleSettings} onSave={editingJob.isNew ? addNewJob : (updates) => updateJob(editingJob.id, updates)} onDelete={editingJob.isNew ? null : () => deleteJob(editingJob.id)} onClose={() => setEditingJob(null)} />}
      {editingScheduleClient && <EditScheduleClientModal client={editingScheduleClient} settings={scheduleSettings}
        onSave={editingScheduleClient.id
          ? (updates) => updateScheduleClient(editingScheduleClient.id, updates)
          : async (newClient) => {
              const c = { ...newClient, is_demo: false, status: "active" };
              c.estimated_duration = calculateDuration(c, scheduleSettings);
              await addClient(c);
              setEditingScheduleClient(null);
              showToast("✅ Client added");
            }}
        onDelete={editingScheduleClient.id ? () => deleteScheduleClient(editingScheduleClient.id) : null}
        onClose={() => setEditingScheduleClient(null)}
      />}
      {showInvoiceModal && <InvoiceModal job={showInvoiceModal} client={scheduleClients.find(c => c.id === (showInvoiceModal.clientId || showInvoiceModal.client_id))} pricing={pricing}
        onGenerate={async (invoice) => {
          await addInvoiceDB(invoice);
          setShowInvoiceModal(null);
          showToast(`✅ Invoice created`);
        }}
        onClose={() => setShowInvoiceModal(null)}
      />}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        button:hover:not(:disabled) { opacity: 0.9; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
