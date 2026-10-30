import { create } from 'zustand';

interface AdminDrawerState {
  isOpen: boolean;
  activeRoute: string;
  openDrawer: (currentRoute?: string) => void;
  closeDrawer: () => void;
}

export const useAdminDrawerStore = create<AdminDrawerState>((set) => ({
  isOpen: false,
  activeRoute: 'Employees',
  openDrawer: (currentRoute) =>
    set((state) => ({
      isOpen: true,
      activeRoute: currentRoute || state.activeRoute,
    })),
  closeDrawer: () => set({ isOpen: false }),
}));
