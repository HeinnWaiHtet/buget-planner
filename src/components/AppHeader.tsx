"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/* ── Icons ───────────────────────────────────────────────── */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="flex h-5 w-5 flex-col items-center justify-center gap-[5px]">
      <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${open ? "translate-y-[7px] rotate-45" : ""}`} />
      <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${open ? "opacity-0" : ""}`} />
      <span className={`block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
    </div>
  );
}

/* ── Types ───────────────────────────────────────────────── */
type ProfileRow = { is_admin: boolean };
type NavItem = { href: string; label: string; emoji: string };

/* ── Component ───────────────────────────────────────────── */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  /* Read current theme + sidebar state on mount */
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const savedCollapsed = localStorage.getItem("sidebar") === "collapsed";
    setCollapsed(savedCollapsed);
    if (savedCollapsed) document.body.classList.add("sidebar-collapsed");
  }, []);

  /* Close mobile drawer on route change */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* Theme toggle */
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  /* Sidebar collapse toggle (desktop only) */
  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.body.classList.toggle("sidebar-collapsed", next);
    localStorage.setItem("sidebar", next ? "collapsed" : "expanded");
  };

  /* Load user */
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUserEmail(null); setIsAdmin(false); return; }
      setUserEmail(user.email ?? null);
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (data) setIsAdmin((data as ProfileRow).is_admin);
    };
    void loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle()
          .then(({ data }) => { if (data) setIsAdmin((data as ProfileRow).is_admin); });
      } else { setUserEmail(null); setIsAdmin(false); }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  /* Sign out */
  const handleSignOut = async () => {
    const result = await Swal.fire({
      title: t("nav.signOutConfirm.title"),
      text: t("nav.signOutConfirm.text"),
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#d1d5db",
      confirmButtonText: t("nav.signOutConfirm.yes"),
      cancelButtonText: t("common.cancel"),
      didOpen: (m) => m.parentElement?.classList.add("scale-in"),
    });
    if (!result.isConfirmed) return;
    await supabase.auth.signOut();
    setUserEmail(null); setIsAdmin(false); setMobileOpen(false);
    router.push("/login");
  };

  const loggedIn = Boolean(userEmail);
  const navItems: NavItem[] = loggedIn ? [
    { href: "/dashboard", label: t("nav.dashboard"), emoji: "📊" },
    { href: "/incomes", label: t("nav.incomes"), emoji: "💰" },
    { href: "/usages", label: t("nav.usages"), emoji: "🛒" },
    { href: "/reports", label: t("nav.reports"), emoji: "📈" },
    { href: "/settings", label: t("nav.settings"), emoji: "⚙️" },
    { href: "/payment-methods", label: t("nav.paymentMethods"), emoji: "💳" },
    ...(isAdmin ? [{ href: "/categories", label: t("nav.categories"), emoji: "🏷️" }] : []),
  ] : [];

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  /* ── Sidebar content (shared between desktop & mobile) ── */
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">

      {/* Logo + collapse button (desktop only) */}
      <div className="flex items-center justify-between px-3 py-4">
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            router.push(loggedIn ? "/dashboard" : "/");
          }}
          className="flex min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 shadow" />
          {(!collapsed || isMobile) && (
            <span className="truncate text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
              {t("app.title")}
            </span>
          )}
        </button>
        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            type="button"
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        )}
      </div>

      <div className="mx-3 h-px bg-slate-200 dark:bg-slate-700" />

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {loggedIn ? (
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => { setMobileOpen(false); router.push(item.href); }}
                  title={collapsed && !isMobile ? item.label : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${collapsed && !isMobile ? "justify-center px-0" : ""
                    } ${isActive(item.href)
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
                    }`}
                >
                  <span className="text-base leading-none">{item.emoji}</span>
                  {(!collapsed || isMobile) && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-0.5">
            <li>
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60">
                <span>🔑</span>
                {(!collapsed || isMobile) && <span className="font-medium">{t("nav.login")}</span>}
              </Link>
            </li>
            <li>
              <Link href="/register" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-blue-600 px-3 py-2.5 text-sm text-white hover:bg-blue-500">
                <span>✨</span>
                {(!collapsed || isMobile) && <span className="font-medium">{t("nav.getStarted")}</span>}
              </Link>
            </li>
          </ul>
        )}
      </nav>

      {/* Bottom: theme + sign out */}
      <div className="px-2 pb-4">
        <div className="mb-3 h-px bg-slate-200 dark:bg-slate-700" />

        {/* Language toggle */}
        <button
          type="button"
          onClick={() => setLanguage(language === "en" ? "my" : "en")}
          title={language === "en" ? "မြန်မာစာသို့ ပြောင်းရန်" : "Switch to English"}
          className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60 ${collapsed && !isMobile ? "justify-center px-0" : ""
            }`}
        >
          <span className="flex w-4 items-center justify-center font-bold text-xs opacity-80">
            {language === "en" ? "မြ" : "EN"}
          </span>
          {(!collapsed || isMobile) && (
            <span className="font-medium">{language === "en" ? "မြန်မာဘာသာ" : "English"}</span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60 ${collapsed && !isMobile ? "justify-center px-0" : ""
            }`}
        >
          <span className="flex w-4 items-center justify-center">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </span>
          {(!collapsed || isMobile) && (
            <span className="font-medium">{isDark ? t("nav.lightMode") : t("nav.darkMode")}</span>
          )}
        </button>

        {/* User + sign out */}
        {loggedIn && (
          <>
            {(!collapsed || isMobile) && userEmail && (
              <div className="mt-1 truncate px-3 py-1 text-xs text-slate-400 dark:text-slate-500">
                {userEmail}
              </div>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              title={t("nav.signOut")}
              className={`mt-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20 ${collapsed && !isMobile ? "justify-center px-0" : ""
                }`}
            >
              <span className="flex w-4 items-center justify-center"><LogOutIcon /></span>
              {(!collapsed || isMobile) && <span className="font-medium">{t("nav.signOut")}</span>}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop: fixed left sidebar ──────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-700 dark:bg-slate-800 md:flex ${collapsed ? "w-16" : "w-56"
          }`}
      >
        <SidebarContent isMobile={false} />
      </aside>

      {/* ── Mobile: sticky top bar ────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("app.title")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            aria-label="Toggle theme">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button type="button" onClick={() => setMobileOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            aria-label="Toggle menu">
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {/* ── Mobile: slide-in drawer ───────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div key="drawer"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 md:hidden"
            >
              <SidebarContent isMobile={true} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
