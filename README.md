# Modelly

A web app that combines your photo with a model image to create a realistic personalized image using the NanoBanana AI model (outfit, pose, and style transfer while keeping your face recognizable).

## Features

- **Two image uploads**: Your photo (selfie or full-body) and a model/template image (outfit, pose, style)
- **Generate**: Sends both images to the backend; Nano Banana API produces the combined result
- **Preview & download**: View and save the result as PNG
- **Drag-and-drop** for both upload areas
- **Preset templates**: Optional model templates to try
- **Responsive** layout for desktop and mobile

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure an AI provider** (use one)

   Create `.env.local` in the project root.

   **Option A — fal.ai (recommended)**  
   Get a key at [fal.ai](https://fal.ai) and add:

   ```env
   FAL_KEY=your_fal_key_here
   ```

   **Option B — Nano Banana**  
   If `api.nano-banana.run` is reachable from your network, add:

   ```env
   NANO_BANANA_API_KEY=your_api_key_here
   ```

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run start` — Start production server

## Tech

- **Frontend**: Next.js 14 (App Router), React, CSS Modules
- **Backend**: Next.js Route Handler (`/api/generate`) with multipart uploads
- **AI**: Nano Banana API (`/v1/edit`) with a two-image composite and prompt for outfit/pose/style transfer

## Troubleshooting

- **"Can't reach the AI service" / "Nano Banana API unreachable"**  
  Use **fal.ai** instead: add `FAL_KEY` to `.env.local` (get a key at [fal.ai](https://fal.ai)). The app will use fal.ai Virtual Try-On when `FAL_KEY` is set.

## Notes

- Each image must be **4MB or smaller** (JPEG, PNG, or WebP).
- The backend composites your photo and the model image into a single image and sends it to the API with a prompt so the model can transfer outfit, pose, and style while keeping your face.
- For production, use environment variables and keep your API key secret.
