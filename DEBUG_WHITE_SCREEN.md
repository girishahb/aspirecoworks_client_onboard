# Debugging White Screen Issue

## Quick Checks

1. **Open Browser Console** (F12 or Right-click → Inspect → Console)
   - Look for red error messages
   - Common errors:
     - "Cannot read property X of undefined"
     - "Module not found"
     - "Unexpected token"

2. **Check Network Tab**
   - Verify all files are loading (200 status)
   - Check if `main.tsx` is loading
   - Check if CSS files are loading

3. **Verify Backend is Running**
   - Backend should be on `http://localhost:3000`
   - Test: `curl http://localhost:3000/health`

4. **Check Environment Variables**
   - Frontend `.env` should have: `VITE_API_BASE_URL=http://localhost:3000`

## Common Fixes

### Fix 1: Clear Browser Cache
```bash
# In browser: Ctrl+Shift+Delete → Clear cache
# Or hard refresh: Ctrl+F5
```

### Fix 2: Restart Dev Server
```bash
# Stop the dev server (Ctrl+C)
cd frontend
npm run dev
```

### Fix 3: Check for Missing Dependencies
```bash
cd frontend
npm install
```

### Fix 4: Check TypeScript Errors
```bash
cd frontend
npm run build
# Fix any TypeScript errors shown
```

### Fix 5: Verify Route Structure
The admin login route should be:
- Path: `/admin/login`
- Component: `AdminLogin`
- Wrapped in: `Layout` component

## Test AdminLogin Directly

Create a test file `frontend/test-admin.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Admin Login</title>
</head>
<body>
  <h1>If you see this, HTML is working</h1>
  <script>
    console.log('JavaScript is working');
  </script>
</body>
</html>
```

Open `http://localhost:5173/test-admin.html` - if this works, the issue is in React/TypeScript.

## Check Browser Console

Open `http://localhost:5173/admin/login` and check console for:

1. **React Errors**: Usually show component name and line number
2. **Import Errors**: "Cannot resolve module X"
3. **Type Errors**: TypeScript runtime errors
4. **Network Errors**: Failed API calls

## Quick Test Component

If AdminLogin isn't rendering, try accessing a simpler route first:
- `http://localhost:5173/login` (regular login)
- `http://localhost:5173/` (should redirect to login)

If these work but `/admin/login` doesn't, the issue is in the admin route structure.
