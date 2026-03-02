'use server';

import sharp from 'sharp';

/** Call this to verify Server Actions work (no upload, no body). */
export async function ping(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: 'Server is reachable. Generate should work.' };
}

const NANO_BANANA_API_URL =
  process.env.NANO_BANANA_API_URL || 'https://api.nano-banana.run/v1/edit';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getApiKey(): string | null {
  const k = process.env.NANO_BANANA_API_KEY;
  return (k && k.trim()) || null;
}

/** True if the key looks like a Google API key (use Gemini instead of Nano Banana). */
function isGoogleApiKey(key: string): boolean {
  return key.startsWith('AIzaSy');
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

    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        error:
          'No API key set. Add NANO_BANANA_API_KEY to .env.local (nano-banana.run or Google AI Studio key).',
      };
    }

    const compositeBuffer = await compositeImages(userBuffer, modelBuffer);
    const base64Image = compositeBuffer.toString('base64');
    const prompt =
      'The left image shows a person. The right image shows a model with an outfit, pose and style. ' +
      "Generate a single realistic image of the person from the left wearing the outfit and in the same pose and style as the right image. " +
      "Keep the person's face from the left image clearly recognizable. " +
      'Output only one combined image, no grid, no labels.';

    if (isGoogleApiKey(apiKey)) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: 'image/png', data: base64Image } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            responseMimeType: 'text/plain',
          },
        }),
      });
      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini API error:', geminiRes.status, errText);
        return {
          error:
            geminiRes.status === 401 || geminiRes.status === 403
              ? 'Invalid Google API key. Check NANO_BANANA_API_KEY in .env.local or get a key at aistudio.google.com.'
              : `AI failed: ${errText.slice(0, 150)}`,
        };
      }
      const geminiData = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> };
        }>;
      };
      const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return { image: `data:image/png;base64,${part.inlineData.data}` };
        }
      }
      return { error: 'Gemini did not return an image. Try again.' };
    }

    const response = await fetch(NANO_BANANA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
            : `AI failed: ${errText.slice(0, 150)}`,
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
          'AI service unreachable. If using a Google key (AIzaSy...), check it at aistudio.google.com. Otherwise check NANO_BANANA_API_KEY and network.',
      };
    }
    return { error: err.message };
  }
}
