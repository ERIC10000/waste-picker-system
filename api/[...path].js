/**
 * Catch-all Vercel function.
 *
 * `api/index.js` only matches the bare `/api` path; this file takes everything
 * below it (`/api/auth/login`, `/api/pickers`, ...) and hands it to the same
 * Express app, which does the real routing off the original request URL.
 */
export { default } from '../server/src/app.js';
