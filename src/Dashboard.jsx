import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import emailjs from "@emailjs/browser";
import { useLocation, useNavigate } from "react-router-dom";

import {
  T, SERVICED_AREAS, calcQuote, calculateDuration, generateDemoClients,
  generateScheduleForClients, wipeDemoData, daysSince, getFollowUpStatus,
  EMAIL_TEMPLATES, CUSTOM_EMAIL_STYLES, getClientCoords, addInvoice, getAllPhotos,
} from "./shared";

import { supabase, supabaseReady } from "./lib/supabase";
import { useAuth } from "./auth/AuthProvider";
import { getGoogleMapsApiKey, isGoogleMapsKeyConfigured } from "./config/maps";

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
import { useStaffTimeEntries } from "./hooks/useStaffTimeEntries";
import { useStaffBroadcast }   from "./hooks/useStaffBroadcast";
import { useExpenses }         from "./hooks/useExpenses";
import { useBrowserNotifications } from "./hooks/useBrowserNotifications";

import { Toast, Modal } from "./components/ui";

// Tab components
import InboxTab        from "./enquiries/InboxTab";
import QuotesTab       from "./quotes/QuotesTab";
import EmailCenterTab  from "./emails/EmailCenterTab";
import AIMarketingStudioTab from "./marketing/AIMarketingStudioTab";
import PaymentsTab     from "./finance/PaymentsTab";
import StaffHoursTab   from "./finance/StaffHoursTab";
import ExpensesTab     from "./finance/ExpensesTab";
import PhotosTab       from "./photos/PhotosTab";
import ToolsTab        from "./tools/ToolsTab";
import CalendarTab     from "./scheduling/CalendarTab";
import RotaTab         from "./scheduling/RotaTab";
import ClientsTab      from "./clients/ClientsTab";
import FloorPlansTab   from "./clients/FloorPlansTab";
import TemplatesTab    from "./settings/TemplatesTab";
import PricingTab      from "./settings/PricingTab";
import FormTab         from "./settings/FormTab";
import StaffTab        from "./settings/StaffTab";
import TodayTab        from "./dashboard/TodayTab";
import ComingSoonTab   from "./dashboard/ComingSoonTab";
import SidebarNav      from "./layout/SidebarNav";
import DashboardTopbar from "./layout/DashboardTopbar";

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
const EMAILJS_QUOTE_TEMPLATE_ID    =
  import.meta.env.VITE_EMAILJS_QUOTE_TEMPLATE_ID ||
  EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  EMAILJS_TEMPLATE_ID;
const EMAILJS_BULK_TEMPLATE_ID     =
  EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY           = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const PAGE_TO_PATH = {
  today: "/dashboard/today",
  inbox: "/dashboard/inbox",
  quotes: "/dashboard/quotes",
  emails: "/dashboard/email-marketing",
  ai_marketing_studio: "/dashboard/ai-marketing-studio",
  calendar: "/dashboard/schedule",
  rota: "/dashboard/weekly-overview",
  clients: "/dashboard/client-list",
  floorplans: "/dashboard/floor-plans",
  tools: "/dashboard/maps-routing",
  photos: "/dashboard/job-history",
  payments: "/dashboard/invoices",
  payroll: "/dashboard/payroll",
  staff: "/dashboard/staff-accounts",
  form: "/dashboard/client-quote-form",
  templates: "/dashboard/templates",
  pricing: "/dashboard/pricing-calculator",
  analytics: "/dashboard/analytics",
  expenses: "/dashboard/expenses",
  profit_reports: "/dashboard/profit-reports",
  sms_marketing: "/dashboard/sms-marketing",
  review_requests: "/dashboard/review-requests",
  ai_summary: "/dashboard/ai-job-summary",
};

const PATH_TO_PAGE = {
  today: "today",
  inbox: "inbox",
  quotes: "quotes",
  "email-marketing": "emails",
  "ai-marketing-studio": "ai_marketing_studio",
  "sms-marketing": "sms_marketing",
  "review-requests": "review_requests",
  schedule: "calendar",
  "weekly-overview": "rota",
  analytics: "analytics",
  "client-list": "clients",
  "floor-plans": "floorplans",
  "maps-routing": "tools",
  "job-history": "photos",
  invoices: "payments",
  payroll: "payroll",
  expenses: "expenses",
  "profit-reports": "profit_reports",
  "staff-accounts": "staff",
  "client-quote-form": "form",
  "business-settings": "form",
  templates: "templates",
  "pricing-calculator": "pricing",
  "ai-job-summary": "ai_summary",
  calendar: "calendar",
  rota: "rota",
  clients: "clients",
  floorplans: "floorplans",
  emails: "emails",
  payments: "payments",
  staff: "staff",
  form: "form",
  pricing: "pricing",
};

const PAGE_TITLES = {
  today: "Today",
  inbox: "Inbox",
  quotes: "Quotes",
  emails: "Email Marketing",
  ai_marketing_studio: "AI Marketing Studio",
  calendar: "Schedule",
  rota: "Weekly Overview",
  clients: "Client List",
  floorplans: "Floor Plans",
  tools: "Maps & Routing",
  photos: "Job History",
  payments: "Invoices",
  payroll: "Staff Hours",
  staff: "Staff Accounts",
  form: "Client Quote Form",
  templates: "Templates",
  pricing: "Pricing Calculator",
  analytics: "Analytics",
  expenses: "Expenses",
  profit_reports: "Profit Reports",
  sms_marketing: "SMS Marketing",
  review_requests: "Review Requests",
  ai_summary: "AI Job Summary",
};

const PAGE_ROLE_ACCESS = {
  today: ["admin", "finance"],
  analytics: ["admin", "finance"],
  quotes: ["admin", "finance"],
  payments: ["admin", "finance"],
  payroll: ["admin", "finance"],
  expenses: ["admin", "finance"],
  profit_reports: ["admin", "finance"],
  inbox: ["admin"],
  emails: ["admin"],
  ai_marketing_studio: ["admin"],
  sms_marketing: ["admin"],
  review_requests: ["admin"],
  calendar: ["admin"],
  rota: ["admin"],
  clients: ["admin"],
  floorplans: ["admin"],
  tools: ["admin"],
  photos: ["admin"],
  staff: ["admin"],
  form: ["admin"],
  templates: ["admin"],
  pricing: ["admin"],
  ai_summary: ["admin"],
};

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  // ─── Data from hooks (Supabase or localStorage fallback) ───
  const { clients,  addClient,  updateClient,  removeClient, refreshClients } = useClients();
  const { enquiries, setEnquiries, addEnquiry, updateEnquiry, removeEnquiry, refreshEnquiries } = useEnquiries();
  const { quotes,   setQuotes,  addQuote,    updateQuote, refreshQuotes } = useQuotes();
  const { scheduledJobs, setScheduledJobs, addJob, updateJob: updateJobDB, removeJob, bulkUpsertJobs, publishWeek, unpublishWeek, refreshScheduledJobs } = useScheduledJobs();
  const { invoices, setInvoices, addInvoice: addInvoiceDB, updateInvoice, refreshInvoices } = useInvoices();
  const { emailHistory, setEmailHistory, addEmailHistory, refreshEmailHistory } = useEmailHistory();
  const { pricing,  setPricing }                                        = usePricing();
  const { templates, addTemplate: addTemplateDB, removeTemplate: removeTemplateDB, saveAllTemplates } = useTemplates();
  const { scheduleSettings, setScheduleSettings }                      = useScheduleSettings();
  const { photos, refreshPhotos, getSignedUrl }                         = usePhotos();
  const { staffMembers, refreshProfiles }                               = useProfiles();
  const { timeEntries: staffTimeEntries }                               = useStaffTimeEntries();
  const { activeBroadcast, publishBroadcast, clearBroadcast }           = useStaffBroadcast();
  const {
    expenses,
    budgets: expenseBudgets,
    error: expensesError,
    addExpense,
    updateExpense,
    removeExpense,
    refreshExpenses,
    refreshBudgets,
    upsertBudget,
    removeBudget,
  } = useExpenses();
  const {
    supported: notificationSupported,
    permission: notificationPermission,
    enabled: notificationsEnabled,
    requestPermission: requestNotificationPermission,
    notify: notifyBrowser,
  } = useBrowserNotifications("dustdash_admin_notifications");

  // scheduleClients = active clients with scheduling info (subset of clients)
  const scheduleClients = clients.filter(c => c.status === "active");

  // ─── UI State ───
  const [page, setPage]               = useState("today");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768);
  const [openGroups, setOpenGroups]   = useState(() => new Set());
  const [darkMode, setDarkMode]       = useState(() => {
    try {
      return localStorage.getItem("dustdash_theme") === "dark";
    } catch {
      return false;
    }
  });
  const [floorPlanCount, setFloorPlanCount] = useState(0);
  const [toast, setToast]             = useState(null);
  const [filter, setFilter]           = useState("active");
  const [searchTerm, setSearchTerm]   = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

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
  const [toolsMapMode,       setToolsMapMode]        = useState("clients");
  const [mapsLoaded,         setMapsLoaded]          = useState(false);
  const [mapsError,          setMapsError]           = useState("");
  const [mapsApiKey,         setMapsApiKey]          = useState(() => getGoogleMapsApiKey());
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkersRef  = useRef([]);
  const mapCirclesRef  = useRef([]);
  const routeRenderersRef = useRef([]);
  const mapInfoWindowRef = useRef(null);

  // Finance
  const [showInvoiceModal, setShowInvoiceModal] = useState(null);
  const [paymentFilter,    setPaymentFilter]    = useState("unpaid");

  // Photos UI
  const [photoViewDate, setPhotoViewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [broadcastDraft, setBroadcastDraft] = useState("");
  const [broadcastSaving, setBroadcastSaving] = useState(false);

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
  const refreshAllDataRunningRef = useRef(false);
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

  const refreshAllData = useCallback(async () => {
    if (!supabaseReady || refreshAllDataRunningRef.current) return;
    refreshAllDataRunningRef.current = true;
    try {
      await Promise.allSettled([
        refreshEnquiries(),
        refreshQuotes(),
        refreshClients(),
        refreshScheduledJobs(),
        refreshInvoices(),
        refreshEmailHistory(),
        refreshProfiles(),
        refreshPhotos(),
        refreshExpenses(),
        refreshBudgets(),
      ]);
    } finally {
      refreshAllDataRunningRef.current = false;
    }
  }, [
    refreshClients,
    refreshEmailHistory,
    refreshEnquiries,
    refreshInvoices,
    refreshPhotos,
    refreshProfiles,
    refreshQuotes,
    refreshExpenses,
    refreshBudgets,
    refreshScheduledJobs,
  ]);

  const canAccessPage = useCallback((pageId) => {
    const role = profile?.role || "admin";
    const allowed = PAGE_ROLE_ACCESS[pageId];
    return !allowed || allowed.includes(role);
  }, [profile?.role]);

  const navigateToPage = useCallback((pageId) => {
    const requested = pageId in PAGE_TO_PATH ? pageId : "today";
    const target = canAccessPage(requested) ? requested : "today";
    const nextPath = PAGE_TO_PATH[target] || PAGE_TO_PATH.today;
    setPage(target);
    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: false });
    }
  }, [canAccessPage, location.pathname, navigate]);

  // ─── Effects ───
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [page, isMobile]);

  useEffect(() => {
    try {
      localStorage.setItem("dustdash_theme", darkMode ? "dark" : "light");
    } catch {}
  }, [darkMode]);

  useEffect(() => {
    const path = location.pathname.replace(/^\/dashboard\/?/, "");
    const segment = path.split("/")[0] || "today";
    const resolved = PATH_TO_PAGE[segment] || "today";
    const hasRouteMatch = Boolean(PATH_TO_PAGE[segment]);
    const roleAllows = canAccessPage(resolved);
    const allowed = roleAllows ? resolved : "today";
    if (page !== allowed) setPage(allowed);
    const expectedPath = PAGE_TO_PATH[allowed] || PAGE_TO_PATH.today;
    const isDashboardRoot = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
    if (isDashboardRoot || !hasRouteMatch || !roleAllows || location.pathname !== expectedPath && !hasRouteMatch) {
      navigate(expectedPath, { replace: true });
    }
  }, [canAccessPage, location.pathname, navigate, page]);

  useEffect(() => {
    if (!supabaseReady) return;
    refreshAllData();
    const onFocus = () => { refreshAllData(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshAllData();
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAllData();
    }, 12000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshAllData]);

  // Realtime: listen for new form submissions (Supabase will push via hook subscription)
  // The useEnquiries hook already subscribes to postgres_changes on enquiries table.
  // Show a toast when enquiries count increases.
  const prevEnqCount = useRef(enquiries.length);
  useEffect(() => {
    if (enquiries.length > prevEnqCount.current) {
      showToast(`📋 New enquiry received!`);
      const newest = enquiries[0];
      if (document.visibilityState !== "visible") {
        notifyBrowser({
          title: "New enquiry received",
          body: newest?.name
            ? `${newest.name}${newest.suburb ? ` · ${newest.suburb}` : ""}`
            : "A new enquiry was submitted.",
          tag: "new-enquiry",
        });
      }
    }
    prevEnqCount.current = enquiries.length;
  }, [enquiries, notifyBrowser, showToast]);

  useEffect(() => {
    const syncMapsApiKey = () => setMapsApiKey(getGoogleMapsApiKey());
    window.addEventListener("dustdash:maps-key-updated", syncMapsApiKey);
    window.addEventListener("storage", syncMapsApiKey);
    return () => {
      window.removeEventListener("dustdash:maps-key-updated", syncMapsApiKey);
      window.removeEventListener("storage", syncMapsApiKey);
    };
  }, []);

  // Google Maps
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      setMapsError("");
      return;
    }
    if (!isGoogleMapsKeyConfigured(mapsApiKey)) {
      setMapsLoaded(false);
      setMapsError("missing_key");
      return;
    }

    setMapsError("");
    const onLoad = () => {
      setMapsLoaded(true);
      setMapsError("");
    };
    const onError = () => {
      setMapsLoaded(false);
      setMapsError("load_failed");
      showToast("⚠️ Google Maps failed to load. Check API key and domain restrictions.");
    };

    const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&libraries=places`;
    let script = document.getElementById("google-maps-script");
    if (script && script.getAttribute("data-maps-key") !== mapsApiKey) {
      script.remove();
      script = null;
      setMapsLoaded(false);
    }
    if (script) {
      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);
      return () => {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };
    }

    script = document.createElement("script");
    script.id = "google-maps-script";
    script.setAttribute("data-maps-key", mapsApiKey);
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = onLoad;
    script.onerror = onError;
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [mapsApiKey, showToast]);

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
      await refreshAllData();
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
    const recipientEmail = (
      enquiry?.details?.email ||
      enquiry?.email ||
      quote?.email ||
      ""
    ).trim();
    const customerName = (
      quote?.name ||
      enquiry?.name ||
      enquiry?.details?.name ||
      "Customer"
    ).trim();
    const calc = calcQuote(quote.details, pricing);
    const esc = (value) => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
    const quotePublicUrl = `${import.meta.env.VITE_QUOTE_PUBLIC_URL || window.location.origin}/quote/${encodeURIComponent(String(quote?.id || ""))}`;
    const quoteItems = calc.items.map(item => `${item.description} × ${item.qty} — $${item.total.toFixed(2)}`).join("<br>");
    const quoteItemsHtml = calc.items
      .map(item => `<tr><td style="padding:8px 0;">${esc(item.description)} × ${item.qty}</td><td style="padding:8px 0;text-align:right;">$${item.total.toFixed(2)}</td></tr>`)
      .join("");
    const discountRow = calc.discount > 0
      ? `<tr><td style="padding:8px 0;color:${T.primaryDark};font-weight:700;">Weekly Discount</td><td style="padding:8px 0;text-align:right;color:${T.primaryDark};font-weight:700;">-$${calc.discount.toFixed(2)}</td></tr>`
      : "";
    const quoteHtml = `
<div style="font-family:Arial,sans-serif;color:${T.text};max-width:640px;">
  <h2 style="margin:0 0 8px;color:${T.primaryDark};">Your Cleaning Quote</h2>
  <p style="margin:0 0 14px;color:${T.textMuted};">Hi ${esc(customerName)}, here is your quote for a ${esc(quote?.frequency || "")} clean in ${esc(quote?.suburb || "")}.</p>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid ${T.border};border-bottom:1px solid ${T.border};margin:0 0 12px;">
    ${quoteItemsHtml}
    ${discountRow}
    <tr><td style="padding:10px 0;font-weight:700;">Total per clean</td><td style="padding:10px 0;text-align:right;font-weight:800;color:${T.primaryDark};">$${calc.total.toFixed(2)}</td></tr>
  </table>
  <p style="margin:0;color:${T.textMuted};font-size:13px;">Questions or changes? Reply to this email and we can update your quote.</p>
</div>`;
    const quoteText = [
      `Quote for ${customerName}`,
      `Frequency: ${quote?.frequency || ""}`,
      `Suburb: ${quote?.suburb || ""}`,
      ...calc.items.map(item => `- ${item.description} x ${item.qty}: $${item.total.toFixed(2)}`),
      calc.discount > 0 ? `Discount: -$${calc.discount.toFixed(2)}` : "",
      `Total per clean: $${calc.total.toFixed(2)}`,
      `View quote: ${quotePublicUrl}`,
    ].filter(Boolean).join("\n");
    setSendingEmail(true);
    try {
      if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_QUOTE_TEMPLATE_ID) {
        throw new Error("Email config missing. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_PUBLIC_KEY and a quote template ID.");
      }
      if (!recipientEmail || !isLikelyEmail(recipientEmail)) {
        throw new Error("Client email is missing or invalid on this enquiry.");
      }

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_QUOTE_TEMPLATE_ID, {
        customer_name: customerName.split(" ")[0] || customerName,
        customer_full_name: customerName,
        customer_email: recipientEmail,
        to_name: customerName,
        to_email: recipientEmail,
        reply_to: import.meta.env.VITE_BUSINESS_EMAIL || recipientEmail,
        subject: `Your Dust Bunnies quote — $${calc.total.toFixed(2)} per clean`,
        headline: `Your quote is ready`,
        message: `Hi ${esc(customerName)},<br><br>${quoteHtml}<br><br>Use the button below to view your full quote online.`,
        quote_html: quoteHtml,
        quote_text: quoteText,
        frequency: quote.frequency,
        frequency_lower: quote.frequency?.toLowerCase(),
        suburb: quote.suburb,
        quote_items: quoteItems,
        subtotal: calc.subtotal.toFixed(2),
        total: calc.total.toFixed(2),
        discount: calc.discount > 0 ? calc.discount.toFixed(2) : "",
        quote_id: quote?.id || "",
        show_button: "true",
        button_text: "View Quote",
        button_link: quotePublicUrl,
      }, EMAILJS_PUBLIC_KEY);
      const now = new Date().toISOString();
      await callSecureQuoteApi("/api/quotes/mark-sent", { quoteId: quote.id, sentAt: now });
      try {
        await addEmailHistory({ client_id: enquiry.id, recipient_name: customerName, recipient_email: recipientEmail, template_type: "quote" });
      } catch (historyErr) {
        console.error("[quote:mark-sent] email sent but failed to save history", historyErr);
      }
      await refreshAllData();
      setEmailPreview(null);
      showToast(`✅ Quote sent to ${recipientEmail}!`);
    } catch (err) {
      console.error("[quote:send-email] failed", err);
      const details = err?.text || err?.message || "Please try again.";
      showToast(`❌ Failed to send email: ${details}`);
    }
    finally { setSendingEmail(false); }
  };

  const markAccepted = async (qId) => {
    try {
      const result = await callSecureQuoteApi("/api/quotes/accept", { quoteId: qId });
      const clientName = result?.client?.name;
      await refreshAllData();
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

  const weekdayOrder = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
  const isoToday = () => new Date().toISOString().split("T")[0];
  const addDaysIso = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };
  const addMonthsIso = (dateStr, months) => {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };
  const normalizeDay = (value) => {
    const v = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(weekdayOrder, v) ? v : "monday";
  };
  const nextDayOnOrAfter = (startDate, preferredDay) => {
    const target = weekdayOrder[normalizeDay(preferredDay)];
    const d = new Date(`${startDate}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      if (d.getDay() === target) return d.toISOString().split("T")[0];
      d.setDate(d.getDate() + 1);
    }
    return startDate;
  };
  const minsToTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const endTimeFrom = (startTime, durationMins) => {
    const [h, m] = String(startTime || "08:00").split(":").map(Number);
    const startMins = (Number.isFinite(h) ? h : 8) * 60 + (Number.isFinite(m) ? m : 0);
    const safeDuration = Math.max(15, Number(durationMins) || 120);
    return minsToTime(startMins + safeDuration);
  };
  const startTimeFromPreference = (preferredTime) => {
    const key = String(preferredTime || "").toLowerCase();
    if (key === "morning") return "08:00";
    if (key === "afternoon") return "13:00";
    if (key === "midday" || key === "noon") return "11:00";
    return "08:00";
  };
  const inferPreferredDay = (client) => {
    const explicit = client?.preferred_day || client?.preferredDay;
    if (explicit) return normalizeDay(explicit);
    const suburb = String(client?.suburb || "").toLowerCase();
    const fromArea = Object.entries(scheduleSettings?.areaSchedule || {}).find(([, suburbs]) =>
      Array.isArray(suburbs) && suburbs.some((s) => String(s || "").toLowerCase() === suburb)
    );
    return normalizeDay(fromArea?.[0] || "monday");
  };
  const buildRecurringDates = ({ startDate, preferredDay, frequency, horizonWeeks = 12 }) => {
    const out = [];
    const first = nextDayOnOrAfter(startDate, preferredDay);
    const last = addDaysIso(startDate, Math.max(1, horizonWeeks) * 7);
    const freq = String(frequency || "fortnightly").toLowerCase();
    let cursor = first;
    while (cursor <= last) {
      out.push(cursor);
      if (freq === "weekly") cursor = addDaysIso(cursor, 7);
      else if (freq === "monthly") cursor = addMonthsIso(cursor, 1);
      else cursor = addDaysIso(cursor, 14); // fortnightly default
    }
    return out;
  };
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const normalizeText = (value) => String(value || "").trim().toLowerCase();
  const hasValidClientId = (value) => uuidRe.test(String(value || "").trim());
  const findBestClientForJob = (job) => {
    const validClients = clients || [];
    const rawId = String(job?.clientId || job?.client_id || "").trim();
    if (rawId && hasValidClientId(rawId)) {
      const byId = validClients.find((c) => String(c.id) === rawId);
      if (byId) return byId;
    }
    const jobName = normalizeText(job?.clientName || job?.client_name);
    const jobSuburb = normalizeText(job?.suburb);
    const jobAddress = normalizeText(job?.address);
    if (jobName) {
      const byNameSuburb = validClients.find((c) =>
        normalizeText(c?.name) === jobName &&
        (!jobSuburb || normalizeText(c?.suburb) === jobSuburb)
      );
      if (byNameSuburb) return byNameSuburb;
      const byNameOnly = validClients.find((c) => normalizeText(c?.name) === jobName);
      if (byNameOnly) return byNameOnly;
    }
    if (jobAddress) {
      const byAddress = validClients.find((c) => normalizeText(c?.address) === jobAddress);
      if (byAddress) return byAddress;
    }
    return null;
  };

  const repairJobClientLinks = useCallback(async () => {
    let repaired = 0;
    const today = isoToday();
    const candidates = (scheduledJobs || [])
      .filter((job) => !job?.isBreak && !job?.is_break)
      .filter((job) => String(job?.date || "") >= today);

    for (const job of candidates) {
      const existingId = String(job?.clientId || job?.client_id || "").trim();
      const alreadyLinked = existingId && hasValidClientId(existingId) && clients.some((c) => String(c.id) === existingId);
      if (alreadyLinked) continue;
      const match = findBestClientForJob(job);
      if (!match?.id) continue;
      await updateJobDB(job.id, {
        clientId: match.id,
        clientName: match.name || job.clientName || job.client_name || "Client",
        suburb: match.suburb || job.suburb || "",
        address: match.address || job.address || "",
        email: match.email || job.email || "",
        phone: match.phone || job.phone || "",
        bedrooms: match.bedrooms ?? job.bedrooms ?? null,
        bathrooms: match.bathrooms ?? job.bathrooms ?? null,
        living: match.living ?? job.living ?? null,
        kitchen: match.kitchen ?? job.kitchen ?? null,
        frequency: match.frequency || job.frequency || null,
        preferred_day: match.preferred_day || match.preferredDay || job.preferred_day || job.preferredDay || null,
        preferred_time: match.preferred_time || match.preferredTime || job.preferred_time || job.preferredTime || null,
        access_notes: match.access_notes || match.accessNotes || job.access_notes || job.accessNotes || null,
        notes: match.notes || job.notes || null,
      });
      repaired += 1;
    }
    return repaired;
  }, [clients, scheduledJobs, updateJobDB]);

  const syncRecurringJobsForClient = useCallback(async (clientInput, options = {}) => {
    const client = clientInput || null;
    if (!client?.id) return { created: 0, updated: 0, removed: 0 };

    const startDate = options.startDate || isoToday();
    const horizonWeeks = Number(options.horizonWeeks) || 12;
    const clientId = String(client.id);
    const clientName = client.name || "Client";
    const preferredDay = inferPreferredDay(client);
    const preferredTime = client.preferred_time || client.preferredTime || "anytime";
    const duration = Math.max(
      15,
      Number(
        client.custom_duration ??
        client.customDuration ??
        client.estimated_duration ??
        client.estimatedDuration ??
        calculateDuration(client, scheduleSettings)
      ) || 120
    );
    const targetDates = new Set(
      String(client.status || "active").toLowerCase() === "active"
        ? buildRecurringDates({
            startDate,
            preferredDay,
            frequency: client.frequency || "fortnightly",
            horizonWeeks,
          })
        : []
    );

    const existingJobs = (scheduledJobs || [])
      .filter((j) => !j.isBreak && !j.is_break)
      .filter((j) => String(j.clientId || j.client_id || "") === clientId)
      .filter((j) => String(j.date || "") >= startDate)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const existingByDate = new Map();
    existingJobs.forEach((job) => {
      const date = String(job.date || "");
      if (!date || existingByDate.has(date)) return;
      existingByDate.set(date, job);
    });

    let created = 0;
    let updated = 0;
    let removed = 0;
    const isLockedStatus = (status) => ["completed", "in_progress"].includes(String(status || "").toLowerCase());

    for (const job of existingJobs) {
      const status = job.status || job.job_status || job.jobStatus || "scheduled";
      if (isLockedStatus(status)) continue;
      if (!targetDates.has(String(job.date || ""))) {
        await removeJob(job.id);
        removed += 1;
      }
    }

    if (targetDates.size === 0) {
      return { created, updated, removed };
    }

    for (const date of Array.from(targetDates).sort()) {
      const existing = existingByDate.get(date) || null;
      const startTime = existing?.start_time || existing?.startTime || startTimeFromPreference(preferredTime);
      const endTime = endTimeFrom(startTime, duration);
      const basePayload = {
        date,
        clientId: client.id,
        clientName,
        suburb: client.suburb || "",
        address: client.address || "",
        email: client.email || "",
        phone: client.phone || "",
        bedrooms: client.bedrooms ?? null,
        bathrooms: client.bathrooms ?? null,
        living: client.living ?? null,
        kitchen: client.kitchen ?? null,
        frequency: client.frequency || null,
        preferred_day: client.preferred_day || client.preferredDay || null,
        preferred_time: client.preferred_time || client.preferredTime || null,
        access_notes: client.access_notes || client.accessNotes || null,
        notes: client.notes || null,
        startTime,
        endTime,
        duration,
        isDemo: client.isDemo || client.is_demo || false,
      };

      if (existing && !isLockedStatus(existing.status || existing.job_status || existing.jobStatus)) {
        await updateJobDB(existing.id, {
          ...basePayload,
          status: existing.status || existing.job_status || existing.jobStatus || "scheduled",
        });
        updated += 1;
      } else if (!existing) {
        await addJob({
          ...basePayload,
          status: "scheduled",
        });
        created += 1;
      }
    }

    return { created, updated, removed };
  }, [addJob, calculateDuration, removeJob, scheduleSettings, scheduledJobs, updateJobDB]);

  const syncRecurringSchedule = useCallback(async () => {
    const active = scheduleClients.filter((client) => String(client.status || "").toLowerCase() === "active");
    if (active.length === 0) {
      showToast("⚠️ No active clients to sync");
      return;
    }
    let created = 0;
    let updated = 0;
    let removed = 0;
    const repaired = await repairJobClientLinks();
    for (const client of active) {
      const result = await syncRecurringJobsForClient(client);
      created += result.created;
      updated += result.updated;
      removed += result.removed;
    }
    showToast(`✅ Recurring schedule synced (${created} added, ${updated} updated, ${removed} removed${repaired > 0 ? `, ${repaired} relinked` : ""})`);
  }, [repairJobClientLinks, scheduleClients, showToast, syncRecurringJobsForClient]);

  const didAutoRepairLinksRef = useRef(false);
  useEffect(() => {
    if (didAutoRepairLinksRef.current) return;
    if (!clients?.length || !scheduledJobs?.length) return;
    const hasBrokenLinks = (scheduledJobs || []).some((job) => {
      if (job?.isBreak || job?.is_break) return false;
      const id = String(job?.clientId || job?.client_id || "").trim();
      if (!id || !hasValidClientId(id)) return true;
      return !clients.some((c) => String(c.id) === id);
    });
    didAutoRepairLinksRef.current = true;
    if (!hasBrokenLinks) return;
    repairJobClientLinks().catch((err) => {
      console.error("[calendar:repair-links:auto] failed", err);
      didAutoRepairLinksRef.current = false;
    });
  }, [clients, repairJobClientLinks, scheduledJobs]);

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
    const demoClients = generateDemoClients(70);
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
    const updatedClient = await updateClient(clientId, updates);
    await syncRecurringJobsForClient(updatedClient || { id: clientId, ...updates });
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
    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_BULK_TEMPLATE_ID) {
      showToast("❌ Email config missing for bulk sends.");
      return;
    }
    if (!window.confirm(`Send ${EMAIL_TEMPLATES[selectedEmailTemplate]?.name || "email"} to ${selectedRecipients.length} recipient(s)?`)) return;
    setSendingBulkEmail(true);
    const recipients = getFilteredEmailRecipients().filter(r => selectedRecipients.includes(r.id));
    let success = 0, fail = 0;
    for (const r of recipients) {
      if (!isLikelyEmail(r?.email)) {
        fail++;
        continue;
      }
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_BULK_TEMPLATE_ID, buildEmailTemplateParams(r, selectedEmailTemplate, customEmailContent, customEmailStyle), EMAILJS_PUBLIC_KEY);
        await addEmailHistory({ client_id: r.id, recipient_name: r.name, recipient_email: r.email, template_type: selectedEmailTemplate, custom_style: selectedEmailTemplate === "custom" ? customEmailStyle : null });
        success++;
      } catch (err) {
        console.error("[email:bulk] send failed", { recipient: r?.email, err });
        fail++;
      }
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
    setToolsMapMode("route");
  };

  const clearClientOverlays = useCallback(() => {
    mapMarkersRef.current.forEach(marker => marker?.setMap?.(null));
    mapMarkersRef.current = [];
    mapCirclesRef.current.forEach(circle => circle?.setMap?.(null));
    mapCirclesRef.current = [];
  }, []);

  const clearRouteOverlays = useCallback(() => {
    routeRenderersRef.current.forEach(renderer => renderer?.setMap?.(null));
    routeRenderersRef.current = [];
  }, []);

  const drawClientsOnMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: -26.6590, lng: 153.0800 },
        zoom: 11,
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
    }
    const map = mapInstanceRef.current;
    clearRouteOverlays();
    clearClientOverlays();

    const mapClients = (clients || []).filter(c => c?.name);
    if (mapClients.length === 0) {
      map.setCenter({ lat: -26.6590, lng: 153.0800 });
      map.setZoom(11);
      return;
    }

    if (!mapInfoWindowRef.current) {
      mapInfoWindowRef.current = new window.google.maps.InfoWindow();
    }

    const bounds = new window.google.maps.LatLngBounds();
    const suburbBuckets = {};

    const markerStackIndexByCoord = {};

    mapClients.forEach((client) => {
      const coords = getClientCoords(client);
      if (!coords || typeof coords.lat !== "number" || typeof coords.lng !== "number") return;
      const coordKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
      const stackIndex = markerStackIndexByCoord[coordKey] || 0;
      markerStackIndexByCoord[coordKey] = stackIndex + 1;
      const jitter = stackIndex === 0 ? { lat: 0, lng: 0 } : {
        lat: Math.sin(stackIndex * 2.399963) * 0.00085,
        lng: Math.cos(stackIndex * 2.399963) * 0.00085,
      };
      const point = { lat: coords.lat + jitter.lat, lng: coords.lng + jitter.lng };

      bounds.extend(point);
      const status = String(client.status || "active").toLowerCase();
      const markerColor = status === "active" ? T.blue : (status === "paused" ? T.accent : T.textLight);
      const marker = new window.google.maps.Marker({
        map,
        position: point,
        title: `${client.name || "Client"}${client.suburb ? ` — ${client.suburb}` : ""}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor,
          fillOpacity: 0.92,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 7,
        },
      });

      marker.addListener("click", () => {
        const suburb = client.suburb || "Unknown suburb";
        const frequency = client.frequency || "Not set";
        const address = client.address || `${suburb}, QLD`;
        const phone = client.phone || "";
        const email = client.email || "";
        const html = `
          <div style="min-width:220px;font-family:Arial,sans-serif;color:#26352D;">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${client.name || "Client"}</div>
            <div style="font-size:12px;color:#6F7F74;line-height:1.45;">
              <div>${address}</div>
              <div>Frequency: ${frequency}</div>
              <div>Status: ${status}</div>
              ${phone ? `<div>Phone: ${phone}</div>` : ""}
              ${email ? `<div>Email: ${email}</div>` : ""}
            </div>
          </div>
        `;
        mapInfoWindowRef.current.setContent(html);
        mapInfoWindowRef.current.open({ anchor: marker, map });
      });

      mapMarkersRef.current.push(marker);

      const suburbKey = client.suburb || "Unknown";
      if (!suburbBuckets[suburbKey]) {
        suburbBuckets[suburbKey] = { count: 0, latSum: 0, lngSum: 0 };
      }
      suburbBuckets[suburbKey].count += 1;
      suburbBuckets[suburbKey].latSum += coords.lat;
      suburbBuckets[suburbKey].lngSum += coords.lng;
    });

    Object.values(suburbBuckets).forEach((bucket) => {
      const center = {
        lat: bucket.latSum / bucket.count,
        lng: bucket.lngSum / bucket.count,
      };
      const circle = new window.google.maps.Circle({
        map,
        center,
        radius: Math.min(1400, 180 + bucket.count * 110),
        fillColor: T.primary,
        fillOpacity: 0.12,
        strokeColor: T.primaryDark,
        strokeOpacity: 0.4,
        strokeWeight: 1,
      });
      mapCirclesRef.current.push(circle);
    });

    if (mapClients.length === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(13);
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  }, [clearClientOverlays, clearRouteOverlays, clients]);

  const drawRouteOnMap = useCallback(async () => {
    if (!mapRef.current || !routeData || !window.google?.maps) return;
    if (!mapInstanceRef.current) mapInstanceRef.current = new window.google.maps.Map(mapRef.current, { center: { lat: -26.6590, lng: 153.0800 }, zoom: 11 });
    const map = mapInstanceRef.current;
    clearClientOverlays();
    clearRouteOverlays();
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
          routeRenderersRef.current.push(renderer);
          result.routes[0].legs.forEach(leg => { bounds.extend(leg.start_location); bounds.extend(leg.end_location); });
          map.fitBounds(bounds);
        }
        resolve();
      });
    });
    await drawTeamRoute(routeData.teamA, "#4A9E7E");
    if (routeData.teamB?.jobs?.length > 0) await drawTeamRoute(routeData.teamB, "#5B9EC4");
  }, [clearClientOverlays, clearRouteOverlays, routeData, scheduleClients, scheduleSettings]);

  useEffect(() => {
    if (page !== "tools" || !mapsLoaded || !window.google?.maps || !mapRef.current) return;

    if (toolsMapMode === "clients") {
      drawClientsOnMap();
      return;
    }

    if (routeData) {
      setTimeout(() => drawRouteOnMap(), 200);
      return;
    }

    clearRouteOverlays();
    clearClientOverlays();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: -26.6590, lng: 153.0800 });
      mapInstanceRef.current.setZoom(11);
    }
  }, [
    clearClientOverlays,
    clearRouteOverlays,
    drawClientsOnMap,
    drawRouteOnMap,
    mapsLoaded,
    page,
    routeData,
    toolsMapMode,
  ]);

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
  const expenseNeedsReview    = expenses.filter((row) => row.status !== "approved" || Number(row.ai_confidence || 0) < 0.62).length;

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setFloorPlanCount(0);
      return;
    }
    let mounted = true;
    const refreshFloorPlanCount = async () => {
      const { count } = await supabase
        .from("floor_plans")
        .select("*", { count: "exact", head: true });
      if (!mounted) return;
      setFloorPlanCount(Number(count || 0));
    };
    refreshFloorPlanCount();
    const ch = supabase
      .channel("dashboard:floor-plan-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_plans" }, refreshFloorPlanCount)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const navGroups = useMemo(() => ([
    {
      label: "Dashboard",
      icon: "📊",
      items: [
        { id: "today", label: "Today", icon: "☀️", badge: 0, roles: ["admin", "finance"] },
        { id: "rota", label: "Weekly Overview", icon: "🗓️", badge: 0, roles: ["admin", "finance"] },
        { id: "analytics", label: "Analytics", icon: "📈", badge: 0, roles: ["admin", "finance"] },
      ],
    },
    {
      label: "Operations",
      icon: "🧰",
      items: [
        { id: "calendar", label: "Schedule", icon: "📅", badge: 0, roles: ["admin"] },
        { id: "clients", label: "Client List", icon: "👥", badge: clients.length, roles: ["admin"] },
        { id: "floorplans", label: "Floor Plans", icon: "🧱", badge: floorPlanCount, roles: ["admin"] },
        { id: "tools", label: "Maps & Routing", icon: "🗺️", badge: 0, roles: ["admin"] },
        { id: "photos", label: "Job History", icon: "📸", badge: 0, roles: ["admin"] },
      ],
    },
    {
      label: "Finance",
      icon: "💳",
      items: [
        { id: "quotes", label: "Quotes", icon: "💰", badge: quotes.filter(q => q.status === "pending_approval").length, roles: ["admin", "finance"] },
        { id: "payments", label: "Invoices", icon: "🧾", badge: unpaidJobsCount, roles: ["admin", "finance"] },
        { id: "payroll", label: "Staff Hours", icon: "⏱️", badge: 0, roles: ["admin", "finance"] },
        { id: "expenses", label: "Expenses", icon: "📚", badge: expenseNeedsReview, roles: ["admin", "finance"] },
        { id: "profit_reports", label: "Profit Reports", icon: "📉", badge: 0, roles: ["admin", "finance"] },
      ],
    },
    {
      label: "Marketing",
      icon: "📣",
      items: [
        { id: "ai_marketing_studio", label: "AI Marketing Studio", icon: "🎨", badge: 0, roles: ["admin"] },
        { id: "emails", label: "Email Marketing", icon: "📧", badge: quotesNeedingFollowUp.length, roles: ["admin"] },
        { id: "sms_marketing", label: "SMS Marketing", icon: "💬", badge: 0, roles: ["admin"] },
        { id: "review_requests", label: "Review Requests", icon: "⭐", badge: 0, roles: ["admin"] },
      ],
    },
    {
      label: "Admin",
      icon: "⚙️",
      items: [
        { id: "staff", label: "Staff Accounts", icon: "👤", badge: 0, roles: ["admin"] },
        { id: "form", label: "Client Quote Form", icon: "📝", badge: 0, roles: ["admin"] },
      ],
    },
    {
      label: "Tools",
      icon: "🛠️",
      items: [
        { id: "floorplans", label: "Floor Plan Builder", icon: "📐", badge: floorPlanCount, roles: ["admin"] },
        { id: "tools", label: "Routing Optimizer", icon: "🚚", badge: 0, roles: ["admin"] },
        { id: "pricing", label: "Pricing Calculator", icon: "🧮", badge: 0, roles: ["admin"] },
        { id: "ai_summary", label: "AI Job Summary", icon: "🤖", badge: 0, roles: ["admin"] },
      ],
    },
  ]), [clients.length, expenseNeedsReview, floorPlanCount, quotes, unpaidJobsCount, quotesNeedingFollowUp.length]);

  const notificationsCount = useMemo(() => {
    const today = new Date();
    const tzAdjusted = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    const todayIso = tzAdjusted.toISOString().split("T")[0];
    const todayUnassigned = scheduledJobs.filter(j => j.date === todayIso && !(j.assigned_staff || []).length && !(j.is_break || j.isBreak)).length;
    const overdueInvoices = invoices.filter(i => {
      const due = i.due_date || i.dueDate;
      if (!due) return false;
      const unpaid = String(i.status || "").toLowerCase() !== "paid";
      return unpaid && due < todayIso;
    }).length;
    return quotesNeedingFollowUp.length + todayUnassigned + overdueInvoices;
  }, [invoices, quotesNeedingFollowUp.length, scheduledJobs]);

  const globalSearchResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (term.length < 2) return [];
    const out = [];
    const add = (entry) => {
      if (out.length < 10) out.push(entry);
    };

    clients.forEach((c) => {
      const haystack = `${c.name || ""} ${c.email || ""} ${c.suburb || ""} ${c.address || ""}`.toLowerCase();
      if (haystack.includes(term)) {
        add({ id: `client-${c.id}`, label: c.name || "Client", meta: `${c.suburb || "Unknown suburb"} · Client`, pageId: "clients" });
      }
    });
    enquiries.forEach((e) => {
      const haystack = `${e.name || ""} ${e.suburb || ""} ${e.details?.email || ""}`.toLowerCase();
      if (haystack.includes(term)) {
        add({ id: `enquiry-${e.id}`, label: e.name || "Enquiry", meta: `${e.suburb || ""} · Enquiry`, pageId: "inbox" });
      }
    });
    scheduledJobs.forEach((j) => {
      const haystack = `${j.client_name || ""} ${j.suburb || ""} ${j.date || ""} ${j.start_time || ""}`.toLowerCase();
      if (haystack.includes(term)) {
        add({ id: `job-${j.id}`, label: j.client_name || "Scheduled Job", meta: `${j.date || ""} ${j.start_time || ""} · Job`, pageId: "calendar" });
      }
    });
    staffMembers.forEach((s) => {
      const haystack = `${s.full_name || ""} ${s.email || ""}`.toLowerCase();
      if (haystack.includes(term)) {
        add({ id: `staff-${s.id}`, label: s.full_name || s.email || "Staff", meta: "Staff profile", pageId: "staff" });
      }
    });
    return out.slice(0, 10);
  }, [clients, enquiries, globalSearch, scheduledJobs, staffMembers]);

  const toggleGroup = (label) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const pageLabel = PAGE_TITLES[page] || "Dashboard";
  const shellBackground = darkMode
    ? "radial-gradient(circle at top right, #1a2a22 0%, #0f1713 45%)"
    : `radial-gradient(circle at top right, ${T.primaryLight} 0%, ${T.bg} 45%)`;

  const onSelectGlobalSearchResult = useCallback((result) => {
    if (!result?.pageId) return;
    navigateToPage(result.pageId);
    setGlobalSearch("");
  }, [navigateToPage]);

  const handleViewFloorPlan = useCallback((clientId) => {
    if (!clientId) {
      showToast("⚠️ No client linked to this job.");
      return;
    }
    navigate(`/dashboard/clients/${clientId}/floorplan`);
  }, [navigate, showToast]);

  const handleMessageStaff = useCallback(() => {
    navigateToPage("emails");
    showToast("📧 Opened Email Marketing. Add a staff message template next.");
  }, [navigateToPage, showToast]);

  const handleMarkCompleteFromToday = useCallback(async (job) => {
    if (!job?.id) return;
    try {
      await updateJobDB(job.id, { status: "completed" });
      showToast("✅ Job marked complete.");
    } catch (err) {
      console.error("[today:mark-complete] failed", err);
      showToast(`❌ Failed to mark complete: ${err.message}`);
    }
  }, [showToast, updateJobDB]);

  const handlePublishBroadcast = useCallback(async () => {
    const message = broadcastDraft.trim();
    if (!message) {
      showToast("⚠️ Enter a broadcast message first.");
      return;
    }
    setBroadcastSaving(true);
    try {
      await publishBroadcast({
        message,
        createdBy: profile?.id || null,
        tone: "info",
      });
      setBroadcastDraft("");
      showToast("📣 Broadcast sent to staff portal.");
    } catch (err) {
      console.error("[broadcast:publish] failed", err);
      showToast(`❌ Failed to publish broadcast: ${err.message}`);
    } finally {
      setBroadcastSaving(false);
    }
  }, [broadcastDraft, profile?.id, publishBroadcast, showToast]);

  const handleClearBroadcast = useCallback(async () => {
    setBroadcastSaving(true);
    try {
      await clearBroadcast();
      showToast("✅ Broadcast cleared.");
    } catch (err) {
      console.error("[broadcast:clear] failed", err);
      showToast(`❌ Failed to clear broadcast: ${err.message}`);
    } finally {
      setBroadcastSaving(false);
    }
  }, [clearBroadcast, showToast]);

  const handleEnableNotifications = useCallback(async () => {
    if (!notificationSupported) {
      showToast("⚠️ Browser notifications are not supported on this device.");
      return;
    }
    const result = await requestNotificationPermission();
    if (result.ok) showToast("🔔 Notifications enabled.");
    else if (result.reason === "denied") showToast("❌ Notifications blocked. Allow them in browser settings.");
  }, [notificationSupported, requestNotificationPermission, showToast]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: shellBackground }}>
      <SidebarNav
        navGroups={navGroups}
        profile={profile}
        page={page}
        openGroups={openGroups}
        toggleGroup={toggleGroup}
        onSelectPage={navigateToPage}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        signOut={signOut}
        darkMode={darkMode}
      />

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : 268, padding: isMobile ? 14 : 24, width: "100%", boxSizing: "border-box" }}>
        <DashboardTopbar
          isMobile={isMobile}
          onOpenSidebar={() => setSidebarOpen((v) => !v)}
          pageLabel={pageLabel}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          searchResults={globalSearchResults}
          onSelectSearchResult={onSelectGlobalSearchResult}
          notificationsCount={notificationsCount}
          notificationSupported={notificationSupported}
          notificationPermission={notificationPermission}
          notificationsEnabled={notificationsEnabled}
          onEnableNotifications={handleEnableNotifications}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />

        {page === "today"    && <TodayTab
          clients={clients}
          scheduledJobs={scheduledJobs}
          staffMembers={staffMembers}
          timeEntries={staffTimeEntries}
          invoices={invoices}
          activeBroadcast={activeBroadcast}
          broadcastDraft={broadcastDraft}
          setBroadcastDraft={setBroadcastDraft}
          onPublishBroadcast={handlePublishBroadcast}
          onClearBroadcast={handleClearBroadcast}
          broadcastSaving={broadcastSaving}
          onViewFloorPlan={handleViewFloorPlan}
          onMessageStaff={handleMessageStaff}
          onMarkComplete={handleMarkCompleteFromToday}
        />}
        {page === "inbox"    && <InboxTab enquiries={enquiries} quotes={quotes} filter={filter} setFilter={setFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} quotesNeedingFollowUp={quotesNeedingFollowUp} archivedCount={archivedCount} isMobile={isMobile} setPage={navigateToPage} setSelectedEnquiry={setSelectedEnquiry} setSelectedRecipients={setSelectedRecipients} sendInfoForm={sendInfoForm} generateQuote={generateQuote} declineOutOfArea={declineOutOfArea} archiveEnquiry={archiveEnquiry} unarchiveEnquiry={unarchiveEnquiry} removeEnquiry={handleRemoveEnquiry} />}
        {page === "quotes"   && <QuotesTab quotes={quotes} pricing={pricing} isMobile={isMobile} setEditQuoteModal={setEditQuoteModal} setPreviewQuote={setPreviewQuote} approveQuote={approveQuote} markAccepted={markAccepted} />}
        {page === "emails"   && <EmailCenterTab emailHistory={emailHistory} quotesNeedingFollowUp={quotesNeedingFollowUp} selectedEmailTemplate={selectedEmailTemplate} setSelectedEmailTemplate={setSelectedEmailTemplate} selectedRecipients={selectedRecipients} setSelectedRecipients={setSelectedRecipients} recipientFilter={recipientFilter} setRecipientFilter={setRecipientFilter} customEmailStyle={customEmailStyle} setCustomEmailStyle={setCustomEmailStyle} customEmailContent={customEmailContent} setCustomEmailContent={setCustomEmailContent} showEmailPreview={showEmailPreview} setShowEmailPreview={setShowEmailPreview} sendingBulkEmail={sendingBulkEmail} handleBulkEmailSend={handleBulkEmailSend} getFilteredEmailRecipients={getFilteredEmailRecipients} EmailPreviewComponent={EmailPreviewComponent} isMobile={isMobile} />}
        {page === "ai_marketing_studio" && <AIMarketingStudioTab clients={clients} enquiries={enquiries} addEmailHistory={addEmailHistory} showToast={showToast} isMobile={isMobile} />}
        {page === "payroll"  && <StaffHoursTab showToast={showToast} isMobile={isMobile} />}
        {page === "payments" && <PaymentsTab scheduledJobs={scheduledJobs} setScheduledJobs={setScheduledJobs} scheduleClients={scheduleClients} invoices={invoices} setInvoices={setInvoices} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} setShowInvoiceModal={setShowInvoiceModal} showToast={showToast} isMobile={isMobile} />}
        {page === "photos"   && <PhotosTab photos={photos} photoViewDate={photoViewDate} setPhotoViewDate={setPhotoViewDate} selectedPhoto={selectedPhoto} setSelectedPhoto={setSelectedPhoto} scheduledJobs={scheduledJobs} showToast={showToast} isMobile={isMobile} refreshPhotos={refreshPhotos} getSignedUrl={getSignedUrl} />}
        {page === "tools"    && <ToolsTab scheduleClients={scheduleClients} allClients={clients} scheduledJobs={scheduledJobs} scheduleSettings={scheduleSettings} mapsLoaded={mapsLoaded} mapsError={mapsError} mapsApiKey={mapsApiKey} mapRef={mapRef} distanceFrom={distanceFrom} setDistanceFrom={setDistanceFrom} distanceTo={distanceTo} setDistanceTo={setDistanceTo} distanceResult={distanceResult} calculatingDistance={calculatingDistance} handleDistanceCalculation={handleDistanceCalculation} selectedRouteDate={selectedRouteDate} setSelectedRouteDate={setSelectedRouteDate} calculateRouteForDate={calculateRouteForDate} routeData={routeData} toolsMapMode={toolsMapMode} setToolsMapMode={setToolsMapMode} isMobile={isMobile} />}
        {page === "calendar" && <CalendarTab scheduledJobs={scheduledJobs} scheduleClients={scheduleClients} scheduleSettings={scheduleSettings} weekDates={weekDates} calendarWeekStart={calendarWeekStart} calendarTravelTimes={calendarTravelTimes} demoMode={demoMode} mapsLoaded={mapsLoaded} isMobile={isMobile} navigateWeek={navigateWeek} regenerateSchedule={regenerateSchedule} syncRecurringSchedule={syncRecurringSchedule} calculateCalendarTravelTimes={calculateCalendarTravelTimes} setShowScheduleSettings={setShowScheduleSettings} setEditingJob={setEditingJob} setEditingScheduleClient={setEditingScheduleClient} loadDemoData={loadDemoData} wipeDemo={wipeDemo} formatDate={formatDate} staffMembers={staffMembers} publishWeek={publishWeek} updateJob={updateJobDB} showToast={showToast} photos={photos} />}
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
            const insertedClient = await addClient(newClient);
            await syncRecurringJobsForClient(insertedClient || newClient);
            showToast("✅ Client added — go to Calendar to regenerate schedule");
          }}
          onUpdateClient={async (id, u) => {
            const updatedClient = await updateClient(id, u);
            await syncRecurringJobsForClient(updatedClient || { id, ...u });
            showToast("✅ Client updated");
          }}
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
        {page === "floorplans" && <FloorPlansTab clients={clients} isMobile={isMobile} />}
        {page === "staff"    && <StaffTab showToast={showToast} isMobile={isMobile} />}
        {page === "templates"&& <TemplatesTab templates={templates} copyTemplate={copyTemplate} removeTemplate={removeTemplate} setAddTemplateModal={setAddTemplateModal} isMobile={isMobile} />}
        {page === "form"     && <FormTab showToast={showToast} isMobile={isMobile} />}
        {page === "pricing"  && <PricingTab pricing={pricing} setEditPriceModal={setEditPriceModal} setAddServiceModal={setAddServiceModal} removeService={removeService} isMobile={isMobile} />}
        {page === "analytics" && <ComingSoonTab title="Analytics" description="Weekly trends, conversion rates, and staff efficiency dashboards can be surfaced here." />}
        {page === "expenses" && <ExpensesTab
          expenses={expenses}
          budgets={expenseBudgets}
          addExpense={addExpense}
          updateExpense={updateExpense}
          removeExpense={removeExpense}
          upsertBudget={upsertBudget}
          removeBudget={removeBudget}
          loadError={expensesError}
          showToast={showToast}
          isMobile={isMobile}
        />}
        {page === "profit_reports" && <ComingSoonTab title="Profit Reports" description="Build margin and P&L views by day, week, suburb, and staff team." />}
        {page === "sms_marketing" && <ComingSoonTab title="SMS Marketing" description="Template-driven SMS campaigns and reminders can be managed from this tab." />}
        {page === "review_requests" && <ComingSoonTab title="Review Requests" description="Queue and send post-job review requests automatically after completion." />}
        {page === "ai_summary" && <ComingSoonTab title="AI Job Summary" description="Generate concise daily summaries of completed jobs, issues, and staffing risks." />}
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
              const insertedClient = await addClient(c);
              await syncRecurringJobsForClient(insertedClient || c);
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
        button:hover:not(:disabled) { opacity: 0.95; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
