"use client";

import { useState, useCallback } from "react";
import { Plus, X, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransaction } from "@/actions/transactions";
import { checkAchievements, updateStreak } from "@/actions/gamification";
import { toast } from "sonner";

interface QuickAddFabProps {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string; icon: string; color: string }[];
  onAchievement?: (key: string) => void;
}

export function QuickAddFab({ accounts, categories, onAchievement }: QuickAddFabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = useCallback(async () => {
    if (!amount || !description || !accountId) {
      toast.error("Fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await createTransaction({
        type,
        amount: parseFloat(amount),
        description,
        accountId,
        categoryId: categoryId || null,
        date: new Date().toISOString(),
        notes: null,
      });
      await updateStreak();
      const txAmount = parseFloat(amount);
      const achievements = await checkAchievements("transaction", { type, amount: txAmount });
      if (achievements.length > 0 && onAchievement) {
        onAchievement(achievements[0]);
      }
      toast.success("Transaction added!");
      setAmount("");
      setDescription("");
      setCategoryId("");
      setIsOpen(false);
    } catch {
      toast.error("Failed to add transaction");
    } finally {
      setIsSubmitting(false);
    }
  }, [type, amount, description, accountId, categoryId, onAchievement]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />}
      </AnimatePresence>

      {/* Quick Add Form */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-40 right-6 md:bottom-24 md:right-8 z-50 w-80 max-w-[calc(100vw-3rem)] bg-card rounded-2xl shadow-2xl border p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Quick Add</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === "EXPENSE" ? "bg-red-100 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-800" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setType("EXPENSE")}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                Expense
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === "INCOME"
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => setType("INCOME")}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Income
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input placeholder="e.g. Lunch, Salary..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Account</Label>
                <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.name || "Select account"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={categoryId} onValueChange={(v) => v && setCategoryId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => filteredCategories.find((c) => c.id === value)?.name || "Select category"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => {
                      const CIcon = getCategoryIcon(c.icon);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <CIcon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-50 w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white hover:shadow-xl transition-shadow"
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus className="w-6 h-6" />
        </motion.div>
      </motion.button>
    </>
  );
}
