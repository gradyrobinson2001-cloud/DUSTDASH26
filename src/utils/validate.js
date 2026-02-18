// ═══════════════════════════════════════════════════════
// SHARED VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════

/** Trim and check non-empty */
export const required = (v) => typeof v === "string" ? v.trim().length > 0 : v != null && v !== "";

/** Basic email format check */
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

/** Australian mobile: 04xx xxx xxx (with optional spaces/dashes) */
export const isAusPhone = (v) => /^(\+?61\s?)?0?4\d{2}[\s\-]?\d{3}[\s\-]?\d{3}$/.test((v || "").trim());

/** Any phone: at least 8 digits after stripping non-numeric chars */
export const isPhone = (v) => (v || "").replace(/\D/g, "").length >= 8;

/** Positive number */
export const isPositive = (v) => Number(v) > 0;

/** Non-negative number */
export const isNonNegative = (v) => Number(v) >= 0;

/** Value is within min/max */
export const inRange = (v, min, max) => Number(v) >= min && Number(v) <= max;

/** Non-empty time string (HH:MM) */
export const isTime = (v) => /^\d{2}:\d{2}$/.test((v || "").trim());

/** Non-empty date string (YYYY-MM-DD) */
export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test((v || "").trim());

/**
 * Validate a map of rules and return { valid, errors }.
 *
 * @param {Object} fields - e.g. { name: "Sarah", email: "bad" }
 * @param {Object} rules  - e.g. { name: [required], email: [required, isEmail] }
 * @returns {{ valid: boolean, errors: Object<string, string> }}
 *
 * Rules is an array of:
 *   - a validation function (v => bool) — uses default message
 *   - [fn, "custom message"] tuple
 */
export function validate(fields, rules) {
  const errors = {};
  for (const [key, fns] of Object.entries(rules)) {
    for (const rule of fns) {
      const [fn, msg] = Array.isArray(rule) ? rule : [rule, defaultMsg(rule, key)];
      if (!fn(fields[key])) {
        errors[key] = msg;
        break; // first failing rule wins
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function defaultMsg(fn, key) {
  const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
  if (fn === required) return `${label} is required`;
  if (fn === isEmail) return "Please enter a valid email address";
  if (fn === isAusPhone || fn === isPhone) return "Please enter a valid phone number";
  if (fn === isPositive) return `${label} must be greater than 0`;
  if (fn === isNonNegative) return `${label} must be 0 or more`;
  if (fn === isDate) return `${label} must be a valid date`;
  if (fn === isTime) return `${label} must be a valid time`;
  return `${label} is invalid`;
}

/** Small inline error component (returns a string of styles for re-use) */
export const errorStyle = {
  color: "#D4645C",
  fontSize: 12,
  marginTop: 4,
  fontWeight: 600,
};
