# Razorpay Webhook Troubleshooting

When payments show as "captured" in Razorpay but stay "Payment Pending" in the app, the webhook is likely failing. Follow these checks.

## 1. Webhook URL

Ensure Razorpay webhook is configured exactly:

```
https://aspirecoworks-client-onboard.onrender.com/webhooks/razorpay
```

- No trailing slash
- Must be HTTPS
- Path is `/webhooks/razorpay` (not `/webhook` or `/payment/webhook`)

## 2. RAZORPAY_WEBHOOK_SECRET (Most Common Issue)

**Critical:** When you create a webhook in Razorpay Dashboard, Razorpay shows a **Webhook Secret**. This MUST be set in Render:

1. Razorpay Dashboard → **Developers** → **Webhooks**
2. Click your webhook (or create one)
3. Copy the **Webhook Secret**
4. Render → Your Backend Service → **Environment**
5. Add: `RAZORPAY_WEBHOOK_SECRET` = (paste the secret)
6. Save and redeploy

**Test vs Live:** If using live keys (`RAZORPAY_MODE=live`), create the webhook in **Live mode** in Razorpay. Test and Live have separate webhooks and separate secrets.

If the secret is wrong or missing, webhook returns **401 Unauthorized** and Razorpay retries. The app never updates.

## 3. Subscribed Events

The webhook handles:

- `payment.captured` – payment successfully captured
- `order.paid` – order marked paid
- `payment_link.paid` – payment link fully paid

In Razorpay webhook settings, ensure **at least one** of these is enabled. For Payment Links, `payment_link.paid` is recommended.

## 4. Check Render Logs

Render → Your Service → **Logs**

Look for:

- `Razorpay webhook: payment X marked PAID` – success
- `Invalid webhook signature` – wrong `RAZORPAY_WEBHOOK_SECRET`
- `No matching payment found` – payload / matching issue
- `Missing x-razorpay-signature` – Razorpay not sending the header

## 5. Manual Fix for Stuck Payment

If a payment is already captured in Razorpay but stuck as Pending in the app:

1. Admin → Company → Payments
2. Use **Mark as Paid** or **Resend Payment Link** (if your UI exposes it)
3. Or call: `POST /admin/payments/:paymentId/mark-paid` with Razorpay payment ID

## 6. Verify Env Vars on Render

All of these must be set for the backend:

| Variable | Required | Description |
|----------|----------|-------------|
| `RAZORPAY_KEY_ID` | Yes | From Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Yes | From Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | From webhook settings (per webhook) |
| `RAZORPAY_MODE` | Yes | `test` or `live` |

## 7. Redeploy After Changes

After updating env vars or webhook config, **redeploy** the backend on Render so the new values are applied.
