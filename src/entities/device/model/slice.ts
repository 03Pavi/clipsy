import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Device } from '@/entities/device/model/types';

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
}

const initialState: DeviceState = {
  devices: [],
  isLoading: false,
};

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setDevices: (state, action: PayloadAction<Device[]>) => {
      state.devices = action.payload;
    },
    addDevice: (state, action: PayloadAction<Device>) => {
      state.devices.push(action.payload);
    },
    updateDevice: (
      state,
      action: PayloadAction<{ id: string; changes: Partial<Device> }>
    ) => {
      const { id, changes } = action.payload;
      const index = state.devices.findIndex(d => d.id === id);
      if (index !== -1) state.devices[index] = { ...state.devices[index], ...changes };
    },
    removeDevice: (state, action: PayloadAction<string>) => {
      state.devices = state.devices.filter(d => d.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setDevices,
  addDevice,
  updateDevice,
  removeDevice,
  setLoading,
} = deviceSlice.actions;
export const deviceReducer = deviceSlice.reducer;
