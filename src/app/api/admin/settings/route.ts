import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const updateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
});

function getToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7) || null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const token = getToken(request);
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const supabase = createServerClient(token);
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value, updated_at');

  if (error) {
    console.error('Failed to read app_settings:', error);
    return NextResponse.json(
      { error: 'Failed to read settings' },
      { status: 500 },
    );
  }

  // Return as a key-value map
  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const token = getToken(request);
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const body: unknown = await request.json();
  const parsed = updateSettingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { key, value } = parsed.data;

  const supabase = createServerClient(token);
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

  if (error) {
    console.error('Failed to update app_settings:', error);
    return NextResponse.json(
      { error: 'Failed to save setting' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, key, value });
}
