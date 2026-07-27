# Forma — AI Weight Coach

A calm, mobile-first personal tracker designed to help users pause before eating, understand their remaining energy budget, and build sustainable habits.

## Current capabilities

- Installable web app with custom phone icons and offline shell
- Daily meal, calorie and macro logging
- Browser voice entry with manual confirmation
- Water and weight tracking
- Editable daily goals
- Seven-day meal and weight history
- Device-local private storage

## Current limitation

The first release stores entries only on the device where they were created. Cloud accounts and cross-device sync require a separate database service and are intentionally not simulated.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 16 and React 19
- TypeScript
- Custom responsive CSS
- Lucide icons

## Deployment

Automatically deployed with Vercel from the `main` branch.
