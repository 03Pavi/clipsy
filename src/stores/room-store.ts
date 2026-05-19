import { create } from 'zustand';
import { Room } from '../types/room.types';

interface RoomState {
  currentRoom: Room | null;
  userRooms: Room[];
  isLoading: boolean;
  setCurrentRoom: (room: Room | null) => void;
  setUserRooms: (rooms: Room[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  userRooms: [],
  isLoading: true,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setUserRooms: (rooms) => set({ userRooms: rooms }),
  setLoading: (isLoading) => set({ isLoading }),
}));
