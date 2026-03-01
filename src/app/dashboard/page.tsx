"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type Income = {
  id: string;
  amount: number;
  date: string;
  title: string;
  type: string;
};

type Usage = {
  id: string;
  amount: number;
  date: string;
  need_or_waste: "need" | "waste";
  note: string | null;
  category: { name: string; group_name: string } | null;
  created_by?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);
  const [userIncomes, setUserIncomes] = useState<Income[]>([]);
  const [userUsages, setUserUsages] = useState<Usage[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Month/Year filter
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const [filterByMonth, setFilterByMonth] = useState(true);
  const [showPrevious, setShowPrevious] = useState(false);

  // Format as YYYY-MM-DD local avoiding timezone shifts
  const getLocalYMD = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Calculate fromDate and toDate based on toggles
  let fromDate: string, toDate: string;
  if (filterByMonth) {
    if (showPrevious) {
      // Show all data from selected month to end of year
      fromDate = getLocalYMD(new Date(selectedYear, selectedMonth, 1));
      toDate = getLocalYMD(new Date(selectedYear, 11, 31));
    } else {
      // Only selected month
      fromDate = getLocalYMD(new Date(selectedYear, selectedMonth, 1));
      toDate = getLocalYMD(new Date(selectedYear, selectedMonth + 1, 0));
    }
  } else {
    if (showPrevious) {
      // Show all data from selected year onward (no upper limit)
      fromDate = getLocalYMD(new Date(selectedYear, 0, 1));
      toDate = "9999-12-31"; // Safe proxy for no upper limit that Supabase understands
    } else {
      // Only selected year
      fromDate = getLocalYMD(new Date(selectedYear, 0, 1));
      toDate = getLocalYMD(new Date(selectedYear, 11, 31));
    }
  }

  // Always define monthLabel after toggles
  let monthLabel: string;
  if (filterByMonth) {
    monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString(language === "my" ? "my-MM" : "en-US", { month: "long", year: "numeric" });
  } else {
    monthLabel = selectedYear.toString();
  }

  // Lamp switch styles
  const lampSwitchBase = "relative w-12 h-6 flex items-center cursor-pointer select-none";
  const lampSwitchKnob = "absolute top-0 w-6 h-6 rounded-full transition-transform duration-200";
  const lampSwitchOn = "bg-green-400";
  const lampSwitchOff = "bg-orange-400";

  // iOS-style switch CSS
  const iosSwitch = (checked: boolean) =>
    `relative w-12 h-7 flex items-center cursor-pointer select-none transition-colors duration-300 ${checked ? 'bg-green-400' : 'bg-gray-300'} rounded-full`;
  const iosKnob = (checked: boolean) =>
    `absolute left-0 top-0 w-7 h-7 bg-white rounded-full shadow transition-transform duration-300 border border-slate-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`;

  const handleToggle = (toggleSetter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setToggleLoading(true);
    toggleSetter((v) => !v);
    setTimeout(() => setToggleLoading(false), 600);
  };

  // Show loading when month/year changes
  useEffect(() => {
    setFetching(true);
  }, [selectedMonth, selectedYear, filterByMonth, showPrevious]);

  useEffect(() => {
    const load = async () => {
      const { user, householdId: hhId } = await ensureHouseholdForCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      if (!hhId) {
        setLoading(false);
        return;
      }

      const [{ data: incomeRows }, { data: usageRows }, { data: userIncomeRows }, { data: userUsageRows }] = await Promise.all([
        supabase
          .from("incomes")
          .select("id, amount, date, title, type")
          .eq("household_id", hhId)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false })
          .limit(5),
        supabase
          .from("usages")
          .select(
            "id, amount, date, need_or_waste, note, created_by, category:usage_categories(name, group_name)"
          )
          .eq("household_id", hhId)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false }),
        supabase
          .from("incomes")
          .select("id, amount, date, title, type")
          .eq("household_id", hhId)
          .eq("created_by", user.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false }),
        supabase
          .from("usages")
          .select(
            "id, amount, date, need_or_waste, note, created_by, category:usage_categories(name, group_name)"
          )
          .eq("household_id", hhId)
          .eq("created_by", user.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: false }),
      ]);

      setIncomes((incomeRows as Income[]) ?? []);
      setUsages((usageRows as unknown as Usage[]) ?? []);
      setUserIncomes((userIncomeRows as Income[]) ?? []);
      setUserUsages((userUsageRows as unknown as Usage[]) ?? []);
      setLoading(false);
      setFetching(false);
    };

    void load();
  }, [router, fromDate, toDate, selectedMonth, selectedYear]);

  const { totalIncome, totalUsage, needTotal, wasteTotal, net, needPct, wastePct } =
    useMemo(() => {
      const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
      const totalUsage = usages.reduce((s, u) => s + Number(u.amount), 0);
      const needTotal = usages
        .filter((u) => u.need_or_waste === "need")
        .reduce((s, u) => s + Number(u.amount), 0);
      const wasteTotal = usages
        .filter((u) => u.need_or_waste === "waste")
        .reduce((s, u) => s + Number(u.amount), 0);
      const net = totalIncome - totalUsage;
      const needPct = totalUsage > 0 ? (needTotal / totalUsage) * 100 : 0;
      const wastePct = totalUsage > 0 ? (wasteTotal / totalUsage) * 100 : 0;
      return { totalIncome, totalUsage, needTotal, wasteTotal, net, needPct, wastePct };
    }, [incomes, usages]);

  const { userTotalIncome, userTotalUsage, userNeedTotal, userWasteTotal, userNet, userNeedPct, userWastePct } =
    useMemo(() => {
      const userTotalIncome = userIncomes.reduce((s, i) => s + Number(i.amount), 0);
      const userTotalUsage = userUsages.reduce((s, u) => s + Number(u.amount), 0);
      const userNeedTotal = userUsages
        .filter((u) => u.need_or_waste === "need")
        .reduce((s, u) => s + Number(u.amount), 0);
      const userWasteTotal = userUsages
        .filter((u) => u.need_or_waste === "waste")
        .reduce((s, u) => s + Number(u.amount), 0);
      const userNet = userTotalIncome - userTotalUsage;
      const userNeedPct = userTotalUsage > 0 ? (userNeedTotal / userTotalUsage) * 100 : 0;
      const userWastePct = userTotalUsage > 0 ? (userWasteTotal / userTotalUsage) * 100 : 0;
      return { userTotalIncome, userTotalUsage, userNeedTotal, userWasteTotal, userNet, userNeedPct, userWastePct };
    }, [userIncomes, userUsages]);

  if (loading) {
    return (
      <div className="flex w-full max-w-5xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">{t("dashboard.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      {/* Loading overlay when fetching month/year data */}
      {fetching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 shadow-xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm font-medium text-slate-900">Loading data...</p>
          </div>
        </div>
      )}

      {/* Month/Year filter */}
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.filterByMonthYear")}</h2>
          <div className="flex gap-3 items-center">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="month" className="text-xs font-medium text-slate-600">{t("dashboard.month")}</label>
              <select
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                disabled={!filterByMonth}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2024, i).toLocaleDateString(language === "my" ? "my-MM" : "en-US", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="year" className="text-xs font-medium text-slate-600">{t("dashboard.year")}</label>
              <select
                id="year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              >
                {Array.from({ length: 21 }, (_, i) => {
                  const year = now.getFullYear() - 10 + i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="text-xs font-medium text-slate-600">{t("dashboard.filterByMonth")}</label>
              <span
                className={iosSwitch(filterByMonth)}
                onClick={() => handleToggle(setFilterByMonth)}
                role="checkbox"
                aria-checked={filterByMonth}
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleToggle(setFilterByMonth); }}
              >
                <span className={iosKnob(filterByMonth)} />
              </span>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="text-xs font-medium text-slate-600">{t("dashboard.showPrevious")}</label>
              <span
                className={iosSwitch(showPrevious)}
                onClick={() => handleToggle(setShowPrevious)}
                role="checkbox"
                aria-checked={showPrevious}
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleToggle(setShowPrevious); }}
              >
                <span className={iosKnob(showPrevious)} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Top summary cards */}
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">
            {t("dashboard.householdSummary")}
          </h1>
          <p className="text-xs text-slate-500">{monthLabel} {t("dashboard.overview")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {/* Income card */}
          <div className="rounded-xl bg-blue-50 p-4 text-blue-900 ring-1 ring-blue-100 dark:bg-blue-900/25 dark:text-blue-200 dark:ring-blue-700/40">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">{t("dashboard.totalIncome")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{totalIncome.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Spent card */}
          <div className="rounded-xl bg-slate-100 p-4 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600/50">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("dashboard.totalSpent")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{totalUsage.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Need card */}
          <div className="rounded-xl bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-200 dark:ring-emerald-700/40">
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t("dashboard.need")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{needTotal.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Waste card */}
          <div className="rounded-xl bg-rose-50 p-4 text-rose-900 ring-1 ring-rose-100 dark:bg-rose-900/25 dark:text-rose-200 dark:ring-rose-700/40">
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400">{t("dashboard.waste")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{wasteTotal.toLocaleString("ja-JP")}
            </div>
          </div>
        </div>
      </section>

      {/* User-specific summary cards */}
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">
            {t("dashboard.yourSummary")}
          </h1>
          <p className="text-xs text-slate-500">{monthLabel} {t("dashboard.personalOverview")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {/* Your Income card */}
          <div className="rounded-xl bg-blue-50 p-4 text-blue-900 ring-1 ring-blue-100 dark:bg-blue-900/25 dark:text-blue-200 dark:ring-blue-700/40">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">{t("dashboard.yourIncome")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{userTotalIncome.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Your Spent card */}
          <div className="rounded-xl bg-slate-100 p-4 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600/50">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t("dashboard.youSpent")}</div>
            <div className="mt-1.5 text-base font-bold">
              ¥{userTotalUsage.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Your Remaining card */}
          <div className={`rounded-xl p-4 ring-1 ${userNet >= 0 ? "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-200 dark:ring-emerald-700/40" : "bg-rose-50 text-rose-900 ring-rose-100 dark:bg-rose-900/25 dark:text-rose-200 dark:ring-rose-700/40"}`}>
            <div className={`text-xs font-medium ${userNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{t("dashboard.yourRemaining")}</div>
            <div className="mt-1.5 text-base font-bold">
              {userNet >= 0 ? "+" : ""}¥{userNet.toLocaleString("ja-JP")}
            </div>
          </div>
          {/* Your Need vs Waste card */}
          <div className="rounded-xl bg-indigo-50 p-4 text-indigo-900 ring-1 ring-indigo-100 dark:bg-indigo-900/25 dark:text-indigo-200 dark:ring-indigo-700/40">
            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{t("dashboard.needVsWaste")}</div>
            <div className="mt-1.5 text-base font-bold">
              {userNeedPct.toFixed(0)}% / {userWastePct.toFixed(0)}%
            </div>
          </div>
        </div>
      </section>

      {/* Balance & Settlement Summary */}
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900">
            {t("dashboard.balanceSettlement")}
          </h1>
          <p className="text-xs text-slate-500">{t("dashboard.financialPosition")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Total Remaining - Household */}
          <div className={`rounded-xl p-5 ring-1 ${net >= 0 ? "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-200 dark:ring-emerald-700/40" : "bg-rose-50 text-rose-900 ring-rose-100 dark:bg-rose-900/25 dark:text-rose-200 dark:ring-rose-700/40"}`}>
            <div className={`text-xs font-medium ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{t("dashboard.totalHouseholdRemaining")}</div>
            <div className="mt-2 text-2xl font-bold">
              {net >= 0 ? "+" : ""}¥{net.toLocaleString("ja-JP")}
            </div>
            <p className="mt-1 text-[11px] opacity-75">Income: ¥{totalIncome.toLocaleString("ja-JP")} | Spent: ¥{totalUsage.toLocaleString("ja-JP")}</p>
          </div>

          {/* Your Credit (positive balance) */}
          <div className={`rounded-xl p-5 ring-1 ${userNet >= 0 ? "bg-blue-50 text-blue-900 ring-blue-100 dark:bg-blue-900/25 dark:text-blue-200 dark:ring-blue-700/40" : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-600/50"}`}>
            <div className={`text-xs font-medium ${userNet >= 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}>
              {userNet >= 0 ? t("dashboard.youAreOwed") : t("dashboard.youNeedToPay")}
            </div>
            <div className="mt-2 text-2xl font-bold">
              ¥{Math.abs(userNet).toLocaleString("ja-JP")}
            </div>
            <p className="mt-1 text-[11px] opacity-75">
              {userNet >= 0 ? t("dashboard.creditBalance") : t("dashboard.debitYouOwe")}
            </p>
          </div>

          {/* Per-person breakdown */}
          <div className="rounded-xl bg-indigo-50 p-5 text-indigo-900 ring-1 ring-indigo-100 dark:bg-indigo-900/25 dark:text-indigo-200 dark:ring-indigo-700/40">
            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{t("dashboard.yourShareStatus")}</div>
            <div className="mt-2 text-2xl font-bold">
              {userTotalIncome > 0 ? `${((userTotalIncome / (totalIncome || 1)) * 100).toFixed(0)}%` : "0%"}
            </div>
            <p className="mt-1 text-[11px] opacity-75">
              {userTotalIncome > 0 ? `${((userTotalIncome / (totalIncome || 1)) * 100).toFixed(0)}% ${t("dashboard.ofHouseholdIncome")}` : t("dashboard.noIncomeRecorded")}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">

        {/* Need vs Waste chart */}
        <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.needVsWaste")}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t("dashboard.needVsWaste.desc")}
          </p>

          {usages.length === 0 ? (
            <p className="mt-6 text-xs text-slate-400">
              {t("dashboard.noUsages")}
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {/* Need bar */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    {t("dashboard.need")}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ¥{needTotal.toLocaleString("ja-JP")}{" "}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                      ({needPct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-700 dark:bg-emerald-500"
                    style={{ width: `${Math.min(100, needPct)}%` }}
                  />
                </div>
              </div>

              {/* Waste bar */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-rose-600 dark:text-rose-400">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
                    {t("dashboard.waste")}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ¥{wasteTotal.toLocaleString("ja-JP")}{" "}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                      ({wastePct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all duration-700 dark:bg-rose-500"
                    style={{ width: `${Math.min(100, wastePct)}%` }}
                  />
                </div>
              </div>

              {/* Net balance */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-700/50 dark:ring-slate-600">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.netBalance")}</span>
                <span className={`text-sm font-bold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                  {net >= 0 ? "+" : ""}¥{net.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Recent incomes */}
        <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentIncomes")}</h2>
            <button
              type="button"
              onClick={() => router.push("/incomes")}
              className="text-xs font-medium text-blue-600 hover:text-blue-500"
            >
              {t("dashboard.viewAll")}
            </button>
          </div>
          {incomes.length === 0 ? (
            <p className="text-xs text-slate-400">{t("dashboard.noIncomes")}</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {incomes.map((income) => (
                <li
                  key={income.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <div className="font-medium text-slate-900">{income.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(income.date).toLocaleDateString("ja-JP")} ·{" "}
                      {income.type}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    ¥{Number(income.amount).toLocaleString("ja-JP")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent usages */}
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.recentUsages")}</h2>
          <button
            type="button"
            onClick={() => router.push("/usages")}
            className="text-xs font-medium text-blue-600 hover:text-blue-500"
          >
            {t("dashboard.viewAll")}
          </button>
        </div>
        {usages.length === 0 ? (
          <p className="text-xs text-slate-400">{t("dashboard.noUsages")}</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">{t("dashboard.category")}</th>
                  <th className="px-2 py-1 text-left">{t("common.type")}</th>
                  <th className="px-2 py-1 text-left">{t("common.date")}</th>
                  <th className="px-2 py-1 text-left">{t("common.note")}</th>
                  <th className="px-2 py-1 text-right">{t("common.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {usages.slice(0, 6).map((u) => (
                  <tr key={u.id} className="bg-slate-50 text-slate-900">
                    <td className="rounded-l-xl px-2 py-2 text-xs">
                      {u.category
                        ? `${u.category.group_name} · ${u.category.name}`
                        : "—"}
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
                    <td className="px-2 py-2 text-[11px] text-slate-500">
                      {new Date(u.date).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-500">
                      {u.note || "—"}
                    </td>
                    <td className="rounded-r-xl px-2 py-2 text-right text-xs font-semibold">
                      ¥{Number(u.amount).toLocaleString("ja-JP")}
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
