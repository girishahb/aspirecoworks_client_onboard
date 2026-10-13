# Aspire Coworks Mobile

Expo (React Native) client for reception lookup, staff client entry, and finance money screens.

## Setup

```bash
cd mobile
npm install
cp .env.example .env
# set EXPO_PUBLIC_API_URL to your Nest API (use LAN IP for physical device)
npx expo start
```

## Demo users

| Role | Email | Password |
|------|-------|----------|
| Reception | reception@aspirecoworks.com | Reception123! |
| Staff | staff@aspirecoworks.com | Staff123! |
| Finance | finance@aspirecoworks.com | Finance123! |

## EAS internal build

Interactive one-time setup (you must run this on your PC):

See **[EAS_INIT.md](./EAS_INIT.md)** — `eas login` → `eas init` → `eas build`.

```bash
npm i -g eas-cli
cd mobile
eas login
eas init
eas build --profile preview --platform android
```
