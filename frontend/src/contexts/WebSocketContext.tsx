import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { authService } from "../services/auth.service";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:3000";

interface ShareNotification {
  shareId: string;
  fileName: string;
  ownerName: string;
  ownerEmail: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  pendingNotification: ShareNotification | null;
  clearNotification: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  pendingNotification: null,
  clearNotification: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingNotification, setPendingNotification] =
    useState<ShareNotification | null>(null);

  useEffect(() => {
    let newSocket: Socket | null = null;

    const initializeSocket = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user || !user.id) return;

        // Connect to WebSocket server
        newSocket = io(WS_URL, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });

        newSocket.on("connect", () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          // Register user with their ID
          newSocket?.emit("registerUser", user.id);
          console.log("Registered user:", user.id);
        });

        newSocket.on("disconnect", () => {
          console.log("WebSocket disconnected");
          setIsConnected(false);
        });

        newSocket.on("connect_error", (error) => {
          console.error("WebSocket connection error:", error);
        });

        // Listen for share notifications
        newSocket.on("share-received", (notification: ShareNotification) => {
          console.log("Share notification received:", notification);
          setPendingNotification(notification);
        });

        setSocket(newSocket);
      } catch (error) {
        console.error("Failed to initialize socket:", error);
      }
    };

    initializeSocket();

    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, []);

  const clearNotification = () => {
    setPendingNotification(null);
  };

  return (
    <WebSocketContext.Provider
      value={{ socket, isConnected, pendingNotification, clearNotification }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
