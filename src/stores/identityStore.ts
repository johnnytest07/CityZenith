import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole, Council } from '@/types/identity'

interface IdentityStore {
  role: UserRole | null
  council: Council | null
  /** True once the user has completed the identity gate */
  isIdentified: boolean

  setIdentity: (role: UserRole, council: Council) => void
  clearIdentity: () => void
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set) => ({
      role: null,
      council: null,
      isIdentified: false,

      setIdentity: (role, council) => {
        set({ role, council, isIdentified: true })
      },

      clearIdentity: () => {
        set({ role: null, council: null, isIdentified: false })
      },
    }),
    {
      name: 'cityzenith-identity',
    },
  ),
)
