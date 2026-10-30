'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppUser, onAppAuthStateChange } from '@/lib/supabase/client';
import { AuthStatus, authRedirect, safeNext, statusForUser } from './guard';

interface AuthValue {
  status: AuthStatus;
  user: AppUser | null;
}

const AuthContext = createContext<AuthValue>({ status: 'loading', user: null });

/** One subscription to Supabase sessions and the guest store for the whole app. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthValue>({ status: 'loading', user: null });

  useEffect(() => {
    const unsubscribe = onAppAuthStateChange((user) => setState({ status: statusForUser(user), user }));
    return () => unsubscribe();
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Applies the shared redirect rules for the current page. Mount once per page that needs them. */
export function useAuthGuard() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    const target = authRedirect(auth.status, pathname, safeNext(next));
    if (target) router.replace(target);
  }, [auth.status, pathname, router]);

  return auth;
}
