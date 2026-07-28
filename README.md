# Forma — AI Weight Coach

A calm, photo-first personal tracker designed to make food logging take seconds instead of manual data entry.

## Current capabilities

- Installable web app with custom phone icons and offline shell
- Camera-first food logging with AI calorie and macro estimates
- One-tap confirmation with optional corrections
- Browser voice entry with manual confirmation
- Water and weight tracking
- Editable daily goals
- Seven-day meal and weight history
- Device-local private storage

Food photos are resized on the phone, sent to the server only for analysis, and are not saved in the meal history. Set `OPENAI_API_KEY` in Vercel to activate photo analysis. `OPENAI_FOOD_MODEL` is optional and defaults to `gpt-5.6-luna`.

## Current limitation

Entries remain on the device where they were created. Cloud accounts and cross-device sync require a separate database service. Photo nutrition results are practical estimates; hidden ingredients, cooking oil, and unknown portion weight can affect accuracy.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 16 and React 19
- TypeScript
- OpenAI Responses API with image input and structured output
- Custom responsive CSS
- Lucide icons

## Deployment

Automatically deployed with Vercel from the `main` branch.
