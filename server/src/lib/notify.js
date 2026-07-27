import { db } from './supabase.js';

/**
 * Notification engine (Application Layer).
 *
 * Every announcement is always delivered in-app: the fan-out rows written to
 * `announcement_recipients` are what the mobile app reads as its inbox, and an
 * unread badge is driven off `read_at IS NULL`. That path needs no third-party
 * service and is what the demo runs on.
 *
 * On top of that, if FCM_SERVER_KEY is configured the same message is also
 * pushed to every registered Android device token so it arrives while the app
 * is closed. Without the key this is a no-op and in-app delivery still works.
 */
export async function pushToPickers(pickerIds, announcement) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key || !pickerIds.length) return { pushed: 0, skipped: true };

  const { data: tokens } = await db
    .from('device_tokens')
    .select('token')
    .in('picker_id', pickerIds);

  if (!tokens?.length) return { pushed: 0 };

  let pushed = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500).map((t) => t.token);
    try {
      const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_ids: batch,
          notification: { title: announcement.title, body: announcement.body },
          data: { announcement_id: announcement.id, urgent: String(!!announcement.is_urgent) },
        }),
      });
      if (resp.ok) pushed += batch.length;
    } catch (err) {
      console.warn('[notify] FCM push failed:', err.message);
    }
  }
  return { pushed };
}
