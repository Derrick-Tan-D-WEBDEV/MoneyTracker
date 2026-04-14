"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { setPartnerView, clearPartnerView, getPartnerViewState } from "@/lib/partner-view";
import { useRouter } from "next/navigation";

type PartnerViewContextType = {
  isPartnerView: boolean;
  partnerName: string | null;
  partnerImage: string | null;
  partnerCurrency: string | null;
  partnerId: string | null;
  switchToPartner: (partnerId: string) => Promise<void>;
  switchToSelf: () => Promise<void>;
};

const PartnerViewContext = createContext<PartnerViewContextType>({
  isPartnerView: false,
  partnerName: null,
  partnerImage: null,
  partnerCurrency: null,
  partnerId: null,
  switchToPartner: async () => {},
  switchToSelf: async () => {},
});

export function PartnerViewProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: {
    isPartnerView: boolean;
    partnerName?: string | null;
    partnerImage?: string | null;
    partnerCurrency?: string | null;
    partnerId?: string | null;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState({
    isPartnerView: initialState?.isPartnerView ?? false,
    partnerName: initialState?.partnerName ?? null,
    partnerImage: initialState?.partnerImage ?? null,
    partnerCurrency: initialState?.partnerCurrency ?? null,
    partnerId: initialState?.partnerId ?? null,
  });

  const switchToPartner = useCallback(
    async (partnerId: string) => {
      await setPartnerView(partnerId);
      const newState = await getPartnerViewState();
      setState({
        isPartnerView: newState.isPartnerView,
        partnerName: newState.partnerName ?? null,
        partnerImage: ("partnerImage" in newState ? newState.partnerImage : null) as string | null,
        partnerCurrency: ("partnerCurrency" in newState ? newState.partnerCurrency : null) as string | null,
        partnerId: newState.partnerId ?? null,
      });
      router.refresh();
    },
    [router],
  );

  const switchToSelf = useCallback(async () => {
    await clearPartnerView();
    setState({
      isPartnerView: false,
      partnerName: null,
      partnerImage: null,
      partnerCurrency: null,
      partnerId: null,
    });
    router.refresh();
  }, [router]);

  return <PartnerViewContext.Provider value={{ ...state, switchToPartner, switchToSelf }}>{children}</PartnerViewContext.Provider>;
}

export function usePartnerView() {
  return useContext(PartnerViewContext);
}
