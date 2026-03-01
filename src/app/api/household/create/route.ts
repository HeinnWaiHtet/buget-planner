import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, householdId, userId } = body;

    const cookieStore = await cookies();
    const cookiesList = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const authHeader = request.headers.get("authorization");

    // Create a client with the same cookies and/or authorization header so we can identify the current user
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { ...(cookiesList ? { Cookie: cookiesList } : {}), ...(authHeader ? { Authorization: authHeader } : {}) } },
    });

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    // If there's no authenticated user via cookie, that's okay as long as the
    // caller provided a `userId` in the request body (used for post-signup setup).
    if (userError) {
      console.error("Auth cookie lookup error:", userError.message);
    }

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    const admin = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    const db = admin ?? client;

    // Debug info: whether admin (service role) is present and resolved user id
    console.log("Household create API - admin present:", !!serviceRoleKey);
    console.log("Household create API - resolved user id:", user?.id || null, "provided userId:", userId || null);

    // If caller provided a userId (e.g. immediately after signUp), use the
    // service role to perform profile/household creation without requiring
    // an auth cookie on the request.
    if (action === "create") {
      const actorId = userId || user?.id;

      if (!actorId) {
        return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
      }

      // Upsert profile (best-effort)
      try {
        const { error: profileErr } = await db
          .from("profiles")
          .upsert({ id: actorId, name: name || null }, { onConflict: "id" });
        if (profileErr) console.error("Profile upsert error:", profileErr.message || profileErr);
      } catch (e) {
        console.error("Profile upsert error:", e);
      }

      // create household and link provided userId (or authenticated user)
      const hhName = name || (user ? `${user.email?.split("@")[0]}'s household` : "My household");
      const { data: hhData, error: hhError } = await db
        .from("households")
        .insert({ name: hhName })
        .select("id")
        .single();

      if (hhError || !hhData) {
        console.error("Household create error:", hhError?.message || hhError);
        return NextResponse.json({ error: hhError?.message || "Failed to create household" }, { status: 500 });
      }

      const hhId = hhData.id as string;

      const { error: memberError } = await db.from("household_members").insert({
        household_id: hhId,
        user_id: actorId,
        role: "owner",
      });

      if (memberError) {
        console.error("Household member insert error:", memberError.message || memberError);
        return NextResponse.json({ error: memberError?.message || "Failed to link household member" }, { status: 500 });
      }

      // Optionally seed defaults (best-effort)
      const defaultCategories = [
        { group_name: "Home", name: "Rent" },
        { group_name: "Home", name: "Electric bill" },
        { group_name: "Food", name: "Groceries" },
        { group_name: "Education", name: "Tuition" },
        { group_name: "Fun", name: "Party" },
      ].map((c) => ({ ...c, household_id: hhId, is_default: true }));

      const defaultPaymentMethods = [
        { name: "Cash" },
        { name: "Credit Card" },
        { name: "Bank Transfer" },
      ].map((m) => ({ ...m, household_id: hhId }));

      try {
        const { error: categoriesErr } = await db.from("usage_categories").insert(defaultCategories);
        if (categoriesErr) console.error("Default categories insert error:", categoriesErr.message || categoriesErr);
      } catch (e) {
        console.error(e);
      }

      try {
        const { error: paymentMethodsErr } = await db.from("payment_methods").insert(defaultPaymentMethods);
        if (paymentMethodsErr) console.error("Default payment methods insert error:", paymentMethodsErr.message || paymentMethodsErr);
      } catch (e) {
        console.error(e);
      }

      return NextResponse.json({ householdId: hhId });
    }

    if (action === "join") {
      if (!householdId) return NextResponse.json({ error: "householdId required" }, { status: 400 });

      // If we have a logged-in user available from cookies, use that; otherwise
      // joining requires an authenticated user.
      const actorId = userId || user?.id;
      if (!actorId) return NextResponse.json({ error: "User not authenticated" }, { status: 401 });

      console.log("Join action: householdId:", householdId, "actorId:", actorId);

      // Attempt to join (insert into household_members)
      // If the household doesn't exist, the FK constraint will fail
      const { error: memberErr } = await db.from("household_members").insert({
        household_id: householdId,
        user_id: actorId,
        role: "member",
      });

      if (memberErr) {
        console.error("Join household - member insert error:", memberErr.message);
        // Check if it's a FK constraint error (household not found)
        if (memberErr.message?.includes("household_members_household_id_fkey")) {
          return NextResponse.json({ error: "Household not found" }, { status: 404 });
        }
        // Check if it's a duplicate member error
        if (memberErr.message?.includes("duplicate")) {
          return NextResponse.json({ error: "You are already a member of this household" }, { status: 400 });
        }
        // RLS error or other database issue
        return NextResponse.json({ error: memberErr.message || "Failed to join household" }, { status: 500 });
      }

      console.log("Join successful for householdId:", householdId);
      return NextResponse.json({ householdId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Household create API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
