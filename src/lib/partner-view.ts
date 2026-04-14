"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PARTNER_VIEW_COOKIE = "partner-view-id";

/** Get the effective userId for read operations. Returns partner's ID if in partner view mode. */
export async function getViewUserId(): Promise<string> {
  const { id } = await getViewUser();
  return id;
}

/** Get the effective userId AND currency for read operations. */
export async function getViewUser(): Promise<{ id: string; currency: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cookieStore = await cookies();
  const partnerViewId = cookieStore.get(PARTNER_VIEW_COOKIE)?.value;

  if (!partnerViewId || partnerViewId === session.user.id) {
    return { id: session.user.id, currency: session.user.currency || "MYR" };
  }

  // Verify the couple link is active
  const link = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId: session.user.id, partnerId: partnerViewId, status: "ACCEPTED" },
        { userId: partnerViewId, partnerId: session.user.id, status: "ACCEPTED" },
      ],
    },
  });

  if (!link) {
    cookieStore.delete(PARTNER_VIEW_COOKIE);
    return { id: session.user.id, currency: session.user.currency || "MYR" };
  }

  const partner = await db.user.findUnique({
    where: { id: partnerViewId },
    select: { currency: true },
  });

  return { id: partnerViewId, currency: partner?.currency || "MYR" };
}

/** Check if currently viewing partner's data (for blocking mutations) */
export async function isPartnerView(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const cookieStore = await cookies();
  const partnerViewId = cookieStore.get(PARTNER_VIEW_COOKIE)?.value;

  return !!partnerViewId && partnerViewId !== session.user.id;
}

/** Switch to viewing partner's data */
export async function setPartnerView(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const link = await db.coupleLink.findFirst({
    where: {
      OR: [
        { userId: session.user.id, partnerId, status: "ACCEPTED" },
        { userId: partnerId, partnerId: session.user.id, status: "ACCEPTED" },
      ],
    },
  });

  if (!link) throw new Error("No active couple link with this user");

  const cookieStore = await cookies();
  cookieStore.set(PARTNER_VIEW_COOKIE, partnerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

/** Switch back to viewing own data */
export async function clearPartnerView() {
  const cookieStore = await cookies();
  cookieStore.delete(PARTNER_VIEW_COOKIE);
}

/** Get partner view state for client components */
export async function getPartnerViewState() {
  const session = await auth();
  if (!session?.user?.id) return { isPartnerView: false, partnerName: null, partnerId: null };

  const cookieStore = await cookies();
  const partnerViewId = cookieStore.get(PARTNER_VIEW_COOKIE)?.value;

  if (!partnerViewId || partnerViewId === session.user.id) {
    return { isPartnerView: false, partnerName: null, partnerId: null };
  }

  const partner = await db.user.findUnique({
    where: { id: partnerViewId },
    select: { name: true, email: true, image: true, currency: true },
  });

  if (!partner) {
    cookieStore.delete(PARTNER_VIEW_COOKIE);
    return { isPartnerView: false, partnerName: null, partnerId: null };
  }

  return {
    isPartnerView: true,
    partnerName: partner.name || partner.email || "Partner",
    partnerImage: partner.image,
    partnerCurrency: partner.currency,
    partnerId: partnerViewId,
  };
}
