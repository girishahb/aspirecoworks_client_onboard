# EAS init checklist (run once on your machine)

Expo/EAS login is interactive — you must do this locally (browser login).

## 1. Install & login

```bash
npm i -g eas-cli
cd aspirecoworks_client_onboard/mobile
eas login
```

Use your Expo account (create one at https://expo.dev if needed).

## 2. Link this folder to an Expo project

```bash
eas init
```

Answer:

- Create a new project? **Yes**
- Name: **aspire-coworks-mobile** (matches `app.json` slug)

This writes `extra.eas.projectId` into `app.json`. Commit that change.

## 3. Confirm package id

Already set:

- Android package: `com.aspirecoworks.clientops`

## 4. First internal APK

Set production API URL in `.env` first if building for staff:

```env
EXPO_PUBLIC_API_URL=https://YOUR-PUBLIC-API-HOST
```

Then:

```bash
eas build --profile preview --platform android
```

When asked about generating a keystore → **Yes** (let Expo manage it).

## 5. Play Store AAB (later)

```bash
eas build --profile production --platform android
```

Upload the `.aab` to Play Console → Internal testing.

See also: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
