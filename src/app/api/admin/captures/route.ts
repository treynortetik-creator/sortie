import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase service role not configured' },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Admin: failed to load captures:', error);
    return NextResponse.json(
      { error: 'Failed to load captures' },
      { status: 500 },
    );
  }

  return NextResponse.json({ captures: data ?? [] });
}
