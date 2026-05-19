import { create } from 'zustand';
import { Participant } from '../types/participant.types';

interface ParticipantState {
  participants: Participant[];
  isLoading: boolean;
  setParticipants: (participants: Participant[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useParticipantStore = create<ParticipantState>((set) => ({
  participants: [],
  isLoading: true,
  setParticipants: (participants) => set({ participants }),
  setLoading: (isLoading) => set({ isLoading }),
}));
