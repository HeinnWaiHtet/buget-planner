import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { action, householdId, name } = await request.json();

    const cookieStore = await cookies();
    const cookiesList = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const authHeader = request.headers.get("authorization");

    console.log("API Route - Cookies:", cookiesList ? "Present" : "Missing");
    console.log("API Route - Authorization header:", authHeader ? "Present" : "Missing");
    console.log("API Route - Action:", action);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          ...(cookiesList ? { Cookie: cookiesList } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      },
    });

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("API Route - User:", user?.id || "Not found");
    console.log("API Route - User Error:", userError?.message || "None");

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not authenticated. Please log in again." },
        { status: 401 }
      );
    }

    // Verify user is a member of this household
    const { data: memberData, error: memberError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: "You do not have access to this household" },
        { status: 403 }
      );
    }

    if (action === "add") {
      // Insert payment method. Row-level security may block this even for
      // authenticated users depending on DB policies. Preferably provide a
      // SUPABASE_SERVICE_ROLE_KEY env var so the server can perform the
      // insert after verifying membership. Service role bypasses RLS so we
      // still validate membership above to avoid granting access.
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

      if (serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await admin
          .from("payment_methods")
          .insert({
            household_id: householdId,
            name,
          })
          .select("id, name")
          .single();

        if (error) {
          console.error("Error adding payment method (admin):", error);
          return NextResponse.json(
            { error: "Failed to add payment method" },
            { status: 500 }
          );
        }

        return NextResponse.json({ data });
      }

      // Fallback: attempt insert with the current client (may fail due to RLS)
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          household_id: householdId,
          name,
        })
        .select("id, name")
        .single();

      if (error) {
        console.error("Error adding payment method:", error);
        return NextResponse.json(
          {
            error:
              "Failed to add payment method. If you see a row-level security error, set SUPABASE_SERVICE_ROLE_KEY on the server or use Supabase auth helpers.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ data });
    } else if (action === "delete") {
      // Verify the payment method belongs to this household
      const { data: pmData, error: pmError } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("id", name) // 'name' is actually the payment method ID in delete action
        .eq("household_id", householdId)
        .single();

      if (pmError || !pmData) {
        return NextResponse.json(
          { error: "Payment method not found" },
          { status: 404 }
        );
      }

      // Delete it. Use service role if available to bypass RLS after membership check.
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

      if (serviceRoleKey) {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { error: deleteError } = await admin
          .from("payment_methods")
          .delete()
          .eq("id", name);

        if (deleteError) {
          console.error("Error deleting payment method (admin):", deleteError);
          return NextResponse.json(
            { error: "Failed to delete payment method" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      // Fallback: attempt delete with current client (may fail due to RLS)
      const { error: deleteError } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", name);

      if (deleteError) {
        console.error("Error deleting payment method:", deleteError);
        return NextResponse.json(
          {
            error:
              "Failed to delete payment method. If you see a row-level security error, set SUPABASE_SERVICE_ROLE_KEY on the server or use Supabase auth helpers.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
