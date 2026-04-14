"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Heart,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/recurring", icon: Repeat, label: "Recurring" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/budgets", icon: Target, label: "Budgets" },
  { href: "/investments", icon: TrendingUp, label: "Investments" },
  { href: "/goals", icon: Flag, label: "Goals" },
  { href: "/debts", icon: Landmark, label: "Debts" },
  { href: "/installments", icon: CreditCard, label: "Installments" },
  { href: "/calendar", icon: CalendarDays, label: "Bill Calendar" },
  { href: "/subscriptions", icon: RefreshCw, label: "Subscriptions" },
  { href: "/wishlist", icon: ShoppingBag, label: "Wishlist" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/export", icon: Download, label: "Export" },
  { href: "/tax", icon: Calculator, label: "Tax Prediction" },
  { href: "/partner", icon: Heart, label: "Partner" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <TooltipProvider delay={0}>
      <aside className="fixed left-0 top-0 z-40 h-screen w-16 hidden md:flex flex-col items-center border-r bg-card py-4 gap-1">
        {/* Logo */}
        <Link href="/" className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-6">
          <Wallet className="w-5 h-5 text-white" />
        </Link>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        isActive ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    />
                  }
                >
                  <item.icon className="w-5 h-5" />
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/settings"
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  pathname.startsWith("/settings") ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              />
            }
          >
            <Settings className="w-5 h-5" />
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Settings
          </TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
