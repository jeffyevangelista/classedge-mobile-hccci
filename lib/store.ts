import createAuthSlice, { type AuthSlice } from "@/features/auth/auth.slice";
import createNetworkSlice, {
  type NetworkSlice,
} from "@/features/network/network.slice";
import { create } from "zustand";

type Store = AuthSlice & NetworkSlice;

const useStore = create<Store>((...a) => ({
  ...createAuthSlice(...a),
  ...createNetworkSlice(...a),
}));

export default useStore;
