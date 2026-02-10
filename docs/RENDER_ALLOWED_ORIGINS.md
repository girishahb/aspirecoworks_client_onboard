# How to Set ALLOWED_ORIGINS on Render (Backend)

Your **backend** needs to know which **frontend URL(s)** are allowed to call its API. Otherwise the browser will block requests (CORS).

---

## Step 1: Get your frontend URL

- If your frontend is on Render, it looks like: **`https://<your-frontend-service-name>.onrender.com`**
- Example: **`https://aspirecoworks-frontend.onrender.com`**
- Copy this URL (no slash at the end).

---

## Step 2: Open your Backend service on Render

1. Go to **https://dashboard.render.com**
2. Log in.
3. Click your **backend** service (the one that runs the NestJS API, not the frontend).
4. You should see the service overview (logs, metrics, etc.).

---

## Step 3: Open the Environment tab

1. In the **top menu** of your backend service page, click **"Environment"**.
2. You’ll see a list of environment variables (or an empty list if you haven’t added any).

---

## Step 4: Add ALLOWED_ORIGINS

1. Click **"Add Environment Variable"** (or **"Add Variable"**).
2. In **Key**, type exactly:
   ```text
   ALLOWED_ORIGINS
   ```
3. In **Value**, paste your frontend URL, for example:
   ```text
   https://aspirecoworks-frontend.onrender.com
   ```
   - **Only one URL:** use that one, no comma.
   - **Multiple URLs:** separate with a comma, no spaces, e.g.:
     ```text
     https://aspirecoworks-frontend.onrender.com,https://www.yourdomain.com
     ```
4. Click **"Save Changes"** (or **"Save"**).

---

## Step 5: Let Render redeploy

- After you save, Render will **redeploy** your backend automatically.
- Wait until the deploy finishes (status becomes "Live" or "Succeeded").
- Then try opening your **frontend** in the browser and using the app; API calls should work if the frontend URL is in `ALLOWED_ORIGINS`.

---

## Quick checklist

- [ ] I’m on the **backend** service, not the frontend.
- [ ] I’m in the **Environment** tab.
- [ ] Key is exactly **ALLOWED_ORIGINS** (all caps).
- [ ] Value is my frontend URL (e.g. `https://aspirecoworks-frontend.onrender.com`) with no trailing slash.
- [ ] I saved and waited for the redeploy to finish.

---

## If you use a custom domain later

Add that domain to the same variable, comma-separated, for example:

```text
https://aspirecoworks-frontend.onrender.com,https://app.yourdomain.com
```

Then save again; Render will redeploy and the new origin will be allowed.
