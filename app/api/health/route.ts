import { NextResponse } from 'next/server';

export async function GET() {
  const falKey = process.env.FAL_KEY?.trim();
  const nanoKey = process.env.NANO_BANANA_API_KEY?.trim();
  return NextResponse.json({
    ok: true,
    message: 'Modelly API is running',
    provider: falKey ? 'fal.ai' : nanoKey ? 'Nano Banana' : 'none (set FAL_KEY or NANO_BANANA_API_KEY)',
  });
}
