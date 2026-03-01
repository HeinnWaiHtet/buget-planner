import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!
    );

    const { data, error } = await admin.from('payment_methods').select('id, name, created_by').limit(5);

    return NextResponse.json({
        data,
        error,
        has_admin: !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_ROLE
    });
}
