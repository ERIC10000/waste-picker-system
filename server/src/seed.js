/**
 * Creates the first superadmin and (optionally) demo waste pickers so the
 * dashboard has something to show during the project demonstration.
 *
 *   npm run seed
 */
import 'dotenv/config';
import { db } from './lib/supabase.js';
import { normalisePhone, phoneToEmail } from './lib/helpers.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@wastepickers.ke';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'System Administrator';

async function ensureAdmin() {
  const { data: existing } = await db.from('admins').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
  if (existing) {
    console.log(`  admin already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const { data: created, error } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME, kind: 'admin' },
  });
  if (error) {
    console.error('  could not create admin auth user:', error.message);
    return;
  }

  const { error: insErr } = await db.from('admins').insert({
    id: created.user.id,
    full_name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: 'superadmin',
  });
  if (insErr) console.error('  could not create admin profile:', insErr.message);
  else console.log(`  created superadmin ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

const DEMO = [
  ['Achieng Otieno',   '0712000101', 'Kisumu',   'female', 'Nyalenda'],
  ['Brian Ochieng',    '0712000102', 'Kisumu',   'male',   'Manyatta'],
  ['Caroline Adhiambo','0712000103', 'Siaya',    'female', 'Bondo'],
  ['Dennis Wanjala',   '0712000104', 'Kakamega', 'male',   'Lurambi'],
  ['Everlyne Nafula',  '0712000105', 'Bungoma',  'female', 'Kanduyi'],
  ['Fredrick Omondi',  '0712000106', 'Homa Bay', 'male',   'Mbita'],
  ['Grace Auma',       '0712000107', 'Migori',   'female', 'Suna East'],
  ['Hesbon Barasa',    '0712000108', 'Busia',    'male',   'Nambale'],
];

async function seedPickers() {
  const { data: regions } = await db.from('regions').select('id,name');
  const regionByName = Object.fromEntries((regions || []).map((r) => [r.name, r.id]));

  for (const [name, rawPhone, region, gender, sub] of DEMO) {
    const phone = normalisePhone(rawPhone);
    const { data: exists } = await db.from('waste_pickers').select('id').eq('phone', phone).maybeSingle();
    if (exists) continue;

    const { data: created, error } = await db.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: 'Picker@1234',
      email_confirm: true,
      user_metadata: { full_name: name, phone, kind: 'picker' },
    });
    if (error) {
      console.warn(`  skip ${name}: ${error.message}`);
      continue;
    }

    await db.from('waste_pickers').insert({
      id: created.user.id,
      full_name: name,
      phone,
      gender,
      region_id: regionByName[region],
      sub_location: sub,
      status: 'approved', // trigger assigns the unique picker_id
    });
    console.log(`  created picker ${name} (${phone} / Picker@1234)`);
  }

  // leave two registrations pending so the approval queue is demonstrable
  const pending = [
    ['Irene Wekesa', '0712000109', 'Vihiga', 'female', 'Mbale'],
    ['Joseph Kiprop', '0712000110', 'Nandi', 'male', 'Kapsabet'],
  ];
  for (const [name, rawPhone, region, gender, sub] of pending) {
    const phone = normalisePhone(rawPhone);
    const { data: exists } = await db.from('waste_pickers').select('id').eq('phone', phone).maybeSingle();
    if (exists) continue;
    const { data: created, error } = await db.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: 'Picker@1234',
      email_confirm: true,
      user_metadata: { full_name: name, phone, kind: 'picker' },
    });
    if (error) continue;
    await db.from('waste_pickers').insert({
      id: created.user.id,
      full_name: name,
      phone,
      gender,
      region_id: regionByName[region],
      sub_location: sub,
    });
    console.log(`  created PENDING picker ${name} (${phone})`);
  }
}

async function seedCollections() {
  const { data: pickers } = await db
    .from('waste_pickers')
    .select('id')
    .eq('status', 'approved')
    .limit(20);
  if (!pickers?.length) return;

  const { count } = await db.from('collections').select('id', { count: 'exact', head: true });
  if (count && count > 0) {
    console.log('  collections already seeded');
    return;
  }

  const materials = ['plastic', 'paper', 'glass', 'metal', 'e_waste', 'organic'];
  const rows = [];
  for (const p of pickers) {
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * 90));
      rows.push({
        picker_id: p.id,
        material: materials[Math.floor(Math.random() * materials.length)],
        weight_kg: Number((Math.random() * 40 + 5).toFixed(2)),
        collected_on: d.toISOString().slice(0, 10),
      });
    }
  }
  const { error } = await db.from('collections').insert(rows);
  if (error) console.warn('  collections:', error.message);
  else console.log(`  created ${rows.length} collection records`);
}

(async () => {
  console.log('\nSeeding Waste Picker System...\n');
  await ensureAdmin();
  if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') {
    await seedPickers();
    await seedCollections();
  } else {
    console.log('\n  (run "npm run seed -- --demo" to also create demo pickers & activity)');
  }
  console.log('\nDone.\n');
  process.exit(0);
})();
