"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function addPaymentMethod(householdId: string, name: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Cookie: cookieStore
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
      },
    });

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return { data: null, error: "User not authenticated. Please log in again." };
    }

    // Verify user is a member of this household
    const { data: memberData, error: memberError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      console.error("Member error:", memberError);
      return { data: null, error: "You do not have access to this household" };
    }

    // Now insert the payment method
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
      return { data: null, error: "Failed to add payment method. Please try again." };
    }

    return { data, error: null };
  } catch (err) {
    console.error("Server error:", err);
    return { data: null, error: "An unexpected error occurred" };
  }
}

export async function deletePaymentMethod(householdId: string, id: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Cookie: cookieStore
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
      },
    });

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return { error: "User not authenticated. Please log in again." };
    }

    // Verify user is a member of this household
    const { data: memberData, error: memberError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      return { error: "You do not have access to this household" };
    }

    // Verify the payment method belongs to this household before deleting
    const { data: pmData, error: pmError } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("id", id)
      .eq("household_id", householdId)
      .single();

    if (pmError || !pmData) {
      return { error: "Payment method not found" };
    }

    // Now delete it
    const { error: deleteError } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting payment method:", deleteError);
      return { error: "Failed to delete payment method" };
    }

    return { error: null };
  } catch (err) {
    console.error("Server error:", err);
    return { error: "An unexpected error occurred" };
  }
}
