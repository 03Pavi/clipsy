import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface RecentRoom {
  id: string;
  name: string;
  syncCode: string;
  lastAccessed: number;
}

interface RecentRoomsState {
  rooms: RecentRoom[];
}

const initialState: RecentRoomsState = {
  rooms: [],
};

const recentRoomsSlice = createSlice({
  name: 'recentRooms',
  initialState,
  reducers: {
    addRecentRoom: (state, action: PayloadAction<RecentRoom>) => {
      // Remove if it already exists
      const filtered = state.rooms.filter(room => room.id !== action.payload.id);
      // Add to front
      filtered.unshift(action.payload);
      state.rooms = filtered;
    },
    removeRecentRoom: (state, action: PayloadAction<string>) => {
      state.rooms = state.rooms.filter(room => room.id !== action.payload);
    },
  },
});

export const { addRecentRoom, removeRecentRoom } = recentRoomsSlice.actions;
export default recentRoomsSlice.reducer;
