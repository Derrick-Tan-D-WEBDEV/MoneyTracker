"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Search, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LevelBadge } from "@/components/dashboard/level-badge";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

const tabs = [
  { href: "/", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/investments", label: "Investments" },
  { href: "/goals", label: "Goals" },
];

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/transactions": "Transactions",
  "/accounts": "Accounts",
  "/investments": "Investments",
  "/goals": "Goals",
  "/budgets": "Budgets",
  "/debts": "Debts",
  "/installments": "Installments",
  "/calendar": "Bill Calendar",
  "/recurring": "Recurring",
  "/subscriptions": "Subscriptions",
  "/wishlist": "Wishlist",
  "/achievements": "Achievements",
  "/reports": "Reports",
  "/export": "Export",
  "/tax": "Tax Prediction",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.keys(pageTitles).find((k) => k !== "/" && pathname.startsWith(k));
  return match ? pageTitles[match] : "MoneyTracker";
}

export function TopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const pageTitle = getPageTitle(pathname);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="h-14 md:h-16 flex items-center px-4 md:px-6 gap-4 md:gap-6">
        {/* App name - always visible on desktop, shows page title on mobile */}
        <Link href="/" className="text-lg font-bold text-foreground shrink-0">
          <span className="hidden md:inline">MoneyTracker</span>
          <span className="md:hidden">{pageTitle}</span>
        </Link>

        {/* Tab navigation - hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  isActive ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5 md:gap-3">
          <StreakBadge streak={user?.streak ?? 0} />
          <LevelBadge xp={user?.xp ?? 0} level={user?.level ?? 1} compact />
          <Button variant="ghost" size="icon" className="hidden md:inline-flex text-muted-foreground hover:text-foreground">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex text-muted-foreground hover:text-foreground">
            <Bell className="w-4 h-4" />
          </Button>
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.image || ""} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user?.name || "User"}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href="/settings" className="flex items-center gap-2" />}>
                <User className="w-4 h-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" className="flex items-center gap-2" />}>
                <Settings className="w-4 h-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 text-red-600">
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
