import { create } from 'zustand';
import { ClipboardItem } from '../types/clipboard.types';

interface ClipboardState {
  items: ClipboardItem[];
  isLoading: boolean;
  setItems: (items: ClipboardItem[]) => void;
  addItem: (item: ClipboardItem) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  items: [],
  isLoading: true,
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  setLoading: (isLoading) => set({ isLoading }),
}));
