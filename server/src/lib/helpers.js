import { PHONE_EMAIL_DOMAIN } from './supabase.js';

/**
 * Normalise a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX.
 * Accepts 07..., 7..., +2547..., 2547...
 */
export function normalisePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^0-9]/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (p.length === 9 && (p.startsWith('7') || p.startsWith('1'))) p = '254' + p;
  if (!/^254(7|1)\d{8}$/.test(p)) return null;
  return p;
}

/** Waste pickers authenticate with a phone number; Supabase Auth needs an email. */
export function phoneToEmail(phone) {
  return `${phone}@${PHONE_EMAIL_DOMAIN}`;
}

/** Wrap an async route handler so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function required(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
}
