import Cookies from 'js-cookie';

const TOKEN_KEY = 'crm_token';
const USER_KEY  = 'crm_user';

const COOKIE_OPTS = {
  expires: 7,       // 7 days
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
};

export const setSession = (token, user) => {
  Cookies.set(TOKEN_KEY, token, COOKIE_OPTS);
  // Store user in localStorage for instant reads without a network call
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearSession = () => {
  Cookies.remove(TOKEN_KEY);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
  }
};

export const getToken = () => Cookies.get(TOKEN_KEY) || null;

export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => !!getToken();
