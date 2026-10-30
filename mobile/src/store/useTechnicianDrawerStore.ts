import { create } from 'zustand';

interface TechnicianDrawerState {
  isOpen: boolean;
  activeRoute: string;
  openDrawer: (currentRoute?: string) => void;
  closeDrawer: () => void;
}

export const useTechnicianDrawerStore = create<TechnicianDrawerState>((set) => ({
  isOpen: false,
  activeRoute: 'Dashboard',
  openDrawer: (currentRoute) =>
    set((state) => ({ isOpen: true, activeRoute: currentRoute || state.activeRoute })),
  closeDrawer: () => set({ isOpen: false }),
}));
