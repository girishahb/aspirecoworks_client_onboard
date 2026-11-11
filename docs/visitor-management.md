# Aspire Coworks Visitor Management

Staff-operated reception check-in for a single desk (web only). Integrated into the existing NestJS API + Vite Staff Ops portal.

## What it does

1. Staff opens **Visitor check-in** (`/staff/visitors/check-in`)
2. Enters visitor details (host name/email **optional** — most visitors are on-site customers)
3. Captures a face photo from the webcam
4. Captures a signature (USB signature pad or mouse/trackpad)
5. Optionally records Aadhaar consent + last 4 digits + optional card photo
6. Submits → visitor is **Checked in**; host email is sent **only if** `hostEmail` was provided
7. On exit, staff marks **Checked out** from **Today’s visitors** (`/staff/visitors`)

Admin: `/admin/visitors` — day filter, search, Excel export.

## Run (dev)

```bash
# API (repo root)
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

Sign in at `/staff/login` with a `RECEPTION` role (or `ADMIN` / `SUPER_ADMIN` for break-glass). Onboarding `STAFF` cannot use visitor check-in.

### Env (already used by the app)

- `DATABASE_URL` — Postgres
- `RESEND_API_KEY`, `EMAIL_FROM` — host notify (if unset, check-in still works; email is logged/skipped)
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — face/signature/Aadhaar media

## Aadhaar / retention

- Full 12-digit Aadhaar is **never** accepted or stored
- Consent text is versioned in code (`AADHAAR_CONSENT_VERSION` in `src/visitors/visitor.constants.ts`)
- Lists show masked last-4; detail view shows last-4 for authorized staff
- Media is private (authenticated Nest stream from R2 — no public URLs)
- Recommended retention: **90 days** (`VISITOR_RETENTION_DAYS`). Automated purge is out of v1; soft-delete column `deletedAt` is ready for a later job

## Reception hardware (BOM)

| Item | Spec / recommendation | Why |
|------|------------------------|-----|
| Reception PC/laptop | Windows 11 or macOS; 8GB+ RAM; Chrome/Edge | Runs Staff Ops all day |
| Webcam | Logitech C920/C922 or equivalent 1080p USB autofocus | Clear face capture |
| Signature pad | Wacom STU-430/540 or budget HID LCD pad; fallback: on-screen canvas | Pen feel; USB plug-and-play |
| Backup input | Built-in trackpad/mouse | Pad failure must not block check-in |
| Optional doc cam | USB doc cam or phone stand | Cleaner Aadhaar card photo |
| Desk mount | Webcam clamp + fixed pad position | Consistent framing |
| UPS (optional) | ~600VA | Survive short power cuts |
| Network | Stable Wi‑Fi or Ethernet | API + email |
| Printer | Out of v1 (no badges) | Add later if needed |

**Indicative India kit cost:** webcam ₹3–6k; signature pad ₹15–45k (Wacom STU) or ₹5–12k (basic LCD); doc cam optional ₹3–8k.

### Setup tips

- Use Chrome or Edge; pin `/staff/visitors/check-in`; optional fullscreen (`F11`)
- Grant camera permission once per browser profile
- Test signature pad with Windows Ink / browser pointer events before go-live
- Face visitor toward soft light; avoid backlight from glass doors

## Out of v1

Self-serve kiosk, Expo mobile screens, WhatsApp/SMS, badge printing, UIDAI eKYC, linking visits to `ClientProfile`, automated purge job.
