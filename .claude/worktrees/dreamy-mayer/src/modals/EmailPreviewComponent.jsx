import React from "react";
import { CUSTOM_EMAIL_STYLES } from "../shared";

export default function EmailPreviewComponent({ templateType, customStyle, customContent, recipientName }) {
  const style = CUSTOM_EMAIL_STYLES[customStyle] || CUSTOM_EMAIL_STYLES.announcement;

  const renderEmailContent = () => {
    switch (templateType) {
      case "follow_up":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>Hey <strong>{recipientName}</strong>! 👋</p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>Just wanted to check in about the quote we sent through a few days ago. We'd love to help get your home sparkling clean!</p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>If you have any questions at all, or if you'd like to make any changes to the quote, just reply to this email — we're always happy to chat.</p>
            <div style={{ background: "#E8F5EE", borderRadius: 8, padding: "14px 18px", borderLeft: "4px solid #4A9E7E" }}>
              <p style={{ margin: 0, fontSize: 14, color: "#2D7A5E", fontWeight: 600 }}>Ready to book? Simply reply "Yes" and we'll get you scheduled! 💚</p>
            </div>
          </>
        );
      case "review_request":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>Hey <strong>{recipientName}</strong>! 👋</p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>We hope you've been enjoying your sparkling clean home! We absolutely loved working with you.</p>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>If you have a moment, we'd really appreciate a quick Google review. It helps other families find us and means the world to our small team! ⭐</p>
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <div style={{ display: "inline-block", padding: "14px 28px", background: "#4A9E7E", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14 }}>⭐ Leave a Review</div>
            </div>
          </>
        );
      case "booking_confirmation":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>Hey <strong>{recipientName}</strong>! 🎉</p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>Great news — you're all booked in! We can't wait to make your home sparkle.</p>
            <div style={{ background: "#E8F5EE", borderRadius: 8, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#7A8F85", marginBottom: 6 }}>YOUR FIRST CLEAN</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3E36" }}>Date & time will be confirmed shortly</div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>We'll send a reminder the day before. If you need to reschedule, just reply to this email!</p>
          </>
        );
      case "reminder":
        return (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#2C3E36" }}>Hey <strong>{recipientName}</strong>! 👋</p>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#7A8F85", lineHeight: 1.7 }}>Just a friendly reminder that we'll be there <strong>tomorrow</strong> to give your home a beautiful clean! 🏠✨</p>
            <div style={{ background: "#FFF8E7", borderRadius: 8, padding: "14px 18px", borderLeft: "4px solid #E8C86A", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#8B6914" }}><strong>Quick checklist:</strong> Clear surfaces where possible, and let us know if there's anything specific you'd like us to focus on!</p>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#7A8F85" }}>See you tomorrow! 💚</p>
          </>
        );
      case "custom":
        return (
          <>
            {customContent.headline && <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "#2C3E36" }}>{customContent.headline}</h2>}
            <div style={{ fontSize: 14, color: "#7A8F85", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {(customContent.message || "Your message will appear here...").replace(/{NAME}/g, recipientName)}
            </div>
            {customContent.showButton && customContent.buttonText && (
              <div style={{ textAlign: "center", margin: "24px 0 8px" }}>
                <div style={{ display: "inline-block", padding: "14px 28px", background: style.headerColor, borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14 }}>{customContent.buttonText}</div>
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
      <div style={{ background: headerColor, padding: "20px 24px", textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>🌿</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Dust Bunnies Cleaning</div>
        <div style={{ fontSize: 11, color: "#8FBFA8", marginTop: 2 }}>Eco-conscious cleaning · Sunshine Coast</div>
      </div>
      <div style={{ background: bannerColor, padding: "8px 24px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          {templateType === "follow_up" && "CHECKING IN"}
          {templateType === "review_request" && "WE'D LOVE YOUR FEEDBACK"}
          {templateType === "booking_confirmation" && "BOOKING CONFIRMED"}
          {templateType === "reminder" && "REMINDER"}
          {templateType === "custom" && (CUSTOM_EMAIL_STYLES[customStyle]?.name?.toUpperCase() || "MESSAGE")}
        </span>
      </div>
      <div style={{ padding: "24px", background: "#fff" }}>{renderEmailContent()}</div>
      <div style={{ padding: "16px 24px", textAlign: "center", borderTop: "1px solid #E2EBE6" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#7A8F85" }}>Chat soon! 💚</p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#A3B5AD" }}>Dust Bunnies Cleaning · Sunshine Coast, QLD</p>
      </div>
    </div>
  );
}
