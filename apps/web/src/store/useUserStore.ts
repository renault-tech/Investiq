import { create } from "zustand";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  plan: string;
  is_verified: boolean;
}

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAdmin: () => get().user?.role === "admin",
  isAuthenticated: () => get().user \!== null,
}));
