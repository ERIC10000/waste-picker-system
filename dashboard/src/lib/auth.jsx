import { createContext, useContext, useEffect, useState } from 'react';
import { api, storedUser, token } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser.get());
  const [loading, setLoading] = useState(Boolean(token.get()));

  useEffect(() => {
    if (!token.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => {
        setUser(res.profile);
        storedUser.set(res.profile);
      })
      .catch(() => {
        token.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const res = await api.login(email, password);
    token.set(res.access_token);
    storedUser.set(res.profile);
    setUser(res.profile);
  };

  const signOut = () => {
    token.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
