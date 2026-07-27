import { Router } from 'express';
import { db, auth } from '../lib/supabase.js';
import { ah, ApiError, normalisePhone, phoneToEmail, required } from '../lib/helpers.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/* ------------------------------------------------------------------ */
/*  POST /api/auth/register   - waste picker self-registration        */
/* ------------------------------------------------------------------ */
router.post(
  '/register',
  ah(async (req, res) => {
    const b = req.body;
    required(b, ['full_name', 'phone', 'password', 'region_id']);

    const phone = normalisePhone(b.phone);
    if (!phone) throw new ApiError(400, 'Enter a valid Kenyan phone number, e.g. 0712345678');
    if (String(b.password).length < 6)
      throw new ApiError(400, 'Password must be at least 6 characters');

    const { data: existing } = await db
      .from('waste_pickers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();
    if (existing) throw new ApiError(409, 'This phone number is already registered');

    const email = phoneToEmail(phone);

    // 1. Create the Supabase Auth identity
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email,
      password: b.password,
      email_confirm: true,
      user_metadata: { full_name: b.full_name, phone, kind: 'picker' },
    });
    if (authErr) throw new ApiError(400, authErr.message);

    // 2. Create the profile row (status defaults to 'pending')
    const { error: profileErr } = await db.from('waste_pickers').insert({
      id: created.user.id,
      full_name: b.full_name,
      phone,
      national_id: b.national_id || null,
      gender: b.gender || null,
      date_of_birth: b.date_of_birth || null,
      region_id: Number(b.region_id),
      sub_location: b.sub_location || null,
    });
    if (profileErr) {
      await db.auth.admin.deleteUser(created.user.id); // roll back the orphan identity
      throw new ApiError(400, profileErr.message);
    }

    // 3. Sign them straight in so the app can show the "pending approval" screen
    const { data: session } = await auth.auth.signInWithPassword({ email, password: b.password });

    const { data: profile } = await db
      .from('waste_pickers')
      .select('*, region:regions(id,name,code)')
      .eq('id', created.user.id)
      .single();

    res.status(201).json({
      access_token: session?.session?.access_token || null,
      refresh_token: session?.session?.refresh_token || null,
      kind: 'picker',
      profile,
    });
  })
);

/* ------------------------------------------------------------------ */
/*  POST /api/auth/login      - waste picker login (phone + password) */
/* ------------------------------------------------------------------ */
router.post(
  '/login',
  ah(async (req, res) => {
    required(req.body, ['phone', 'password']);
    const phone = normalisePhone(req.body.phone);
    if (!phone) throw new ApiError(400, 'Enter a valid Kenyan phone number');

    const { data, error } = await auth.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password: req.body.password,
    });
    if (error) throw new ApiError(401, 'Wrong phone number or password');

    const { data: profile } = await db
      .from('waste_pickers')
      .select('*, region:regions(id,name,code)')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profile) throw new ApiError(403, 'No waste picker profile found for this account');

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      kind: 'picker',
      profile,
    });
  })
);

/* ------------------------------------------------------------------ */
/*  POST /api/auth/admin/login - dashboard login (email + password)   */
/* ------------------------------------------------------------------ */
router.post(
  '/admin/login',
  ah(async (req, res) => {
    required(req.body, ['email', 'password']);

    const { data, error } = await auth.auth.signInWithPassword({
      email: String(req.body.email).trim().toLowerCase(),
      password: req.body.password,
    });
    if (error) throw new ApiError(401, 'Wrong email or password');

    const { data: admin } = await db.from('admins').select('*').eq('id', data.user.id).maybeSingle();
    if (!admin) throw new ApiError(403, 'This account is not an administrator');
    if (!admin.is_active) throw new ApiError(403, 'This administrator account is deactivated');

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      kind: 'admin',
      profile: admin,
    });
  })
);

/* ------------------------------------------------------------------ */
/*  POST /api/auth/refresh                                            */
/* ------------------------------------------------------------------ */
router.post(
  '/refresh',
  ah(async (req, res) => {
    required(req.body, ['refresh_token']);
    const { data, error } = await auth.auth.refreshSession({
      refresh_token: req.body.refresh_token,
    });
    if (error) throw new ApiError(401, 'Session expired, please sign in again');
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  })
);

/* ------------------------------------------------------------------ */
/*  GET /api/auth/me                                                  */
/* ------------------------------------------------------------------ */
router.get(
  '/me',
  authenticate,
  ah(async (req, res) => {
    res.json({ kind: req.user.kind, profile: req.user.profile });
  })
);

export default router;
