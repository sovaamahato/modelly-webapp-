import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const NANO_BANANA_API_URL = 'https://api.nano-banana.run/v1/edit';
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB per image (keeps total request size manageable)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const maxDuration = 60;

function getApiKey(): string {
  const key = process.env.NANO_BANANA_API_KEY;
  if (!key) {
    throw new Error('NANO_BANANA_API_KEY is not set. Add it to .env.local');
  }
  return key;
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
    sharp(userBuffer)
      .resize({ height: targetHeight, fit: 'inside' })
      .toBuffer(),
    sharp(modelBuffer)
      .resize({ height: targetHeight, fit: 'inside' })
      .toBuffer(),
  ]);

  const [userW, modelW] = await Promise.all([
    sharp(userResized).metadata().then((m) => m.width ?? 400),
    sharp(modelResized).metadata().then((m) => m.width ?? 400),
  ]);

  const totalWidth = userW + padding + modelW + padding * 2;
  const totalHeight = targetHeight + padding * 2;

  const composite = await sharp({
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

  return composite;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userFile = formData.get('userImage') as File | null;
    const modelFile = formData.get('modelImage') as File | null;

    if (!userFile?.size || !modelFile?.size) {
      return NextResponse.json(
        { error: 'Both user image and model image are required.' },
        { status: 400 }
      );
    }

    if (userFile.size > MAX_SIZE_BYTES || modelFile.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Each image must be 8MB or smaller.' },
        { status: 400 }
      );
    }

    const userType = userFile.type.toLowerCase();
    const modelType = modelFile.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(userType) || !ALLOWED_TYPES.includes(modelType)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    const userBuffer = Buffer.from(await userFile.arrayBuffer());
    const modelBuffer = Buffer.from(await modelFile.arrayBuffer());

    const compositeBuffer = await compositeImages(userBuffer, modelBuffer);
    const base64Image = compositeBuffer.toString('base64');

    const apiKey = getApiKey();
    const prompt =
      'The left image shows a person. The right image shows a model with an outfit, pose and style. ' +
      'Generate a single realistic image of the person from the left wearing the outfit and in the same pose and style as the right image. ' +
      'Keep the person\'s face from the left image clearly recognizable. ' +
      'Output only one combined image, no grid, no labels.';

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
      return NextResponse.json(
        {
          error: 'AI processing failed.',
          details: response.status === 401
            ? 'Invalid API key. Check NANO_BANANA_API_KEY in .env.local'
            : errText.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      success?: boolean;
      edited_image_url?: string;
      edited_image?: string;
      result?: string;
    };

    const imageUrl = data.edited_image_url ?? data.edited_image ?? data.result;
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'AI did not return an image.' },
        { status: 502 }
      );
    }

    let imageBase64: string;
    if (imageUrl.startsWith('data:')) {
      imageBase64 = imageUrl.split(',')[1] ?? imageUrl;
    } else {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: 'Could not fetch result image from AI provider.' },
          { status: 502 }
        );
      }
      const arr = await imgRes.arrayBuffer();
      imageBase64 = Buffer.from(arr).toString('base64');
    }

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    console.error('Generate error:', e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
