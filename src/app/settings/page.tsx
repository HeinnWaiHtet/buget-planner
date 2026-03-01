"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState("");

  // Array of member budgets
  const [memberBudgets, setMemberBudgets] = useState<Array<{
    userId: string;
    name: string;
    role: string;
    amount: string;
  }>>([]);

  const [savingHousehold, setSavingHousehold] = useState(false);
  const [savingBudget, setSavingBudget] = useState<{ [key: string]: boolean }>({});

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  useEffect(() => {
    const load = async () => {
      const { user, householdId: hhId } = await ensureHouseholdForCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      if (!hhId) {
        // No household yet — allow the UI to present create/join options.
        setHouseholdId(null);
        setLoading(false);
        return;
      }
      setHouseholdId(hhId);
      setUserId(user.id);

      const [{ data: household }, { data: members }, { data: budgets }] = await Promise.all([
        supabase.from("households").select("name").eq("id", hhId).single(),
        supabase.from("household_members").select("user_id, role, profiles(name)").eq("household_id", hhId),
        supabase.from("budgets").select("user_id, total_budget_amount").eq("household_id", hhId).eq("month", currentMonth),
      ]);

      if (household) {
        setHouseholdName((household as { name: string }).name);
      }

      const roleObj = members?.find((m) => m.user_id === user.id);
      const isOwner = roleObj?.role === "owner";
      setCurrentUserRole(roleObj?.role || null);

      if (members) {
        // Find budgets for each member
        const budgetList = members.map((m) => {
          const profile = m.profiles as unknown as { name: string };
          // For now, if user_id doesn't exist on budgets (schema pending), it will be undefined, so we default to ""
          const userObj = budgets?.find((b) => b.user_id === m.user_id) || budgets?.find((b) => !b.user_id);
          const amount = userObj ? String(userObj.total_budget_amount) : "";

          return {
            userId: m.user_id,
            name: profile?.name || "Unknown",
            role: m.role,
            amount: amount,
          };
        });

        // Show all if owner, else only show current user
        if (isOwner) {
          setMemberBudgets(budgetList);
        } else {
          setMemberBudgets(budgetList.filter((b) => b.userId === user.id));
        }
      }

      setLoading(false);
    };

    void load();
  }, [router, currentMonth]);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const submitHousehold = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId) return;

    setSavingHousehold(true);
    const { error } = await supabase
      .from("households")
      .update({ name: householdName })
      .eq("id", householdId);
    setSavingHousehold(false);

    if (error) {
      console.error("Error updating household name", error.message);
    }
  };

  const handleBudgetChange = (mUserId: string, val: string) => {
    setMemberBudgets(prev => prev.map(m => m.userId === mUserId ? { ...m, amount: val } : m));
  };

  const submitBudget = async (e: FormEvent, mUserId: string, amount: string) => {
    e.preventDefault();
    if (!householdId) return;

    setSavingBudget(prev => ({ ...prev, [mUserId]: true }));
    const { error } = await supabase.from("budgets").upsert(
      {
        household_id: householdId,
        month: currentMonth,
        user_id: mUserId,
        total_budget_amount: Number(amount),
      },
      { onConflict: "household_id,month,user_id" },
    );
    setSavingBudget(prev => ({ ...prev, [mUserId]: false }));

    if (error) {
      console.error("Error saving budget", error.message);
    }
  };

  const joinHousehold = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setJoining(true);
    // attach current session access token so the server can authenticate this request
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const resp = await fetch("/api/household/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: "join", householdId: joinCode }),
    });
    setJoining(false);

    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}));
      console.error("Join household failed:", json.error || resp.statusText);
      return;
    }

    const json = await resp.json();
    setHouseholdId(json.householdId || null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex w-full max-w-3xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading settings…</p>
      </div>
    );
  }

  if (!householdId) {
    // Let the user join a household before showing settings.
    return (
      <div className="w-full max-w-2xl">
        <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Join household</h2>
          <p className="mt-1 text-xs text-slate-500">If someone invited you, enter their household code to join.</p>
          <form onSubmit={joinHousehold} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="join-code" className="text-xs font-medium text-slate-700">Household code (ID)</label>
              <input id="join-code" type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring" />
            </div>
            <button type="submit" disabled={joining} className="mt-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">{joining ? "Joining…" : "Join household"}</button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
      {currentUserRole === "owner" && (
        <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <h1 className="text-sm font-semibold text-slate-900">
            Household settings
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Update your household name. Currency is fixed to JPY for now.
          </p>
          <form onSubmit={submitHousehold} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="hh-name"
                className="text-xs font-medium text-slate-700"
              >
                Household name
              </label>
              <input
                id="hh-name"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Currency
              </label>
              <input
                value="JPY (Japanese Yen)"
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingHousehold}
              className="mt-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingHousehold ? "Saving…" : "Save household"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">
          Monthly budgets ({currentMonth})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {currentUserRole === "owner"
            ? "Set the target total usage for each member in your household."
            : "Set your personal target total usage for this month."}
        </p>

        <div className="mt-4 space-y-5">
          {memberBudgets.map((mb) => (
            <form key={mb.userId} onSubmit={(e) => submitBudget(e, mb.userId, mb.amount)} className="space-y-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={`budget-${mb.userId}`}
                  className="text-xs font-medium flex items-center gap-2 text-slate-700"
                >
                  <span className="font-semibold text-slate-900">{mb.name}</span>
                  {mb.role === "owner" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 ring-1 ring-blue-200">Owner</span>}
                  {mb.userId === userId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200">You</span>}
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  id={`budget-${mb.userId}`}
                  type="number"
                  min={0}
                  step="1"
                  value={mb.amount}
                  onChange={(e) => handleBudgetChange(mb.userId, e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
                  placeholder="Example: 50000"
                />
                <button
                  type="submit"
                  disabled={savingBudget[mb.userId]}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingBudget[mb.userId] ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

