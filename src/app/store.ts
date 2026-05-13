import { configureStore } from '@reduxjs/toolkit';
import { clipboardReducer } from '@/entities/clipboard/model/slice';
import { deviceReducer } from '@/entities/device/model/slice';
import { userReducer } from '@/entities/user';

export const store = configureStore({
  reducer: {
    clipboard: clipboardReducer,
    device: deviceReducer,
    user: userReducer,
  },
  middleware: getDefault => getDefault({
    serializableCheck: false
  }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
