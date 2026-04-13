import React, { useState } from "react";
import { T } from "../shared";
import { Modal } from "../components/ui";
import { errorStyle } from "../utils/validate";

export default function InvoiceModal({ job, client, onGenerate, onClose }) {
  const [invoiceDetails, setInvoiceDetails] = useState({
    description: `Cleaning service - ${job.suburb}`,
    amount: job.price || 0,
    notes: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });
  const [touched, setTouched] = useState({ description: false, amount: false, dueDate: false });
  const touch = (f) => setTouched(prev => ({ ...prev, [f]: true }));

  const errors = {
    description: touched.description && !invoiceDetails.description.trim() ? "Description is required" : "",
    amount: touched.amount && !(invoiceDetails.amount > 0) ? "Amount must be greater than $0" : "",
    dueDate: touched.dueDate && !invoiceDetails.dueDate ? "Due date is required" : "",
  };
  const canGenerate = invoiceDetails.description.trim() && invoiceDetails.amount > 0 && invoiceDetails.dueDate;

  const handleGenerate = () => {
    setTouched({ description: true, amount: true, dueDate: true });
    if (!canGenerate) return;
    onGenerate({
      jobId: job.id,
      clientId: job.clientId,
      clientName: job.clientName,
      clientEmail: client?.email || "",
      clientAddress: client?.address || job.suburb,
      serviceDate: job.date,
      ...invoiceDetails,
    });
  };

  const printInvoice = () => {
    const invoiceNumber = `INV-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#2C3E36}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
      .logo{font-size:24px;font-weight:800;color:#4A9E7E}.logo-sub{font-size:12px;color:#7A8F85}
      .invoice-title{text-align:right}.invoice-number{font-size:24px;font-weight:800;color:#2C3E36}
      .invoice-date{font-size:14px;color:#7A8F85}
      .addresses{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px}
      .address-block h3{font-size:11px;text-transform:uppercase;color:#7A8F85;margin:0 0 8px}
      .address-block p{margin:0;line-height:1.6}
      .line-items{width:100%;border-collapse:collapse;margin-bottom:30px}
      .line-items th{text-align:left;padding:12px;background:#F4F8F6;font-size:11px;text-transform:uppercase;color:#7A8F85}
      .line-items td{padding:16px 12px;border-bottom:1px solid #E2EBE6}
      .total-row{background:#E8F5EE}.total-row td{font-weight:800;font-size:18px}
      .notes{background:#F4F8F6;padding:20px;border-radius:8px;margin-bottom:30px}
      .footer{text-align:center;color:#7A8F85;font-size:12px;border-top:1px solid #E2EBE6;padding-top:20px}
      .due-date{background:#FFF8E7;padding:12px 20px;border-radius:8px;display:inline-block;margin-bottom:20px}
      @media print{body{padding:20px}}
    </style></head><body>
      <div class="header"><div><div class="logo">🌿 Dust Bunnies Cleaning</div><div class="logo-sub">Eco-conscious cleaning · Sunshine Coast</div></div>
        <div class="invoice-title"><div class="invoice-number">${invoiceNumber}</div><div class="invoice-date">Date: ${new Date().toLocaleDateString("en-AU")}</div></div></div>
      <div class="addresses">
        <div class="address-block"><h3>Bill To</h3><p><strong>${job.clientName}</strong><br>${client?.address || job.suburb}<br>${client?.email || ""}<br>${client?.phone || ""}</p></div>
        <div class="address-block"><h3>Service Details</h3><p>Service Date: ${new Date(job.date).toLocaleDateString("en-AU")}<br>Location: ${job.suburb}<br>Duration: ${job.duration} minutes</p></div>
      </div>
      <div class="due-date"><strong>Payment Due:</strong> ${new Date(invoiceDetails.dueDate).toLocaleDateString("en-AU")}</div>
      <table class="line-items"><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody><tr><td>${invoiceDetails.description}</td><td style="text-align:right">$${invoiceDetails.amount.toFixed(2)}</td></tr>
          <tr class="total-row"><td>Total Due</td><td style="text-align:right">$${invoiceDetails.amount.toFixed(2)}</td></tr></tbody></table>
      ${invoiceDetails.notes ? `<div class="notes"><div class="notes-title">Notes</div><p>${invoiceDetails.notes}</p></div>` : ""}
      <div class="footer"><p>Thank you for choosing Dust Bunnies! 💚</p><p>Payment can be made via bank transfer or cash</p></div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Modal title="🧾 Generate Invoice" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 4 }}>{job.clientName}</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            {client?.address || job.suburb}<br />
            {client?.email && <span>{client.email}<br /></span>}
            Service Date: {new Date(job.date).toLocaleDateString("en-AU")}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DESCRIPTION</label>
          <input type="text" value={invoiceDetails.description}
            onChange={e => setInvoiceDetails(prev => ({ ...prev, description: e.target.value }))}
            onBlur={() => touch("description")}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.description ? "#D4645C" : T.border}`, fontSize: 14 }} />
          {errors.description && <p style={errorStyle}>{errors.description}</p>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>AMOUNT ($)</label>
            <input type="number" min="0.01" step="0.01" value={invoiceDetails.amount}
              onChange={e => setInvoiceDetails(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              onBlur={() => touch("amount")}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.amount ? "#D4645C" : T.border}`, fontSize: 14 }} />
            {errors.amount && <p style={errorStyle}>{errors.amount}</p>}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>DUE DATE</label>
            <input type="date" value={invoiceDetails.dueDate}
              onChange={e => setInvoiceDetails(prev => ({ ...prev, dueDate: e.target.value }))}
              onBlur={() => touch("dueDate")}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${errors.dueDate ? "#D4645C" : T.border}`, fontSize: 14 }} />
            {errors.dueDate && <p style={errorStyle}>{errors.dueDate}</p>}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 6 }}>NOTES (optional)</label>
          <textarea value={invoiceDetails.notes} onChange={e => setInvoiceDetails(prev => ({ ...prev, notes: e.target.value }))}
            rows={3} placeholder="Payment instructions, additional notes..."
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={printInvoice} style={{ flex: 1, padding: "12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            🖨️ Print Preview
          </button>
          <button onClick={handleGenerate} style={{ flex: 2, padding: "12px", borderRadius: T.radiusSm, border: "none", background: canGenerate ? T.primary : T.border, color: "#fff", fontWeight: 700, fontSize: 14, cursor: canGenerate ? "pointer" : "not-allowed" }}>
            ✅ Generate Invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}
