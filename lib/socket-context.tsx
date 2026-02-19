import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "./query-client";
import { useAuth } from "./auth-context";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: number) => void;
  leaveRoom: (roomId: number) => void;
  sendMessage: (roomId: number, content: string, messageType?: string) => void;
  sendTyping: (roomId: number, isTyping: boolean) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const baseUrl = getApiUrl();
    const socket = io(baseUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("authenticate", { userId: user.id });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("authenticated", () => {
      console.log("Socket authenticated");
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user?.id]);

  const joinRoom = useCallback((roomId: number) => {
    socketRef.current?.emit("join_room", { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: number) => {
    socketRef.current?.emit("leave_room", { roomId });
  }, []);

  const sendMessage = useCallback((roomId: number, content: string, messageType?: string) => {
    socketRef.current?.emit("send_message", { roomId, content, messageType: messageType || "text" });
  }, []);

  const sendTyping = useCallback((roomId: number, isTyping: boolean) => {
    socketRef.current?.emit("typing", { roomId, isTyping });
  }, []);

  const value = useMemo(
    () => ({ socket: socketRef.current, isConnected, joinRoom, leaveRoom, sendMessage, sendTyping }),
    [isConnected, joinRoom, leaveRoom, sendMessage, sendTyping]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
