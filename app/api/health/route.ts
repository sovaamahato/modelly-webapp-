import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.NANO_BANANA_API_KEY?.trim();
  const provider = !key
    ? 'none (set NANO_BANANA_API_KEY in .env.local)'
    : key.startsWith('AIzaSy')
      ? 'Google Gemini'
      : 'Nano Banana';
  return NextResponse.json({
    ok: true,
    message: 'Modelly API is running',
    provider,
  });
}
