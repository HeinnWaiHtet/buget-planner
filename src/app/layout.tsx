import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Usage Balance",
  description: "Household income & usage tracker with Need/Waste analysis",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme by reading localStorage before first render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100`}
      >
        <LanguageProvider>
          {/* Sidebar nav (renders fixed on desktop, drawer on mobile) */}
          <AppHeader />

          {/* Main content — offset by sidebar width on desktop */}
          <div className="sidebar-main-offset md:pl-56">
            <main className="flex min-h-screen flex-col items-center px-4 py-8 sm:px-6 sm:py-10">
              <div className="flex w-full max-w-5xl items-start justify-center">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
            <footer className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 text-xs text-slate-500 dark:text-slate-400 sm:px-6">
                <span>© {new Date().getFullYear()} Usage Balance</span>
                <span className="hidden sm:inline">Track income, usage, and your real needs.</span>
              </div>
            </footer>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
