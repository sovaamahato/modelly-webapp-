'use server';

import sharp from 'sharp';

/** Call this to verify Server Actions work (no upload, no body). */
export async function ping(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: 'Server is reachable. Generate should work.' };
}

const NANO_BANANA_API_URL =
  process.env.NANO_BANANA_API_URL || 'https://api.nano-banana.run/v1/edit';
const FAL_VIRTUAL_TRYON_URL = 'https://fal.run/fal-ai/image-apps-v2/virtual-try-on';
const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getFalKey(): string | null {
  const k = process.env.FAL_KEY;
  return (k && k.trim()) ? k.trim() : null;
}

function getNanoBananaKey(): string | null {
  const k = process.env.NANO_BANANA_API_KEY;
  return (k && k.trim()) || null;
}

async function compositeImages(userBuffer: Buffer, modelBuffer: Buffer): Promise<Buffer> {
  const [userMeta, modelMeta] = await Promise.all([
    sharp(userBuffer).metadata(),
    sharp(modelBuffer).metadata(),
  ]);
  const maxHeight = Math.max(userMeta.height ?? 512, modelMeta.height ?? 512);
  const targetHeight = Math.min(maxHeight, 1024);
  const padding = 24;

  const [userResized, modelResized] = await Promise.all([
    sharp(userBuffer).resize({ height: targetHeight, fit: 'inside' }).toBuffer(),
    sharp(modelBuffer).resize({ height: targetHeight, fit: 'inside' }).toBuffer(),
  ]);

  const [userW, modelW] = await Promise.all([
    sharp(userResized).metadata().then((m) => m.width ?? 400),
    sharp(modelResized).metadata().then((m) => m.width ?? 400),
  ]);

  const totalWidth = userW + padding + modelW + padding * 2;
  const totalHeight = targetHeight + padding * 2;

  return sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 22, g: 22, b: 26 },
    },
  })
    .png()
    .composite([
      { input: userResized, left: padding, top: padding },
      { input: modelResized, left: padding + userW + padding, top: padding },
    ])
    .toBuffer();
}

export type GenerateResult = { image?: string; error?: string };

export async function generateImage(formData: FormData): Promise<GenerateResult> {
  try {
    const userFile = formData.get('userImage') as File | null;
    const modelFile = formData.get('modelImage') as File | null;

    if (!userFile?.size || !modelFile?.size) {
      return { error: 'Both user image and model image are required.' };
    }
    if (userFile.size > MAX_SIZE_BYTES || modelFile.size > MAX_SIZE_BYTES) {
      return { error: 'Each image must be 4MB or smaller.' };
    }

    const userType = userFile.type.toLowerCase();
    const modelType = modelFile.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(userType) || !ALLOWED_TYPES.includes(modelType)) {
      return { error: 'Only JPEG, PNG, and WebP images are allowed.' };
    }

    const userBuffer = Buffer.from(await userFile.arrayBuffer());
    const modelBuffer = Buffer.from(await modelFile.arrayBuffer());

    const falKey = getFalKey();
    if (falKey) {
      if (falKey === 'your_fal_key_here' || falKey.length < 20) {
        return {
          error:
            'Replace your_fal_key_here in .env.local with your real key from https://fal.ai/dashboard/keys — then save and restart the dev server.',
        };
      }
      const personDataUri = `data:${userFile.type};base64,${userBuffer.toString('base64')}`;
      const clothingDataUri = `data:${modelFile.type};base64,${modelBuffer.toString('base64')}`;
      const response = await fetch(FAL_VIRTUAL_TRYON_URL, {
        method: 'POST',
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          person_image_url: personDataUri,
          clothing_image_url: clothingDataUri,
          preserve_pose: true,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('fal.ai error:', response.status, errText);
        return {
          error:
            response.status === 401
              ? 'Invalid FAL_KEY. Create a key at https://fal.ai/dashboard/keys (API scope), put it in .env.local as FAL_KEY=your_key with no quotes/spaces, save, then restart the dev server (Ctrl+C, npm run dev).'
              : `AI failed: ${errText.slice(0, 150)}`,
        };
      }
      const data = (await response.json()) as { images?: Array<{ url?: string }> };
      const imageUrl = data.images?.[0]?.url;
      if (!imageUrl) {
        return { error: 'AI did not return an image.' };
      }
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return { error: 'Could not fetch result image.' };
      }
      const arr = await imgRes.arrayBuffer();
      const imageBase64 = Buffer.from(arr).toString('base64');
      return { image: `data:image/png;base64,${imageBase64}` };
    }

    const nanoKey = getNanoBananaKey();
    if (!nanoKey) {
      return {
        error:
          'No API key set. Add FAL_KEY (get one at https://fal.ai) or NANO_BANANA_API_KEY to .env.local.',
      };
    }

    const compositeBuffer = await compositeImages(userBuffer, modelBuffer);
    const base64Image = compositeBuffer.toString('base64');
    const prompt =
      'The left image shows a person. The right image shows a model with an outfit, pose and style. ' +
      "Generate a single realistic image of the person from the left wearing the outfit and in the same pose and style as the right image. " +
      "Keep the person's face from the left image clearly recognizable. " +
      'Output only one combined image, no grid, no labels.';

    const response = await fetch(NANO_BANANA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nanoKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        prompt,
        model: 'nano-banana-v1',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Nano Banana API error:', response.status, errText);
      return {
        error:
          response.status === 401
            ? 'Invalid API key. Check NANO_BANANA_API_KEY in .env.local'
            : 'AI processing failed.',
      };
    }

    const data = (await response.json()) as {
      edited_image_url?: string;
      edited_image?: string;
      result?: string;
    };
    const imageUrl = data.edited_image_url ?? data.edited_image ?? data.result;
    if (!imageUrl) {
      return { error: 'AI did not return an image.' };
    }

    let imageBase64: string;
    if (imageUrl.startsWith('data:')) {
      imageBase64 = imageUrl.split(',')[1] ?? imageUrl;
    } else {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return { error: 'Could not fetch result image from AI provider.' };
      }
      const arr = await imgRes.arrayBuffer();
      imageBase64 = Buffer.from(arr).toString('base64');
    }

    return { image: `data:image/png;base64,${imageBase64}` };
  } catch (e) {
    const err = e instanceof Error ? e : new Error('Server error');
    const cause = err.cause as { code?: string } | undefined;
    const isNetwork =
      err.message === 'fetch failed' || cause?.code === 'ENOTFOUND';

    console.error('Generate error:', e);
    if (isNetwork) {
      return {
        error:
          "Nano Banana API unreachable. Use fal.ai instead: add FAL_KEY to .env.local (get a key at https://fal.ai).",
      };
    }
    return { error: err.message };
  }
}
