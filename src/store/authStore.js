'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      
      setAuth: (token, user) => {
        set({ token, user });
      },
      
      clearAuth: () => {
        set({ token: null, user: null });
      },
      
      isAuthenticated: () => {
        const state = useAuthStore.getState();
        return !!state.token;
      },
      
      isAdmin: () => {
        const state = useAuthStore.getState();
        return state.user?.role === 'admin';
      },
      
      isNGO: () => {
        const state = useAuthStore.getState();
        return state.user?.role === 'ngo';
      },
      
      isOrgSPOC: () => {
        const state = useAuthStore.getState();
        return state.user?.role === 'org_spoc';
      },
      
      isOrgMember: () => {
        const state = useAuthStore.getState();
        return state.user?.role === 'org_member';
      },
      
      isOrgUser: () => {
        const state = useAuthStore.getState();
        return state.user?.role === 'org_spoc' || state.user?.role === 'org_member';
      },
      
      canCreateEvent: () => {
        const state = useAuthStore.getState();
        return ['admin', 'ngo', 'org_spoc'].includes(state.user?.role);
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;