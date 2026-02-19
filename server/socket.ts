import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { storage } from "./storage";
import { translateMessage } from "./translation";

const onlineUsers = new Map<number, Set<string>>();
const userRooms = new Map<string, Set<number>>();

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    let currentUserId: number | null = null;

    socket.on("authenticate", async (data: { userId: number }) => {
      currentUserId = data.userId;
      const user = await storage.getUserById(currentUserId);
      if (!user) {
        socket.emit("error", { message: "User not found" });
        return;
      }

      if (!onlineUsers.has(currentUserId)) {
        onlineUsers.set(currentUserId, new Set());
      }
      onlineUsers.get(currentUserId)!.add(socket.id);

      socket.emit("authenticated", { userId: currentUserId });
    });

    socket.on("join_room", async (data: { roomId: number }) => {
      if (!currentUserId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      const inRoom = await storage.isUserInRoom(data.roomId, currentUserId);
      if (!inRoom) {
        socket.emit("error", { message: "Not a member of this room" });
        return;
      }

      const roomKey = `room:${data.roomId}`;
      socket.join(roomKey);

      if (!userRooms.has(socket.id)) {
        userRooms.set(socket.id, new Set());
      }
      userRooms.get(socket.id)!.add(data.roomId);

      const user = await storage.getUserById(currentUserId);
      socket.to(roomKey).emit("user_joined", {
        userId: currentUserId,
        displayName: user?.displayName,
        roomId: data.roomId,
      });

      const onlineInRoom = await getOnlineUsersInRoom(data.roomId);
      io.to(roomKey).emit("online_users", { roomId: data.roomId, users: onlineInRoom });
    });

    socket.on("leave_room", (data: { roomId: number }) => {
      const roomKey = `room:${data.roomId}`;
      socket.leave(roomKey);
      userRooms.get(socket.id)?.delete(data.roomId);

      if (currentUserId) {
        socket.to(roomKey).emit("user_left", {
          userId: currentUserId,
          roomId: data.roomId,
        });
      }
    });

    socket.on("send_message", async (data: { roomId: number; content: string; messageType?: string }) => {
      if (!currentUserId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      const inRoom = await storage.isUserInRoom(data.roomId, currentUserId);
      if (!inRoom) {
        socket.emit("error", { message: "Not a member of this room" });
        return;
      }

      const room = await storage.getRoomById(data.roomId);
      if (!room) return;

      const participants = await storage.getRoomParticipants(data.roomId);
      const senderParticipant = participants.find(p => p.userId === currentUserId);
      const senderLang = senderParticipant?.language || "en";
      const targetLanguages = [...new Set(
        participants
          .map((p) => p.language)
          .filter((lang) => lang !== senderLang)
      )];

      let translationResult = { detectedLanguage: senderLang, translations: {} as Record<string, string>, confidence: 1.0 };

      if (targetLanguages.length > 0 && data.content.trim().length > 0) {
        translationResult = await translateMessage(data.content, targetLanguages);
      }

      const message = await storage.createMessage(
        data.roomId,
        currentUserId,
        data.content,
        data.messageType || "text",
        translationResult.detectedLanguage,
        translationResult.translations
      );

      const sender = await storage.getUserById(currentUserId);
      const roomKey = `room:${data.roomId}`;

      io.to(roomKey).emit("new_message", {
        ...message,
        sender: sender
          ? { id: sender.id, displayName: sender.displayName, profilePhoto: sender.profilePhoto }
          : { id: currentUserId, displayName: "Unknown", profilePhoto: null },
        translationResult: {
          detectedLanguage: translationResult.detectedLanguage,
          translations: translationResult.translations,
          confidence: translationResult.confidence,
        },
      });
    });

    socket.on("typing", (data: { roomId: number; isTyping: boolean }) => {
      if (!currentUserId) return;
      const roomKey = `room:${data.roomId}`;
      socket.to(roomKey).emit("user_typing", {
        userId: currentUserId,
        roomId: data.roomId,
        isTyping: data.isTyping,
      });
    });

    socket.on("disconnect", async () => {
      if (currentUserId) {
        const sockets = onlineUsers.get(currentUserId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUsers.delete(currentUserId);
          }
        }

        const rooms = userRooms.get(socket.id);
        if (rooms) {
          for (const roomId of rooms) {
            const roomKey = `room:${roomId}`;
            socket.to(roomKey).emit("user_left", {
              userId: currentUserId,
              roomId,
            });
            const onlineInRoom = await getOnlineUsersInRoom(roomId);
            io.to(roomKey).emit("online_users", { roomId, users: onlineInRoom });
          }
        }
        userRooms.delete(socket.id);
      }
    });
  });

  async function getOnlineUsersInRoom(roomId: number): Promise<number[]> {
    const participants = await storage.getRoomParticipants(roomId);
    return participants
      .filter((p) => onlineUsers.has(p.userId))
      .map((p) => p.userId);
  }

  return io;
}
