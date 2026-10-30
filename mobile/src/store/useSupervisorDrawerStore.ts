import { create } from 'zustand';

interface SupervisorDrawerState {
  isOpen: boolean;
  activeRoute: string;
  openDrawer: (currentRoute?: string) => void;
  closeDrawer: () => void;
}

export const useSupervisorDrawerStore = create<SupervisorDrawerState>((set) => ({
  isOpen: false,
  activeRoute: 'SupervisorDashboard',
  openDrawer: (currentRoute) =>
    set((state) => ({ isOpen: true, activeRoute: currentRoute || state.activeRoute })),
  closeDrawer: () => set({ isOpen: false }),
}));
