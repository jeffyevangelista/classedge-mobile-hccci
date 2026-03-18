import type { StateCreator } from "zustand";

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
};

type NetworkAction = {
  setNetworkState: (state: Partial<NetworkState>) => void;
};

export type NetworkSlice = NetworkState & NetworkAction;

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
};

const createNetworkSlice: StateCreator<NetworkSlice> = (set) => ({
  ...initialState,
  setNetworkState: (networkState) => set((prev) => ({ ...prev, ...networkState })),
});

export default createNetworkSlice;
