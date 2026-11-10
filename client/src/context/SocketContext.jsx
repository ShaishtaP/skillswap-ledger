import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { tokenStore } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

// One live connection to the server per logged-in user, shared by live
// notifications (useRealtime) and video calls (useCall).
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const s = io({ auth: { token: tokenStore.get() } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
    // Reconnect only when a different user logs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
