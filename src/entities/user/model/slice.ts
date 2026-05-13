import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserInfo {
  uid: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface UserState {
  info: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  previewTheme: string;
}

const initialState: UserState = {
  info: null,
  isAuthenticated: false,
  isLoading: true,
  previewTheme: 'space',
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserInfo>) => {
      state.info = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.info = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.previewTheme = 'space';
    },
    setPreviewTheme: (state, action: PayloadAction<string>) => {
      state.previewTheme = action.payload;
    },
  },
});

export const { setUser, setLoading, logout, setPreviewTheme } = userSlice.actions;
export const userReducer = userSlice.reducer;
