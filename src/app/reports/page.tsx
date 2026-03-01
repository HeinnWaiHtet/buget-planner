"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureHouseholdForCurrentUser } from "@/lib/household";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NotoSansMyanmarBase64 } from "@/lib/fonts/NotoSansMyanmar-Regular-base64";

type Income = { amount: number; date: string };
type Usage = {
  amount: number;
  date: string;
  need_or_waste: "need" | "waste";
  category: { name: string; group_name: string } | null;
};

export default function ReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [fromDate, setFromDate] = useState(startOfMonth);
  const [toDate, setToDate] = useState(endOfMonth);

  const [incomes, setIncomes] = useState<Income[]>([]);
  const [usages, setUsages] = useState<Usage[]>([]);

  useEffect(() => {
    const loadBase = async () => {
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
    };

    void loadBase();
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      if (!householdId) return;
      setLoading(true);

      const [{ data: incomeRows }, { data: usageRows }] = await Promise.all([
        supabase
          .from("incomes")
          .select("amount, date")
          .eq("household_id", householdId)
          .gte("date", fromDate)
          .lte("date", toDate),
        supabase
          .from("usages")
          .select(
            "amount, date, need_or_waste, category:usage_categories(name, group_name)",
          )
          .eq("household_id", householdId)
          .gte("date", fromDate)
          .lte("date", toDate),
      ]);

      setIncomes((incomeRows as Income[]) ?? []);
      setUsages((usageRows as unknown as Usage[]) ?? []);
      setLoading(false);
    };

    void loadData();
  }, [householdId, fromDate, toDate]);

  const {
    totalIncome,
    totalUsage,
    net,
    needTotal,
    wasteTotal,
    categoryBreakdown,
  } = useMemo(() => {
    const totalIncome = incomes.reduce(
      (sum, i) => sum + Number(i.amount),
      0,
    );
    const totalUsage = usages.reduce((sum, u) => sum + Number(u.amount), 0);
    const net = totalIncome - totalUsage;
    const needTotal = usages
      .filter((u) => u.need_or_waste === "need")
      .reduce((sum, u) => sum + Number(u.amount), 0);
    const wasteTotal = usages
      .filter((u) => u.need_or_waste === "waste")
      .reduce((sum, u) => sum + Number(u.amount), 0);

    const categoryMap = new Map<string, number>();
    for (const u of usages) {
      const key = u.category
        ? `${u.category.group_name} · ${u.category.name}`
        : "Uncategorized";
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + Number(u.amount));
    }

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { totalIncome, totalUsage, net, needTotal, wasteTotal, categoryBreakdown };
  }, [incomes, usages]);

  const exportToPDF = () => {
    console.log("Exporting PDF...", { totalIncome, totalUsage, net, needTotal, wasteTotal, categoryBreakdown });
    const doc = new jsPDF();

    const fontName = "NotoSansMyanmar-Regular";

    // Add custom Burmese font with consistent naming
    doc.addFileToVFS(`${fontName}.ttf`, NotoSansMyanmarBase64);
    doc.addFont(`${fontName}.ttf`, fontName, "normal");
    doc.setFont(fontName);

    const pageWidth = doc.internal.pageSize.getWidth();

    // Add Title
    doc.setFontSize(18);
    doc.text(t("reports.title") || "Household Reports", 14, 20);

    // Add Date Range
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${t("reports.from") || "From"}: ${fromDate}   ${t("reports.to") || "To"}: ${toDate}`, 14, 28);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(t("dashboard.overview") || "Summary", 14, 40);

    autoTable(doc, {
      startY: 45,
      head: [[t("dashboard.totalIncome") || "Total Income", t("dashboard.totalSpent") || "Total Spent", t("dashboard.netBalance") || "Net Balance"]],
      body: [
        [
          `¥${totalIncome.toLocaleString("ja-JP")}`,
          `¥${totalUsage.toLocaleString("ja-JP")}`,
          `¥${net.toLocaleString("ja-JP")}`
        ]
      ],
      headStyles: { fillColor: [59, 130, 246], font: fontName },
      bodyStyles: { font: fontName }
    });
    console.log("First table added.");

    // Need vs Waste
    doc.setFontSize(14);
    doc.text(t("dashboard.needVsWaste") || "Need vs Waste", 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [[t("common.type") || "Type", t("common.amount") || "Amount", t("reports.ratio") || "Ratio"]],
      body: [
        [t("dashboard.need") || "Need", `¥${needTotal.toLocaleString("ja-JP")}`, totalUsage === 0 ? "0%" : `${((needTotal / totalUsage) * 100).toFixed(1)}%`],
        [t("dashboard.waste") || "Waste", `¥${wasteTotal.toLocaleString("ja-JP")}`, totalUsage === 0 ? "0%" : `${((wasteTotal / totalUsage) * 100).toFixed(1)}%`]
      ],
      theme: "grid",
      styles: { font: fontName },
      headStyles: { fillColor: [16, 185, 129], font: fontName },
      bodyStyles: { font: fontName }
    });

    // Top Categories
    doc.setFontSize(14);
    doc.text(t("reports.topCategories") || "Top Categories", 14, (doc as any).lastAutoTable.finalY + 15);

    const categoryBody = categoryBreakdown.length > 0
      ? categoryBreakdown.map(c => [c.label, `¥${c.value.toLocaleString("ja-JP")}`])
      : [[t("reports.empty") || "No usages found", "—"]];

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [[t("dashboard.category") || "Category", t("common.amount") || "Amount"]],
      body: categoryBody,
      theme: "striped",
      styles: { font: fontName },
      headStyles: { fillColor: [71, 85, 105], font: fontName },
      bodyStyles: { font: fontName }
    });

    // Save PDF
    doc.save(`household_report_${fromDate}_to_${toDate}.pdf`);
  };

  if (!householdId) {
    return (
      <div className="flex w-full max-w-3xl items-center justify-center rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5">
      <section className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              {t("reports.title")}
            </h1>
            <p className="text-xs text-slate-500">
              {t("reports.desc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1 text-slate-600">
              <span>{t("reports.from")}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-1 outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              />
            </label>
            <label className="flex items-center gap-1 text-slate-600">
              <span>{t("reports.to")}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-1 outline-none ring-blue-100 focus:border-blue-500 focus:ring"
              />
            </label>
            <button
              onClick={exportToPDF}
              className="ml-2 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
              </svg>
              {t("reports.exportPdf")}
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-900">
            <div className="text-[11px]">{t("dashboard.totalIncome")}</div>
            <div className="mt-1 text-sm font-semibold">
              ¥{totalIncome.toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 text-rose-900">
            <div className="text-[11px]">{t("dashboard.totalSpent")}</div>
            <div className="mt-1 text-sm font-semibold">
              ¥{totalUsage.toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900 p-3 text-slate-50">
            <div className="text-[11px]">{t("dashboard.netBalance")}</div>
            <div className="mt-1 text-sm font-semibold">
              ¥{net.toLocaleString("ja-JP")}
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("dashboard.needVsWaste")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("dashboard.needVsWaste.desc")}
          </p>
          {loading ? (
            <p className="mt-4 text-xs text-slate-500">{t("common.loading")}</p>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t("dashboard.need")}</span>
                <span className="font-semibold text-emerald-700">
                  ¥{needTotal.toLocaleString("ja-JP")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{
                    width:
                      totalUsage === 0
                        ? "0%"
                        : `${Math.min(100, (needTotal / totalUsage) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t("dashboard.waste")}</span>
                <span className="font-semibold text-rose-700">
                  ¥{wasteTotal.toLocaleString("ja-JP")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-400"
                  style={{
                    width:
                      totalUsage === 0
                        ? "0%"
                        : `${Math.min(100, (wasteTotal / totalUsage) * 100)}%`,
                  }}
                />
              </div>
              <div className="pt-1 text-[11px] text-slate-500">
                {t("reports.wasteRatio")}{" "}
                {totalUsage === 0
                  ? "—"
                  : `${((wasteTotal / totalUsage) * 100).toFixed(1)}%`}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("reports.topCategories")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("reports.topCategoriesDesc")}
          </p>
          {loading ? (
            <p className="mt-4 text-xs text-slate-500">{t("common.loading")}</p>
          ) : categoryBreakdown.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              {t("reports.empty")}
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-xs">
              {categoryBreakdown.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span className="text-slate-700">{c.label}</span>
                  <span className="font-semibold text-slate-900">
                    ¥{c.value.toLocaleString("ja-JP")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

