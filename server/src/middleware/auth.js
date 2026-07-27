import { db } from '../lib/supabase.js';
import { ApiError } from '../lib/helpers.js';

/**
 * Verifies the Supabase access token in `Authorization: Bearer <jwt>` and
 * attaches { id, email, kind, profile } to req.user.
 *   kind = 'admin'  -> row in public.admins
 *   kind = 'picker' -> row in public.waste_pickers
 */
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) throw new ApiError(401, 'Invalid or expired session');

    const uid = data.user.id;

    const { data: admin } = await db.from('admins').select('*').eq('id', uid).maybeSingle();
    if (admin) {
      if (!admin.is_active) throw new ApiError(403, 'This administrator account is deactivated');
      req.user = { id: uid, email: data.user.email, kind: 'admin', profile: admin };
      return next();
    }

    const { data: picker } = await db
      .from('waste_pickers')
      .select('*, region:regions(id,name,code)')
      .eq('id', uid)
      .maybeSingle();
    if (picker) {
      req.user = { id: uid, email: data.user.email, kind: 'picker', profile: picker };
      return next();
    }

    throw new ApiError(403, 'No profile is linked to this account');
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.kind !== 'admin') return next(new ApiError(403, 'Administrator access only'));
  next();
}

export function requirePicker(req, _res, next) {
  if (req.user?.kind !== 'picker') return next(new ApiError(403, 'Waste picker access only'));
  next();
}

/** Blocks pickers who have not been approved yet. */
export function requireApproved(req, _res, next) {
  if (req.user?.profile?.status !== 'approved')
    return next(new ApiError(403, 'Your registration is still awaiting approval'));
  next();
}
