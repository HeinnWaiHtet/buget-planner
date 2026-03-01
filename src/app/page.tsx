"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <section className="grid w-full gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center gap-4">
        <p className="inline-flex max-w-max items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          {t("landing.tag1")}
        </p>
        <h1 className="text-balance text-3xl font-semibold text-slate-900 sm:text-4xl">
          {t("landing.h1")}
        </h1>
        <p className="max-w-xl text-sm text-slate-600 sm:text-base">
          {t("landing.p1")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/register"
            className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
          >
            {t("landing.startFree")}
          </a>
          <a
            href="/login"
            className="inline-flex items-center text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            {t("landing.haveAccount")}
          </a>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
            <span>{t("landing.demo.title")}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
              {t("landing.demo.badge")}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-900">
              <div className="text-[11px]">{t("landing.demo.income")}</div>
              <div className="mt-1 text-sm font-semibold">¥420,000</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
              <div className="text-[11px]">{t("landing.demo.need")}</div>
              <div className="mt-1 text-sm font-semibold">¥260,000</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-900">
              <div className="text-[11px]">{t("landing.demo.waste")}</div>
              <div className="mt-1 text-sm font-semibold">¥38,000</div>
            </div>
          </div>
          <div className="mb-2 text-xs font-medium text-slate-600">
            {t("landing.demo.trend")}
          </div>
          <div className="h-24 rounded-xl bg-slate-50 p-3">
            <div className="flex h-full items-end gap-1">
              <div className="flex-1 space-y-1">
                <div className="h-7 rounded-full bg-emerald-300/80" />
                <div className="h-2 rounded-full bg-rose-300/80" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-8 rounded-full bg-emerald-300/80" />
                <div className="h-3 rounded-full bg-rose-300/80" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-10 rounded-full bg-emerald-300/80" />
                <div className="h-4 rounded-full bg-rose-300/80" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-9 rounded-full bg-emerald-300/80" />
                <div className="h-3 rounded-full bg-rose-300/80" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{t("landing.demo.track")}</span>
            <span className="font-medium text-emerald-600">{t("landing.demo.spare")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
