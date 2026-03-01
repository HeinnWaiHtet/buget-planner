import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Create profile (use upsert to avoid duplicate failures)
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: userId, name }, { onConflict: ["id"] });

    if (profileError) {
      console.error("Profile insert error (admin):", profileError.message);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    // Create household
    const { data: householdData, error: householdError } = await admin
      .from("households")
      .insert({ name: `${name}'s household` })
      .select("id")
      .single();

    if (householdError || !householdData) {
      console.error("Household insert error (admin):", householdError?.message);
      return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
    }

    const householdId = householdData.id as string;

    // Link user as household owner
    const { error: memberError } = await admin.from("household_members").insert({
      household_id: householdId,
      user_id: userId,
      role: "owner",
    });

    if (memberError) {
      console.error("Household member insert error (admin):", memberError.message);
      return NextResponse.json({ error: "Failed to link household member" }, { status: 500 });
    }

    // Seed defaults
    const defaultCategories = [
      { group_name: "Home", name: "Rent" },
      { group_name: "Home", name: "Electric bill" },
      { group_name: "Food", name: "Groceries" },
      { group_name: "Education", name: "Tuition" },
      { group_name: "Fun", name: "Party" },
    ].map((c) => ({
      ...c,
      household_id: householdId,
      is_default: true,
    }));

    const defaultPaymentMethods = [
      { name: "Cash" },
      { name: "Credit Card" },
      { name: "Bank Transfer" },
    ].map((m) => ({
      ...m,
      household_id: householdId,
    }));

    const { error: categoriesError } = await admin
      .from("usage_categories")
      .insert(defaultCategories);

    if (categoriesError) {
      console.error("Default categories insert error (admin):", categoriesError.message);
    }

    const { error: paymentMethodsError } = await admin
      .from("payment_methods")
      .insert(defaultPaymentMethods);

    if (paymentMethodsError) {
      console.error("Default payment methods insert error (admin):", paymentMethodsError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Register-setup server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
