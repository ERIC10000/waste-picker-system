# REST API Reference

Base URL: `http://localhost:4000`

All protected endpoints expect the Supabase access token returned by login:

```
Authorization: Bearer <access_token>
```

---

## Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Waste picker self-registration. Creates the auth identity and a `pending` profile, returns a session. |
| POST | `/api/auth/login` | public | Waste picker login with `{ phone, password }`. |
| POST | `/api/auth/admin/login` | public | Administrator login with `{ email, password }`. |
| POST | `/api/auth/refresh` | public | Exchange a refresh token for a new access token. |
| GET | `/api/auth/me` | any | Returns `{ kind, profile }` for the current session. |

**Register body**

```json
{
  "full_name": "Achieng Otieno",
  "phone": "0712345678",
  "password": "secret123",
  "region_id": 1,
  "national_id": "12345678",
  "gender": "female",
  "sub_location": "Nyalenda"
}
```

Phone numbers are normalised to `2547XXXXXXXX` before storage, so `0712345678`, `712345678`,
`+254712345678` and `254712345678` are all the same account.

---

## Reference data

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/regions` | public | The ten Western Kenya / Lake Victoria basin regions. |

---

## Waste pickers (administrator only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/pickers` | Paged list. Query: `status`, `region_id`, `role`, `q`, `page`, `limit`. |
| GET | `/api/pickers/:id` | One picker plus their 20 most recent collections. |
| PATCH | `/api/pickers/:id/status` | `{ status, note }`. Setting `approved` issues the unique Waste Picker ID. |
| PATCH | `/api/pickers/:id/role` | `{ role }` — `picker`, `community_leader` or `data_collector`. |
| PATCH | `/api/pickers/:id` | Edit profile fields from the dashboard. |
| DELETE | `/api/pickers/:id` | Deletes the profile and the auth identity. |

---

## Communication (administrator only)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/announcements` | Compose and broadcast. Returns `delivered_to`. |
| GET | `/api/announcements` | Communication log with delivery and read counts. |
| GET | `/api/announcements/:id` | One announcement plus its recipient list. |
| DELETE | `/api/announcements/:id` | Remove a message and its delivery records. |

**Broadcast body**

```json
{
  "title": "Free health screening",
  "body": "Kisumu County health team will be at Nyalenda grounds on Saturday from 9am.",
  "audience": "region",
  "region_id": 1,
  "is_urgent": false
}
```

`audience` is `all`, `region` (needs `region_id`) or `individual` (needs `recipient_id`).
Only **approved** pickers receive broadcasts.

---

## Waste picker's own data (`/api/me`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/me/profile` | The signed-in picker's profile. |
| PATCH | `/api/me/profile` | Update own details. |
| POST | `/api/me/photo` | Multipart upload, field name `photo`. Stores in Supabase Storage, returns the updated profile. |
| GET | `/api/me/announcements` | Inbox: `{ data, unread }`. |
| POST | `/api/me/announcements/:id/read` | Mark as read. |
| GET | `/api/me/collections` | Own activity plus `total_kg`, `month_kg`, `trips`. |
| POST | `/api/me/collections` | Record a collection. Approved pickers only. |
| DELETE | `/api/me/collections/:id` | Remove one of your own records. |
| POST | `/api/me/device-token` | Register an FCM device token for push. |

---

## Activity and reporting (administrator only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/collections` | All collections. Query: `from`, `to`, `material`. |
| GET | `/api/reports/overview` | Dashboard figures: counts, by-region, material mix, 6-month trend. |
| GET | `/api/reports/registrations` | Registration report. Query: `from`, `to`, `region_id`, `status`. |
| GET | `/api/reports/by-region` | Approved / pending / rejected / suspended per region. |
| GET | `/api/reports/communication` | Every broadcast with delivery and read counts. |
| GET | `/api/reports/collections` | Per-picker totals, ranked by weight. |

---

## Administrators

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admins` | List administrators. |
| POST | `/api/admins` | Create one. Superadmin only. |

---

## Errors

Failures return the matching HTTP status and a JSON body:

```json
{ "error": "This phone number is already registered" }
```

| Status | Meaning |
|---|---|
| 400 | Validation failure |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated but not permitted (wrong role, or registration not yet approved) |
| 404 | Not found |
| 409 | Conflict (duplicate phone number) |
