import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ClipboardItem } from '@/entities/clipboard/model/types';

interface ClipboardState {
  items: ClipboardItem[];
  isSyncing: boolean;
}

const initialState: ClipboardState = {
  items: [],
  isSyncing: false,
};

const clipboardSlice = createSlice({
  name: 'clipboard',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<ClipboardItem[]>) => {
      state.items = action.payload;
    },
    addItem: (state, action: PayloadAction<ClipboardItem>) => {
      state.items.unshift(action.payload);
    },
    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
  },
});

export const {
  setItems,
  addItem,
  removeItem,
  setSyncing,
} = clipboardSlice.actions;
export const clipboardReducer = clipboardSlice.reducer;
