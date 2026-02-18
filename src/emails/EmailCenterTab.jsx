import React from "react";
import { T, EMAIL_TEMPLATES, CUSTOM_EMAIL_STYLES, getFollowUpStatus, daysSince, getLastEmailForClient } from "../shared";

export default function EmailCenterTab({
  emailHistory,
  quotesNeedingFollowUp,
  selectedEmailTemplate,
  setSelectedEmailTemplate,
  selectedRecipients,
  setSelectedRecipients,
  recipientFilter,
  setRecipientFilter,
  customEmailStyle,
  setCustomEmailStyle,
  customEmailContent,
  setCustomEmailContent,
  showEmailPreview,
  setShowEmailPreview,
  sendingBulkEmail,
  handleBulkEmailSend,
  getFilteredEmailRecipients,
  EmailPreviewComponent,
  isMobile,
}) {
  return (
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

        {/* Left Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Template Selector */}
          <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Email Template</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.values(EMAIL_TEMPLATES).filter(t => t.id !== "quote").map(tmpl => (
                <button key={tmpl.id} onClick={() => setSelectedEmailTemplate(tmpl.id)} style={{
                  padding: "10px 12px", borderRadius: T.radiusSm, textAlign: "left", cursor: "pointer",
                  border: selectedEmailTemplate === tmpl.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: selectedEmailTemplate === tmpl.id ? T.primaryLight : "#fff",
                }}>
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

          {/* Custom Email Style */}
          {selectedEmailTemplate === "custom" && (
            <div style={{ background: "#fff", borderRadius: T.radius, padding: "16px", boxShadow: T.shadow }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Email Style</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.values(CUSTOM_EMAIL_STYLES).map(style => (
                  <button key={style.id} onClick={() => setCustomEmailStyle(style.id)} style={{
                    padding: "10px", borderRadius: T.radiusSm, textAlign: "center", cursor: "pointer",
                    border: customEmailStyle === style.id ? `2px solid ${style.headerColor}` : `1.5px solid ${T.border}`,
                    background: customEmailStyle === style.id ? style.accentColor : "#fff",
                  }}>
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
              {[{ id: "all", label: "All" }, { id: "leads", label: "Leads" }, { id: "quote_sent", label: "Quote Sent" }, { id: "active", label: "Active Clients" }].map(f => (
                <button key={f.id} onClick={() => setRecipientFilter(f.id)} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  border: recipientFilter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: recipientFilter === f.id ? T.primaryLight : "#fff",
                  color: recipientFilter === f.id ? T.primaryDark : T.textMuted,
                }}>
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
                  setSelectedRecipients(prev => prev.length === filteredIds.length ? [] : filteredIds);
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
                    onClick={() => setSelectedRecipients(prev => isSelected ? prev.filter(id => id !== recipient.id) : [...prev, recipient.id])}
                    style={{
                      padding: "10px 12px", borderRadius: T.radiusSm, cursor: "pointer",
                      border: isSelected ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                      background: isSelected ? T.primaryLight : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? "none" : `2px solid ${T.border}`, background: isSelected ? T.primary : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
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
                <div style={{ textAlign: "center", padding: 20, color: T.textLight, fontSize: 13 }}>No recipients match this filter</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Custom Email Builder */}
          {selectedEmailTemplate === "custom" && (
            <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", display: "block", marginBottom: 16 }}>Compose Email</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Subject Line</label>
                  <input type="text" value={customEmailContent.subject} onChange={e => setCustomEmailContent(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. Exciting News from Dust Bunnies! 🌿" style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Headline</label>
                  <input type="text" value={customEmailContent.headline} onChange={e => setCustomEmailContent(prev => ({ ...prev, headline: e.target.value }))} placeholder="e.g. We're Expanding Our Services!" style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Message (use {"{NAME}"} for personalization)</label>
                  <textarea value={customEmailContent.message} onChange={e => setCustomEmailContent(prev => ({ ...prev, message: e.target.value }))} placeholder={"Hey {NAME}!\n\nWe're thrilled to announce..."} rows={5} style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={customEmailContent.showButton} onChange={e => setCustomEmailContent(prev => ({ ...prev, showButton: e.target.checked }))} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 13, color: T.text }}>Add call-to-action button</span>
                </div>
                {customEmailContent.showButton && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingLeft: 28 }}>
                    <div>
                      <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Button Text</label>
                      <input type="text" value={customEmailContent.buttonText} onChange={e => setCustomEmailContent(prev => ({ ...prev, buttonText: e.target.value }))} placeholder="Learn More" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: T.textMuted, display: "block", marginBottom: 4 }}>Button Link</label>
                      <input type="text" value={customEmailContent.buttonLink} onChange={e => setCustomEmailContent(prev => ({ ...prev, buttonLink: e.target.value }))} placeholder="https://..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13 }} />
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
              <span style={{ fontSize: 11, color: T.textLight }}>
                Showing preview for "{selectedRecipients.length > 0 ? getFilteredEmailRecipients().find(r => r.id === selectedRecipients[0])?.name || "Client" : "Client"}"
              </span>
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
              style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: selectedRecipients.length === 0 ? T.textLight : T.textMuted, fontWeight: 700, fontSize: 14, cursor: selectedRecipients.length === 0 ? "not-allowed" : "pointer" }}
            >
              👁️ Full Preview
            </button>
            <button
              onClick={handleBulkEmailSend}
              disabled={selectedRecipients.length === 0 || sendingBulkEmail}
              style={{
                flex: 2, padding: "14px", borderRadius: T.radiusSm, border: "none", fontWeight: 700, fontSize: 14, color: "#fff",
                background: selectedRecipients.length === 0 || sendingBulkEmail ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.blue})`,
                cursor: selectedRecipients.length === 0 || sendingBulkEmail ? "not-allowed" : "pointer",
                boxShadow: selectedRecipients.length > 0 && !sendingBulkEmail ? "0 4px 12px rgba(74,158,126,0.3)" : "none",
              }}
            >
              {sendingBulkEmail ? "Sending..." : `📧 Send to ${selectedRecipients.length} Recipient${selectedRecipients.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* Email History */}
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
  );
}
