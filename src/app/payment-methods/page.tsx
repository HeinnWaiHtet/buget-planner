"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";

type PaymentMethod = {
  id: string;
  name: string;
  created_by: string | null;
};

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { user, householdId: hhId } = await ensureHouseholdForCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      if (!hhId) {
        console.error("Could not ensure household for user");
        router.replace("/settings");
        return;
      }

      setHouseholdId(hhId);
      setUserId(user.id);

      // Fetch payment methods and user role in parallel
      const [{ data: pmData, error: pmError }, { data: memberData }] = await Promise.all([
        supabase
          .from("payment_methods")
          .select("id, name, created_by")
          .eq("household_id", hhId)
          .order("name", { ascending: true }),
        supabase
          .from("household_members")
          .select("role")
          .eq("household_id", hhId)
          .eq("user_id", user.id)
          .maybeSingle()
      ]);

      if (memberData) setCurrentUserRole(memberData.role);

      if (pmError) {
        console.error("Error loading payment methods", pmError.message);
      } else if (pmData) {
        setPaymentMethods(pmData as PaymentMethod[]);
      }

      setLoading(false);
    };

    void load();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId || !name.trim()) return;

    setSaving(true);
    setError(null);

    if (editingId) {
      // Update existing
      const { data, error: updateError } = await supabase
        .from("payment_methods")
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingId)
        .eq("household_id", householdId)
        .select("id, name, created_by")
        .maybeSingle();

      setSaving(false);

      if (updateError || !data) {
        console.error("Error updating payment method:", updateError ? JSON.stringify(updateError) : "No rows updated (RLS blocked it)");
        setError(updateError?.message ? `Error: ${updateError.message}` : "Failed to update payment method. Check Supabase RLS policies.");
        return;
      }

      setPaymentMethods((prev) =>
        prev
          .map((pm) => (pm.id === editingId ? (data as PaymentMethod) : pm))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setName("");
    } else {
      // Insert new
      const { data, error: insertError } = await supabase
        .from("payment_methods")
        .insert({ household_id: householdId, name: name.trim(), created_by: userId })
        .select("id, name, created_by")
        .single();

      setSaving(false);

      if (insertError || !data) {
        console.error("Error adding payment method:", JSON.stringify(insertError));
        setError(insertError?.message ? `Error: ${insertError.message}` : "Failed to add payment method.");
        return;
      }

      setPaymentMethods((prev) =>
        [...prev, data as PaymentMethod].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
    }
  };

  const handleEdit = (pm: PaymentMethod) => {
    setEditingId(pm.id);
    setName(pm.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setError(null);
  };

  const onDelete = async (id: string, name: string) => {
    if (!householdId) return;

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Do you really want to delete "${name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    const { error: deleteError } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", id)
      .eq("household_id", householdId);

    if (deleteError) {
      console.error("Error deleting payment method:", JSON.stringify(deleteError));
      Swal.fire("Error", deleteError?.message ? `Error: ${deleteError.message}` : "Failed to delete payment method.", "error");
      setError(
        deleteError?.message
          ? `Error: ${deleteError.message} (code: ${deleteError.code})`
          : "Failed to delete payment method. RLS policy may be missing in Supabase."
      );
      return;
    }

    setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
  };

  if (loading) {
    return (
      <div className="flex w-full max-w-3xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading payment methods…</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 md:flex-row">
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-5/12">
        <h1 className="text-sm font-semibold text-slate-900">
          Manage payment methods
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Add or remove payment methods for your household.
        </p>
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="text-xs font-medium text-slate-700"
            >
              {editingId ? "Edit payment method name" : "Payment method name"}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              placeholder="Credit Card, Cash, Bank Transfer…"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update" : "Add method"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-7/12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            All payment methods
          </h2>
        </div>
        {paymentMethods.length === 0 ? (
          <p className="text-xs text-slate-500">
            No payment methods yet. Use the form on the left to add some.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((pm) => {
                  const canEdit = currentUserRole === "owner" || pm.created_by === userId;
                  return (
                    <tr
                      key={pm.id}
                      className="rounded-xl bg-slate-50 text-slate-900"
                    >
                      <td className="px-2 py-2 text-xs">{pm.name}</td>
                      <td className="px-2 py-2 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleEdit(pm)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(pm.id, pm.name)}
                              className="text-xs font-medium text-rose-600 hover:text-rose-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
