import { create } from "zustand";

interface LoadingState {
  count: number;
  message: string | null;
  start: (message?: string) => void;
  stop: () => void;
  reset: () => void;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  count: 0,
  message: null,
  start: (message) => {
    const next = get().count + 1;
    set({ count: next, message: message ?? get().message ?? "加载中…" });
  },
  stop: () => {
    const next = Math.max(0, get().count - 1);
    set({
      count: next,
      message: next === 0 ? null : get().message,
    });
  },
  reset: () => set({ count: 0, message: null }),
}));

export const useIsAppLoading = () =>
  useLoadingStore((s) => s.count > 0);

export const useLoadingMessage = () =>
  useLoadingStore((s) => s.message);
