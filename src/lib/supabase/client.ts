import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/** False when the .env values are missing, so screens can say so instead of reporting a vague network error. */
export const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isGuest?: boolean;
}

const GUEST_STORAGE_KEY = 'archadapt_guest_user';

export function getLocalGuestUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalGuestUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('archadapt_auth_change', { detail: { user } }));
  } catch {
    /* ignore */
  }
}

export function loginAsGuest(name = 'Studio Architect', email = 'architect@archadapt.local'): AppUser {
  const guest: AppUser = {
    id: `guest-${Date.now()}`,
    name,
    email,
    isGuest: true
  };
  setLocalGuestUser(guest);
  return guest;
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Architect',
        email: session.user.email || '',
        avatarUrl: session.user.user_metadata?.avatar_url,
        isGuest: false
      };
    }
  } catch {
    /* fallback to guest check */
  }
  return getLocalGuestUser();
}

export async function logoutApp(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  setLocalGuestUser(null);
}

export function onAppAuthStateChange(callback: (user: AppUser | null) => void): () => void {
  const update = async () => {
    const user = await getCurrentAppUser();
    callback(user);
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Architect',
        email: session.user.email || '',
        avatarUrl: session.user.user_metadata?.avatar_url,
        isGuest: false
      });
    } else {
      callback(getLocalGuestUser());
    }
  });

  // A guest sign-in carries its user in the event so every listener switches in the same tick,
  // before any navigation, instead of briefly seeing nobody signed in.
  const onLocalChange = (event: Event) => {
    const guest = (event as CustomEvent<{ user?: AppUser | null }>).detail?.user;
    if (guest) callback(guest);
    else update();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('archadapt_auth_change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
  }

  // initial check
  update();

  return () => {
    subscription.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('archadapt_auth_change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    }
  };
}

/** Headers for calling our own API routes so the server can act as the signed-in user under RLS. */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
