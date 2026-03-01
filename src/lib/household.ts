import { supabase } from "./supabaseClient";

export async function ensureHouseholdForCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, householdId: null };
  }

  // Try to find existing membership
  const { data: memberRows, error: memberError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberError) {
    console.error("Error loading household membership", memberError.message);
    return { user, householdId: null };
  }

  if (memberRows && memberRows.length > 0) {
    return { user, householdId: memberRows[0].household_id as string };
  }

  // If the user is not a member of any household, return null for householdId.
  // Household creation or joining should be performed via a server endpoint
  // that can use the SUPABASE_SERVICE_ROLE_KEY to bypass RLS safely.
  return { user, householdId: null };
}

