'use client';

import { createContext, useContext } from 'react';

export type AppRole = 'admin' | 'producao';

const RoleContext = createContext<AppRole>('admin');

export function RoleProvider({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): AppRole {
  return useContext(RoleContext);
}
