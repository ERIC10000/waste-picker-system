import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { ah, ApiError, required } from '../lib/helpers.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

/* Public: region list used by the registration form */
router.get(
  '/regions',
  ah(async (_req, res) => {
    const { data, error } = await db.from('regions').select('*').order('name');
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

/* Admin: all collections across the community */
router.get(
  '/collections',
  authenticate,
  requireAdmin,
  ah(async (req, res) => {
    let q = db
      .from('collections')
      .select('*, picker:waste_pickers(id,picker_id,full_name,region:regions(name))')
      .order('collected_on', { ascending: false });

    if (req.query.from) q = q.gte('collected_on', req.query.from);
    if (req.query.to) q = q.lte('collected_on', req.query.to);
    if (req.query.material) q = q.eq('material', req.query.material);

    const { data, error } = await q.limit(1000);
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

/* Admin management (superadmin only) */
router.get(
  '/admins',
  authenticate,
  requireAdmin,
  ah(async (_req, res) => {
    const { data, error } = await db.from('admins').select('*').order('created_at');
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

router.post(
  '/admins',
  authenticate,
  requireAdmin,
  ah(async (req, res) => {
    if (req.user.profile.role !== 'superadmin')
      throw new ApiError(403, 'Only a superadmin can create administrators');
    required(req.body, ['full_name', 'email', 'password']);

    const email = String(req.body.email).trim().toLowerCase();
    const { data: created, error: authErr } = await db.auth.admin.createUser({
      email,
      password: req.body.password,
      email_confirm: true,
      user_metadata: { full_name: req.body.full_name, kind: 'admin' },
    });
    if (authErr) throw new ApiError(400, authErr.message);

    const { data, error } = await db
      .from('admins')
      .insert({
        id: created.user.id,
        full_name: req.body.full_name,
        email,
        role: req.body.role === 'superadmin' ? 'superadmin' : 'admin',
      })
      .select('*')
      .single();
    if (error) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new ApiError(400, error.message);
    }
    res.status(201).json(data);
  })
);

export default router;
