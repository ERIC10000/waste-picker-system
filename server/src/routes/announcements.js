import { Router } from 'express';
import { db } from '../lib/supabase.js';
import { ah, ApiError, required } from '../lib/helpers.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { pushToPickers } from '../lib/notify.js';

const router = Router();
router.use(authenticate, requireAdmin);

/* ------------------------------------------------------------------ */
/*  POST /api/announcements  - compose & broadcast                    */
/*  audience: 'all' | 'region' (region_id) | 'individual' (recipient) */
/* ------------------------------------------------------------------ */
router.post(
  '/',
  ah(async (req, res) => {
    const b = req.body;
    required(b, ['title', 'body', 'audience']);
    if (!['all', 'region', 'individual'].includes(b.audience))
      throw new ApiError(400, 'audience must be all, region or individual');
    if (b.audience === 'region' && !b.region_id)
      throw new ApiError(400, 'region_id is required when audience is "region"');
    if (b.audience === 'individual' && !b.recipient_id)
      throw new ApiError(400, 'recipient_id is required when audience is "individual"');

    // Resolve the recipient list (only approved pickers receive broadcasts)
    let q = db.from('waste_pickers').select('id').eq('status', 'approved');
    if (b.audience === 'region') q = q.eq('region_id', Number(b.region_id));
    if (b.audience === 'individual') q = q.eq('id', b.recipient_id);

    const { data: recipients, error: rErr } = await q;
    if (rErr) throw new ApiError(400, rErr.message);

    const { data: ann, error } = await db
      .from('announcements')
      .insert({
        title: b.title,
        body: b.body,
        audience: b.audience,
        region_id: b.audience === 'region' ? Number(b.region_id) : null,
        recipient_id: b.audience === 'individual' ? b.recipient_id : null,
        is_urgent: !!b.is_urgent,
        created_by: req.user.id,
        recipient_count: recipients.length,
      })
      .select('*')
      .single();
    if (error) throw new ApiError(400, error.message);

    if (recipients.length) {
      const rows = recipients.map((p) => ({ announcement_id: ann.id, picker_id: p.id }));
      // chunk so a large broadcast does not blow the request size limit
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await db
          .from('announcement_recipients')
          .insert(rows.slice(i, i + 500));
        if (insErr) throw new ApiError(400, insErr.message);
      }
      await pushToPickers(recipients.map((p) => p.id), ann);
    }

    res.status(201).json({ ...ann, delivered_to: recipients.length });
  })
);

/* GET /api/announcements - communication log */
router.get(
  '/',
  ah(async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const { data, error } = await db
      .from('v_communication_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  })
);

/* GET /api/announcements/:id - who got it, who read it */
router.get(
  '/:id',
  ah(async (req, res) => {
    const { data: ann, error } = await db
      .from('announcements')
      .select('*, region:regions(id,name)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw new ApiError(400, error.message);
    if (!ann) throw new ApiError(404, 'Announcement not found');

    const { data: recipients } = await db
      .from('announcement_recipients')
      .select('read_at, delivered_at, picker:waste_pickers(id,picker_id,full_name,phone)')
      .eq('announcement_id', req.params.id)
      .limit(500);

    res.json({ ...ann, recipients: recipients || [] });
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const { error } = await db.from('announcements').delete().eq('id', req.params.id);
    if (error) throw new ApiError(400, error.message);
    res.json({ ok: true });
  })
);

export default router;
