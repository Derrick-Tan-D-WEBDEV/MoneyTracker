"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  TrendingUp,
  Flag,
  Settings,
  Trophy,
  BarChart3,
  Repeat,
  Landmark,
  CreditCard,
  CalendarDays,
  RefreshCw,
  Download,
  ShoppingBag,
  Calculator,
  Menu,
  X,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryTabs = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/goals", icon: Flag, label: "Goals" },
];

const moreItems = [
  { href: "/budgets", icon: Target, label: "Budgets" },
  { href: "/investments", icon: TrendingUp, label: "Investments" },
  { href: "/debts", icon: Landmark, label: "Debts" },
  { href: "/installments", icon: CreditCard, label: "Installments" },
  { href: "/calendar", icon: CalendarDays, label: "Bill Calendar" },
  { href: "/recurring", icon: Repeat, label: "Recurring" },
  { href: "/subscriptions", icon: RefreshCw, label: "Subscriptions" },
  { href: "/wishlist", icon: ShoppingBag, label: "Wishlist" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/export", icon: Download, label: "Export" },
  { href: "/tax", icon: Calculator, label: "Tax" },
  { href: "/partner", icon: Heart, label: "Partner" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-16 left-0 right-0 bg-card border-t rounded-t-2xl p-4 pb-2 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">More</h3>
              <button onClick={() => setMoreOpen(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      setMoreOpen(false);
                      router.push(item.href);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-colors",
                      isActive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] leading-tight font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card/95 backdrop-blur-sm" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around h-16">
          {primaryTabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px]",
                  isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                <tab.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px]",
              isMoreActive || moreOpen ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            <Menu className={cn("w-5 h-5", (isMoreActive || moreOpen) && "stroke-[2.5]")} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
