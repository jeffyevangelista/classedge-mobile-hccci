import { createContext, useContext, useState, useCallback } from "react";

type NetworkBannerContextType = {
  bannerHeight: number;
  setBannerHeight: (height: number) => void;
};

const NetworkBannerContext = createContext<NetworkBannerContextType>({
  bannerHeight: 0,
  setBannerHeight: () => {},
});

export const NetworkBannerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannerHeight, setBannerHeightState] = useState(0);

  const setBannerHeight = useCallback((height: number) => {
    setBannerHeightState(height);
  }, []);

  return (
    <NetworkBannerContext.Provider value={{ bannerHeight, setBannerHeight }}>
      {children}
    </NetworkBannerContext.Provider>
  );
};

export const useNetworkBannerHeight = () => {
  const context = useContext(NetworkBannerContext);
  if (!context) {
    throw new Error(
      "useNetworkBannerHeight must be used within a NetworkBannerProvider",
    );
  }
  return context;
};
