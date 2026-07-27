import { Router } from 'express';
import multer from 'multer';
import { db, PHOTO_BUCKET } from '../lib/supabase.js';
import { ah, ApiError, required } from '../lib/helpers.js';
import { authenticate, requirePicker, requireApproved } from '../middleware/auth.js';

const router = Router();
// 4 MB, kept under the 4.5 MB request body ceiling on Vercel serverless functions.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

router.use(authenticate, requirePicker);

const SELECT = '*, region:regions(id,name,code)';

/* ------------------------------------------------------------------ */
/*  Profile                                                           */
/* ------------------------------------------------------------------ */
router.get(
  '/profile',
  ah(async (req, res) => res.json(req.user.profile))
);

router.patch(
  '/profile',
  ah(async (req, res) => {
    const allowed = ['full_name', 'gender', 'date_of_birth', 'region_id', 'sub_location', 'national_id'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (!Object.keys(patch).length) throw new ApiError(400, 'Nothing to update');

    const { data, error } = await db
      .from('waste_pickers')
      .update(patch)
      .eq('id', req.user.id)
      .select(SELECT)
      .single();
    if (error) throw new ApiError(400, error.message);
    res.json(data);
  })
);

/* POST /api/me/photo  (multipart field name: "photo") */
router.post(
  '/photo',
  upload.single('photo'),
  ah(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No photo uploaded');

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const path = `${req.user.id}/profile-${Date.now()}.${ext}`;

    const { error: upErr } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (upErr) throw new ApiError(400, upErr.message);

    const { data: pub } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    const { data, error } = await db
      .from('waste_pickers')
      .update({ photo_url: pub.publicUrl })
      .eq('id', req.user.id)
      .select(SELECT)
      .single();
    if (error) throw new ApiError(400, error.message);

    res.json(data);
  })
);

/* ------------------------------------------------------------------ */
/*  Announcements inbox                                               */
/* ------------------------------------------------------------------ */
router.get(
  '/announcements',
  ah(async (req, res) => {
    const { data, error } = await db
      .from('announcement_recipients')
      .select('id, read_at, delivered_at, announcement:announcements(id,title,body,is_urgent,created_at)')
      .eq('picker_id', req.user.id)
      .order('delivered_at', { ascending: false })
      .limit(100);
    if (error) throw new ApiError(400, error.message);

    const items = (data || [])
      .filter((r) => r.announcement)
      .map((r) => ({
        id: r.announcement.id,
        title: r.announcement.title,
        body: r.announcement.body,
        is_urgent: r.announcement.is_urgent,
        created_at: r.announcement.created_at,
        read: r.read_at !== null,
      }));

    res.json({ data: items, unread: items.filter((i) => !i.read).length });
  })
);

router.post(
  '/announcements/:id/read',
  ah(async (req, res) => {
    const { error } = await db
      .from('announcement_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('announcement_id', req.params.id)
      .eq('picker_id', req.user.id)
      .is('read_at', null);
    if (error) throw new ApiError(400, error.message);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  Collections (activity log) - approved pickers only                */
/* ------------------------------------------------------------------ */
router.get(
  '/collections',
  ah(async (req, res) => {
    const { data, error } = await db
      .from('collections')
      .select('*')
      .eq('picker_id', req.user.id)
      .order('collected_on', { ascending: false })
      .limit(200);
    if (error) throw new ApiError(400, error.message);

    const totalKg = (data || []).reduce((s, c) => s + Number(c.weight_kg), 0);
    const month = new Date().toISOString().slice(0, 7);
    const monthKg = (data || [])
      .filter((c) => String(c.collected_on).startsWith(month))
      .reduce((s, c) => s + Number(c.weight_kg), 0);

    res.json({ data, total_kg: totalKg, month_kg: monthKg, trips: data?.length || 0 });
  })
);

router.post(
  '/collections',
  requireApproved,
  ah(async (req, res) => {
    required(req.body, ['material', 'weight_kg']);
    const weight = Number(req.body.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0)
      throw new ApiError(400, 'Weight must be a number greater than zero');

    const { data, error } = await db
      .from('collections')
      .insert({
        picker_id: req.user.id,
        material: req.body.material,
        weight_kg: weight,
        collected_on: req.body.collected_on || new Date().toISOString().slice(0, 10),
        notes: req.body.notes || null,
      })
      .select('*')
      .single();
    if (error) throw new ApiError(400, error.message);
    res.status(201).json(data);
  })
);

router.delete(
  '/collections/:id',
  ah(async (req, res) => {
    const { error } = await db
      .from('collections')
      .delete()
      .eq('id', req.params.id)
      .eq('picker_id', req.user.id);
    if (error) throw new ApiError(400, error.message);
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ */
/*  Push token registration                                           */
/* ------------------------------------------------------------------ */
router.post(
  '/device-token',
  ah(async (req, res) => {
    required(req.body, ['token']);
    const { error } = await db.from('device_tokens').upsert(
      {
        picker_id: req.user.id,
        token: req.body.token,
        platform: req.body.platform || 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );
    if (error) throw new ApiError(400, error.message);
    res.json({ ok: true });
  })
);

export default router;
