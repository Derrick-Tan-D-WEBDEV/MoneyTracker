"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { globalSearch, type SearchResult } from "@/actions/search";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  Flag,
  TrendingUp,
  Landmark,
  CreditCard,
  Repeat,
  CalendarClock,
  Calendar,
  Package,
  Gift,
  BarChart3,
  Calculator,
  Download,
  Trophy,
  Settings,
  Heart,
  Tag,
  Search,
  FileText,
  PiggyBank,
  Sparkles,
  Shield,
  type LucideIcon,
} from "lucide-react";

const pageIcons: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "arrow-left-right": ArrowLeftRight,
  wallet: Wallet,
  target: Target,
  flag: Flag,
  "trending-up": TrendingUp,
  landmark: Landmark,
  "credit-card": CreditCard,
  repeat: Repeat,
  "calendar-clock": CalendarClock,
  calendar: Calendar,
  package: Package,
  gift: Gift,
  "bar-chart-3": BarChart3,
  calculator: Calculator,
  download: Download,
  trophy: Trophy,
  settings: Settings,
  heart: Heart,
};

const typeLabels: Record<string, string> = {
  page: "Pages",
  transaction: "Transactions",
  account: "Accounts",
  category: "Categories",
  goal: "Goals",
  investment: "Investments",
  debt: "Debts",
  subscription: "Subscriptions",
  asset: "Assets",
  wishlist: "Wishlist",
};

function getIcon(result: SearchResult) {
  if (result.type === "transaction") return FileText;
  if (result.icon && pageIcons[result.icon]) return pageIcons[result.icon];
  return Sparkles;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  };

  const grouped = results.reduce(
    (acc, r) => {
      const group = typeLabels[r.type] || r.type;
      if (!acc[group]) acc[group] = [];
      acc[group].push(r);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  const groupOrder = [
    "Pages",
    "Transactions",
    "Accounts",
    "Categories",
    "Goals",
    "Investments",
    "Debts",
    "Subscriptions",
    "Assets",
    "Wishlist",
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-8 rounded-full border bg-background px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-xs">Search...</span>
        <kbd className="ml-1 hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <Search className="w-4 h-4" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search transactions, accounts, goals..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length > 0 && query.length < 2 && (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          )}
          {query.length >= 2 && !loading && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {loading && query.length >= 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
          )}
          {groupOrder.map((groupName) => {
            const items = grouped[groupName];
            if (!items || items.length === 0) return null;
            return (
              <CommandGroup key={groupName} heading={groupName}>
                {items.map((result) => {
                  const Icon = getIcon(result);
                  return (
                    <CommandItem
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                    >
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
                        style={{
                          backgroundColor: (result.color || "#6B7280") + "20",
                          color: result.color || "#6B7280",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
