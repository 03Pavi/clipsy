import { create } from 'zustand';
import { Device } from '../types/device.types';

interface DeviceState {
  devices: Device[];
  isLoading: boolean;
  setDevices: (devices: Device[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  isLoading: true,
  setDevices: (devices) => set({ devices }),
  setLoading: (isLoading) => set({ isLoading }),
}));
