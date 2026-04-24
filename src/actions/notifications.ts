"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import webpush from "web-push";
import { getEncryptionKey, decryptAmount } from "@/lib/encryption";
import { getExchangeRates, convertCurrency } from "@/lib/exchange-rates";
import { compareStrategies } from "@/lib/debt-strategies";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@moneytracker.app";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export async function savePushSubscription(subscription: PushSubscriptionJSON) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  await db.pushSubscription.deleteMany({ where: { userId } });

  await db.pushSubscription.create({
    data: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh ?? "",
      auth: subscription.keys?.auth ?? "",
    },
  });

  return { success: true };
}

export async function removePushSubscription() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.pushSubscription.deleteMany({
    where: { userId: session.user.id },
  });

  return { success: true };
}

export async function getPushSubscriptionStatus(): Promise<{ enabled: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { enabled: false };

  const sub = await db.pushSubscription.findFirst({
    where: { userId: session.user.id },
  });

  return { enabled: !!sub };
}

export async function sendDebtReminder(): Promise<{ sent: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { sent: false };
  const userId = session.user.id;

  const sub = await db.pushSubscription.findFirst({
    where: { userId },
  });
  if (!sub) return { sent: false };

  // Get active debts
  const debts = await db.debt.findMany({
    where: { userId, isPaidOff: false },
  });
  if (debts.length === 0) return { sent: false };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const userCurrency = user?.currency || "MYR";
  const encKey = await getEncryptionKey();
  const rates = await getExchangeRates(userCurrency);

  const debtInputs = debts.map((d) => ({
    id: d.id,
    name: d.name, // encrypted name - we'll use a placeholder for the message
    type: d.type,
    remainingAmount: convertCurrency(decryptAmount(d.remainingAmount, encKey), d.currency, userCurrency, rates),
    interestRate: decryptAmount(d.interestRate, encKey),
    minimumPayment: convertCurrency(decryptAmount(d.minimumPayment, encKey), d.currency, userCurrency, rates),
    currency: userCurrency,
    color: d.color,
  }));

  // Find best extra payment recommendation
  const baseline = compareStrategies(debtInputs, 0);
  let bestExtra = 0;
  let bestMonthsSaved = 0;
  let bestInterestSaved = 0;

  for (const extra of [50, 100, 150, 200, 300, 500]) {
    const sim = compareStrategies(debtInputs, extra);
    const monthsSaved = baseline.avalanche.months - sim.avalanche.months;
    const interestSaved = baseline.avalanche.totalInterest - sim.avalanche.totalInterest;
    if (monthsSaved >= 1 && interestSaved > bestInterestSaved) {
      bestExtra = extra;
      bestMonthsSaved = monthsSaved;
      bestInterestSaved = interestSaved;
    }
  }

  let message: string;
  if (bestExtra > 0 && bestMonthsSaved > 0) {
    message = `Pay an extra ${bestExtra} ${userCurrency}/mo to be debt-free ${bestMonthsSaved} month${bestMonthsSaved !== 1 ? "s" : ""} sooner and save ${bestInterestSaved.toFixed(0)} ${userCurrency} in interest!`;
  } else {
    message = `You have ${debts.length} active debt${debts.length !== 1 ? "s" : ""}. Keep up the momentum — every payment counts!`;
  }

  const payload = JSON.stringify({
    title: "MoneyTracker Debt Reminder",
    body: message,
    tag: "debt-reminder",
    url: "/debts",
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      payload,
    );
    return { sent: true, message };
  } catch {
    // Subscription may be expired — clean it up
    await db.pushSubscription.delete({ where: { id: sub.id } });
    return { sent: false };
  }
}
