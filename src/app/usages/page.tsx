"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type UsageRow = {
  id: string;
  amount: number;
  date: string;
  need_or_waste: "need" | "waste";
  note: string | null;
  category: { name: string; group_name: string } | null;
  payment_method: { name: string } | null;
  created_by: string;
  category_id?: string;
  payment_method_id?: string;
};

type Category = {
  id: string;
  name: string;
  group_name: string;
};

type PaymentMethod = {
  id: string;
  name: string;
};

export default function UsagesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [usages, setUsages] = useState<UsageRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [needOrWaste, setNeedOrWaste] = useState<"need" | "waste">("need");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

      const [{ data: categoriesData }, { data: paymentData }] = await Promise.all([
        supabase
          .from("usage_categories")
          .select("id, name, group_name")
          .eq("household_id", hhId)
          .order("group_name", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("payment_methods")
          .select("id, name")
          .eq("household_id", hhId)
          .order("name", { ascending: true }),
      ]);

      console.log("Payment methods loaded:", paymentData);
      setCategories((categoriesData as Category[]) ?? []);
      setPaymentMethods((paymentData as PaymentMethod[]) ?? []);

      if (categoriesData && categoriesData.length > 0) {
        setCategoryId(categoriesData[0].id);
      }
      if (paymentData && paymentData.length > 0) {
        setPaymentMethodId(paymentData[0].id);
        console.log("Set initial payment method to:", paymentData[0].id);
      } else {
        console.warn("No payment methods found for household:", hhId);
      }

      const { data: usageRows, error: usageError } = await supabase
        .from("usages")
        .select(
          "id, amount, date, need_or_waste, note, created_by, category_id, payment_method_id, category:usage_categories(name, group_name), payment_method:payment_methods(name)",
        )
        .eq("household_id", hhId)
        .order("date", { ascending: false });

      if (usageError) {
        console.error("Error loading usages", usageError.message);
      } else if (usageRows) {
        setUsages((usageRows as unknown) as UsageRow[]);
      }

      setLoading(false);
    };

    void load();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!householdId || !userId || !categoryId || !paymentMethodId) return;

    setSaving(true);

    let attachmentUrl: string | null = null;
    if (file) {
      const filePath = `${householdId}/${crypto.randomUUID()}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Receipt upload error", uploadError.message);
      } else {
        attachmentUrl = filePath;
      }
    }

    const payload: any = {
      household_id: householdId,
      amount: Number(amount),
      date,
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      need_or_waste: needOrWaste,
      note: note || null,
    };
    if (attachmentUrl) payload.attachment_url = attachmentUrl;

    if (editingId) {
      const { data, error } = await supabase
        .from("usages")
        .update(payload)
        .eq("id", editingId)
        .select(
          "id, amount, date, need_or_waste, note, created_by, category_id, payment_method_id, category:usage_categories(name, group_name), payment_method:payment_methods(name)",
        )
        .single();
      setSaving(false);
      if (error || !data) {
        console.error("Error updating usage", error?.message);
        return;
      }
      setUsages((prev) => prev.map((u) => (u.id === editingId ? (data as unknown as UsageRow) : u)));
    } else {
      payload.created_by = userId;
      const { data, error } = await supabase
        .from("usages")
        .insert(payload)
        .select(
          "id, amount, date, need_or_waste, note, created_by, category_id, payment_method_id, category:usage_categories(name, group_name), payment_method:payment_methods(name)",
        )
        .single();

      setSaving(false);

      if (error || !data) {
        console.error("Error inserting usage", error?.message);
        return;
      }

      setUsages((prev) => [(data as unknown) as UsageRow, ...prev]);
    }

    setAmount("");
    setNote("");
    setFile(null);
    setDate(new Date().toISOString().slice(0, 10));
    setNeedOrWaste("need");
    setEditingId(null);
  };

  const handleEdit = (u: UsageRow) => {
    setEditingId(u.id);
    setAmount(u.amount.toString());

    // Convert to YYYY-MM-DD format for the date input
    const dateObj = new Date(u.date);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${d}`);

    setNeedOrWaste(u.need_or_waste);
    setNote(u.note || "");
    if (u.category_id) setCategoryId(u.category_id);
    if (u.payment_method_id) setPaymentMethodId(u.payment_method_id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: t("common.confirmDelete") ?? "Are you sure you want to delete this?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: t("common.delete") ?? "Delete",
      cancelButtonText: t("common.cancel") ?? "Cancel"
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from("usages").delete().eq("id", id);
    if (error) {
      console.error("Error deleting usage", error.message);
      Swal.fire("Error", "Could not delete usage.", "error");
      return;
    }
    setUsages((prev) => prev.filter((u) => u.id !== id));
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
          {editingId ? t("usages.edit") ?? "Edit Usage" : t("usages.add")}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {t("usages.addDesc")}
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="amount"
                className="text-xs font-medium text-slate-700"
              >
                {t("usages.form.amount")}
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
            <span className="text-xs font-medium text-slate-700">
              {t("usages.form.needOrWaste")}
            </span>
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setNeedOrWaste("need")}
                className={`flex-1 rounded-full px-3 py-1 ${needOrWaste === "need"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-600"
                  }`}
              >
                {t("dashboard.need")}
              </button>
              <button
                type="button"
                onClick={() => setNeedOrWaste("waste")}
                className={`flex-1 rounded-full px-3 py-1 ${needOrWaste === "waste"
                  ? "bg-rose-500 text-white"
                  : "text-slate-600"
                  }`}
              >
                {t("dashboard.waste")}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="category"
              className="text-xs font-medium text-slate-700"
            >
              {t("usages.form.category")}
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.group_name} · {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="payment"
              className="text-xs font-medium text-slate-700"
            >
              {t("usages.form.paymentMethod")}
            </label>
            <select
              id="payment"
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
            >
              {paymentMethods.length === 0 ? (
                <option value="">{t("usages.form.selectPaymentMethod")}</option>
              ) : (
                paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="note"
              className="text-xs font-medium text-slate-700"
            >
              {t("usages.form.note")}
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              placeholder={t("usages.form.notePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="receipt"
              className="text-xs font-medium text-slate-700"
            >
              {t("usages.form.receipt")}
            </label>
            <input
              id="receipt"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-slate-600"
            />
          </div>
          <div className="flex gap-2 w-full mt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? t("common.saving") : (editingId ? t("common.update") ?? "Update" : t("usages.save"))}
            </button>
            {editingId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditingId(null);
                  setAmount("");
                  setNote("");
                  setDate(new Date().toISOString().slice(0, 10));
                }}
                className="inline-flex items-center justify-center rounded-full bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("common.cancel") ?? "Cancel"}
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="w-full rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200 md:w-7/12">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t("usages.title")}</h2>
        </div>
        {usages.length === 0 ? (
          <p className="text-xs text-slate-500">
            {t("usages.empty")}
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">{t("usages.form.category")}</th>
                  <th className="px-2 py-1 text-left">{t("usages.form.needOrWaste")}</th>
                  <th className="px-2 py-1 text-left">{t("usages.table.payment")}</th>
                  <th className="px-2 py-1 text-left">{t("common.date")}</th>
                  <th className="px-2 py-1 text-left">{t("common.note")}</th>
                  <th className="px-2 py-1 text-right">{t("common.amount")}</th>
                  <th className="px-2 py-1 text-right">{t("common.actions") ?? "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {usages.map((u) => (
                  <tr
                    key={u.id}
                    className="rounded-xl bg-slate-50 text-slate-900"
                  >
                    <td className="px-2 py-2 text-xs">
                      {u.category
                        ? `${u.category.group_name} · ${u.category.name}`
                        : "-"}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${u.need_or_waste === "need"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                          }`}
                      >
                        {u.need_or_waste === "need" ? t("dashboard.need") : t("dashboard.waste")}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-600">
                      {u.payment_method ? u.payment_method.name : "-"}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-600">
                      {new Date(u.date).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-600">
                      {u.note || "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold">
                      ¥{Number(u.amount).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {u.created_by === userId ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(u)}
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-500"
                          >
                            {t("common.edit") ?? "Edit"}
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-[11px] font-medium text-rose-600 hover:text-rose-500"
                          >
                            {t("common.delete") ?? "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

