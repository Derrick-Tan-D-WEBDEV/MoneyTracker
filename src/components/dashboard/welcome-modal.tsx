"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface WelcomeModalProps {
  userName: string | null;
}

export function WelcomeModal({ userName }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  const steps = [
    {
      icon: "👋",
      title: `Welcome${userName ? `, ${userName}` : ""}!`,
      description: "MoneyTracker helps you take control of your finances with smart tracking, budgeting, and goals.",
      cta: "Let's get started",
    },
    {
      icon: "🏦",
      title: "Add Your Accounts",
      description: "Start by adding your bank accounts, credit cards, or cash to track your balances.",
      cta: "Next",
      link: "/accounts",
    },
    {
      icon: "🎮",
      title: "Earn Achievements!",
      description: "Track transactions, hit goals, and maintain streaks to level up and earn badges. Have fun while mastering your money!",
      cta: "Start Tracking",
    },
  ];

  const currentStep = steps[step];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-card rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="text-6xl mb-6">
            {currentStep.icon}
          </motion.div>

          <h2 className="text-2xl font-bold text-foreground mb-3">{currentStep.title}</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">{currentStep.description}</p>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? "w-6 bg-emerald-500" : "bg-muted"}`} />
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            {step < steps.length - 1 ? (
              <>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Skip
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => setStep(step + 1)}>
                  {currentStep.cta}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 gap-2 px-8" onClick={() => setIsOpen(false)}>
                <Sparkles className="w-4 h-4" />
                {currentStep.cta}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
