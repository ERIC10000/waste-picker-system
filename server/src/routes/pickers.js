import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { ah, ApiError, required } from '../lib/helpers.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);

const SELECT = '*, region:regions(id,name,code)';

/* GET /api/pickers?status=&region_id=&q=&page=&limit= */
router.get(
  '/',
  ah(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const from = (page - 1) * limit;

    let q = db.from('waste_pickers').select(SELECT, { count: 'exact' });

    if (req.query.status) q = q.eq('status', req.query.status);
    if (req.query.region_id) q = q.eq('region_id', Number(req.query.region_id));
    if (req.query.role) q = q.eq('role', req.query.role);
    if (req.query.q) {
      const term = `%${req.query.q}%`;
      q = q.or(`full_name.ilike.${term},phone.ilike.${term},picker_id.ilike.${term}`);
    }

    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new ApiError(400, error.message);

    res.json({ data, page, limit, total: count ?? 0 });
  })
);

/* GET /api/pickers/:id */
router.get(
  '/:id',
  ah(async (req, res) => {
    const { data, error } = await db
      .from('waste_pickers')
      .select(SELECT)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw new ApiError(400, error.message);
    if (!data) throw new ApiError(404, 'Waste picker not found');

    const { data: collections } = await db
      .from('collections')
      .select('*')
      .eq('picker_id', req.params.id)
      .order('collected_on', { ascending: false })
      .limit(20);

    res.json({ ...data, collections: collections || [] });
  })
);

/* PATCH /api/pickers/:id/status  { status, note }
   Approving here is what triggers the unique-ID generator in Postgres. */
router.patch(
  '/:id/status',
  ah(async (req, res) => {
    required(req.body, ['status']);
    const status = req.body.status;
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status))
      throw new ApiError(400, 'Invalid status');

    const patch = { status, rejection_note: req.body.note || null };
    if (status === 'approved') {
      patch.approved_by = req.user.id;
      patch.approved_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from('waste_pickers')
      .update(patch)
      .eq('id', req.params.id)
      .select(SELECT)
      .single();
    if (error) throw new ApiError(400, error.message);

    res.json(data);
  })
);

/* PATCH /api/pickers/:id/role  { role } */
router.patch(
  '/:id/role',
  ah(async (req, res) => {
    required(req.body, ['role']);
    if (!['picker', 'community_leader', 'data_collector'].includes(req.body.role))
      throw new ApiError(400, 'Invalid role');

    const { data, error } = await db
      .from('waste_pickers')
      .update({ role: req.body.role })
      .eq('id', req.params.id)
      .select(SELECT)
      .single();
    if (error) throw new ApiError(400, error.message);

    res.json(data);
  })
);

/* PATCH /api/pickers/:id - edit profile fields from the dashboard */
router.patch(
  '/:id',
  ah(async (req, res) => {
    const allowed = [
      'full_name',
      'national_id',
      'gender',
      'date_of_birth',
      'region_id',
      'sub_location',
    ];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (!Object.keys(patch).length) throw new ApiError(400, 'Nothing to update');

    const { data, error } = await db
      .from('waste_pickers')
      .update(patch)
      .eq('id', req.params.id)
      .select(SELECT)
      .single();
    if (error) throw new ApiError(400, error.message);

    res.json(data);
  })
);

/* DELETE /api/pickers/:id - removes profile and auth identity */
router.delete(
  '/:id',
  ah(async (req, res) => {
    const { error } = await db.from('waste_pickers').delete().eq('id', req.params.id);
    if (error) throw new ApiError(400, error.message);
    await db.auth.admin.deleteUser(req.params.id).catch(() => {});
    res.json({ ok: true });
  })
);

export default router;
