import createAuthSlice, { type AuthSlice } from "@/features/auth/auth.slice";
import { create } from "zustand";

type Store = AuthSlice;

const useStore = create<Store>((...a) => ({
  ...createAuthSlice(...a),
}));

export default useStore;
