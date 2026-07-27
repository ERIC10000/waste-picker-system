import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  // Thrown rather than process.exit() so the message is also visible in the
  // Vercel function logs, where exiting would surface only a generic crash.
  throw new Error(
    'Missing Supabase credentials. Locally: copy server/.env.example to server/.env and fill in ' +
      'SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. ' +
      'On Vercel: add those three as Environment Variables in the project settings.'
  );
}

// Node 20 has no global WebSocket, which supabase-js needs to construct its
// realtime client even though this server only uses Auth/Postgres/Storage.
const options = {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
};

/** Full-privilege client. Bypasses RLS - server side only, never exposed. */
export const db = createClient(url, serviceKey, options);

/** Public client, used only to exchange credentials for a session. */
export const auth = createClient(url, anonKey, options);

export const PHOTO_BUCKET = process.env.PHOTO_BUCKET || 'picker-photos';
export const PHONE_EMAIL_DOMAIN = process.env.PHONE_EMAIL_DOMAIN || 'wastepickers.ke';
