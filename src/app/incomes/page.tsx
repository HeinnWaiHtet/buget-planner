"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Income = {
  id: string;
  household_id: string;
  title: string;
  amount: number;
  date: string;
  type: string;
  created_by: string;
};
// Removed duplicate Income type

export default function IncomesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"salary" | "bonus" | "other">("salary");
  const [saving, setSaving] = useState(false);

  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState<"salary" | "bonus" | "other">("salary");
  const [editSaving, setEditSaving] = useState(false);

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

      setUserId(user.id);
      setHouseholdId(hhId);

      const { data: incomeRows, error: incomeError } = await supabase
        .from("incomes")
        .select("id, amount, date, title, type, created_by")
        .eq("household_id", hhId)
        .order("date", { ascending: false });

      if (incomeError) {
        console.error("Error loading incomes", incomeError.message);
      } else if (incomeRows) {
        setIncomes(incomeRows as Income[]);
      }

      setLoading(false);
    };

    void load();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId || !userId) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("incomes")
      .insert({
        household_id: householdId,
        created_by: userId,
        title,
        amount: Number(amount),
        date,
        type,
      })
      .select("id, amount, date, title, type")
      .single();

    setSaving(false);

    if (error || !data) {
      console.error("Error inserting income", error?.message);
      return;
    }

    setIncomes((prev) => [data as Income, ...prev]);
    setTitle("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setType("salary");
  };

  const onEdit = (income: Income) => {
    setEditingIncome(income);
    setEditTitle(income.title);
    setEditAmount(String(income.amount));
    setEditDate(income.date);
    setEditType(income.type as "salary" | "bonus" | "other");
  };

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingIncome || !householdId || !userId) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("incomes")
      .update({
        title: editTitle,
        amount: Number(editAmount),
        date: editDate,
        type: editType,
      })
      .eq("id", editingIncome.id)
      .eq("created_by", userId);
    setEditSaving(false);
    if (error) {
      console.error("Error editing income", error.message);
      return;
    }
    setIncomes((prev) =>
      prev.map((inc) =>
        inc.id === editingIncome.id
          ? { ...inc, title: editTitle, amount: Number(editAmount), date: editDate, type: editType }
          : inc
      )
    );
    setEditingIncome(null);
  };

  const onDelete = async (incomeId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("id", incomeId)
      .eq("created_by", userId);
    if (error) {
      console.error("Error deleting income", error.message);
      return;
    }
    setIncomes((prev) => prev.filter((inc) => inc.id !== incomeId));
  };

  if (loading) {
    return (
      <div className="flex w-full max-w-3xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 md:flex-row">
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-5/12">
        <h1 className="text-sm font-semibold text-slate-900">
          {t("incomes.add")}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {t("incomes.addDesc")}
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="title"
              className="text-xs font-medium text-slate-700"
            >
              {t("incomes.form.title")}
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              placeholder={`${t("incomes.type.salary")}, ${t("incomes.type.bonus")}…`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="amount"
                className="text-xs font-medium text-slate-700"
              >
                {t("incomes.form.amount")}
              </label>
              <input
                id="amount"
                type="number"
                min={0}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="date"
                className="text-xs font-medium text-slate-700"
              >
                {t("common.date")}
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="type"
              className="text-xs font-medium text-slate-700"
            >
              {t("common.type")}
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "salary" | "bonus" | "other")
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
            >
              <option value="salary">{t("incomes.type.salary")}</option>
              <option value="bonus">{t("incomes.type.bonus")}</option>
              <option value="other">{t("incomes.type.other")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("incomes.save")}
          </button>
        </form>
      </section>
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-7/12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("incomes.title")}
          </h2>
        </div>
        {incomes.length === 0 ? (
          <p className="text-xs text-slate-500">
            {t("incomes.empty")}
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">{t("common.name")}</th>
                  <th className="px-2 py-1 text-left">{t("common.type")}</th>
                  <th className="px-2 py-1 text-left">{t("common.date")}</th>
                  <th className="px-2 py-1 text-right">{t("common.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <tr
                    key={income.id}
                    className="rounded-xl bg-slate-50 text-slate-900"
                  >
                    <td className="px-2 py-2 text-xs font-medium">{income.title}</td>
                    <td className="px-2 py-2 text-[11px] capitalize text-slate-600">
                      {income.type === "salary"
                        ? t("incomes.type.salary")
                        : income.type === "bonus"
                        ? t("incomes.type.bonus")
                        : t("incomes.type.other")}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-600">
                      {new Date(income.date).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold">
                      ¥{Number(income.amount).toLocaleString("ja-JP")}
                    </td>
                    {income.created_by === userId && (
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          className="mr-2 text-xs text-blue-600 hover:underline"
                          onClick={() => onEdit(income)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-rose-600 hover:underline"
                          onClick={() => onDelete(income.id)}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editingIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30">
          <form
            onSubmit={onEditSubmit}
            className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200 w-full max-w-sm"
          >
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Edit Income</h2>
            <div className="space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Title"
              />
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Amount"
              />
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as "salary" | "bonus" | "other")}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="salary">Salary</option>
                <option value="bonus">Bonus</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-60"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300"
                onClick={() => setEditingIncome(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

