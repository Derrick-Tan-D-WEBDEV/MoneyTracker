"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Heart,
  Package,
  ChevronRight,
  PiggyBank,
  FileText,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const topItems: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
];

const navGroups: NavGroup[] = [
  {
    label: "Planning",
    icon: PiggyBank,
    items: [
      { href: "/budgets", icon: Target, label: "Budgets" },
      { href: "/goals", icon: Flag, label: "Goals" },
      { href: "/recurring", icon: Repeat, label: "Recurring" },
      { href: "/calendar", icon: CalendarDays, label: "Bill Calendar" },
      { href: "/subscriptions", icon: RefreshCw, label: "Subscriptions" },
    ],
  },
  {
    label: "Wealth",
    icon: TrendingUp,
    items: [
      { href: "/investments", icon: TrendingUp, label: "Investments" },
      { href: "/assets", icon: Package, label: "Assets" },
      { href: "/debts", icon: Landmark, label: "Debts" },
      { href: "/installments", icon: CreditCard, label: "Installments" },
    ],
  },
  {
    label: "Insights",
    icon: FileText,
    items: [
      { href: "/reports", icon: BarChart3, label: "Reports" },
      { href: "/tax", icon: Calculator, label: "Tax Prediction" },
      { href: "/export", icon: Download, label: "Export" },
    ],
  },
  {
    label: "Lifestyle",
    icon: Sparkles,
    items: [
      { href: "/wishlist", icon: ShoppingBag, label: "Wishlist" },
      { href: "/achievements", icon: Trophy, label: "Achievements" },
      { href: "/partner", icon: Heart, label: "Partner" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Auto-open the group that contains the active page
    const active = new Set<string>();
    for (const group of navGroups) {
      if (group.items.some((item) => pathname.startsWith(item.href))) {
        active.add(group.label);
      }
    }
    return active;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const renderItem = (item: NavItem, indent = false) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

    if (collapsed) {
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
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 h-9 transition-colors text-sm",
          indent && "ml-3",
          isActive ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const isOpen = openGroups.has(group.label);
    const hasActive = group.items.some((item) => pathname.startsWith(item.href));

    if (collapsed) {
      // In collapsed mode, show the group icon as a popover-style submenu
      return (
        <Tooltip key={group.label}>
          <TooltipTrigger
            render={
              <button
                onClick={() => {
                  setCollapsed(false);
                  setOpenGroups((prev) => new Set(prev).add(group.label));
                }}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  hasActive ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              />
            }
          >
            <group.icon className="w-5 h-5" />
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {group.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div key={group.label}>
        <button
          onClick={() => toggleGroup(group.label)}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-3 h-9 transition-colors text-sm",
            hasActive ? "text-emerald-500 dark:text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <group.icon className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 text-left">{group.label}</span>
          <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
        </button>
        {isOpen && <div className="flex flex-col gap-0.5 mt-0.5">{group.items.map((item) => renderItem(item, true))}</div>}
      </div>
    );
  };

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen hidden md:flex flex-col border-r bg-card py-4 transition-all duration-200",
          collapsed ? "w-16 items-center" : "w-52",
        )}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
      >
        {/* Logo */}
        <div className={cn("flex items-center mb-4", collapsed ? "justify-center" : "px-3 gap-3")}>
          <Link href="/" className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </Link>
          {!collapsed && <span className="font-bold text-sm truncate">MoneyTracker</span>}
        </div>

        {/* Nav */}
        <nav className={cn("flex flex-col gap-0.5 flex-1 overflow-y-auto scrollbar-thin", collapsed ? "items-center" : "px-2")}>
          {topItems.map((item) => renderItem(item))}

          {!collapsed && <div className="h-px bg-border my-2" />}
          {collapsed && <div className="w-6 h-px bg-border my-2" />}

          {navGroups.map((group) => renderGroup(group))}
        </nav>

        {/* Settings at bottom */}
        {collapsed ? (
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
        ) : (
          <div className="px-2 mt-1">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 h-9 transition-colors text-sm",
                pathname.startsWith("/settings") ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">Settings</span>
            </Link>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
