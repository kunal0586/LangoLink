import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { setupSocketIO } from "./socket";
import { getSupportedLanguages } from "./translation";

const PgSession = ConnectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  storage.getUserById(req.session.userId).then((user) => {
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      store: new PgSession({
        pool: pool as any,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "lingolink-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, username, password, displayName, preferredLanguage } = req.body;

      if (!email || !username || !password || !displayName) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const user = await storage.createUser({ email, username, password, displayName, preferredLanguage: preferredLanguage || "en" });
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.verifyPassword(email, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.put("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { displayName, preferredLanguage, publicKey } = req.body;
      const user = await storage.updateUser(req.session.userId!, { displayName, preferredLanguage, publicKey });
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Update failed" });
    }
  });

  app.delete("/api/auth/account", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteUser(req.session.userId!);
      req.session.destroy(() => {
        res.json({ success: true });
      });
    } catch (error) {
      res.status(500).json({ error: "Account deletion failed" });
    }
  });

  app.post("/api/rooms", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, languages } = req.body;
      if (!name) return res.status(400).json({ error: "Room name is required" });
      const room = await storage.createRoom(name, req.session.userId!, languages || ["en"]);
      res.status(201).json(room);
    } catch (error) {
      console.error("Create room error:", error);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  app.post("/api/rooms/join", requireAuth, async (req: Request, res: Response) => {
    try {
      const { roomCode, language } = req.body;
      if (!roomCode) return res.status(400).json({ error: "Room code is required" });

      const room = await storage.getRoomByCode(roomCode);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (!room.isActive) return res.status(403).json({ error: "Room is disabled" });

      const user = await storage.getUserById(req.session.userId!);
      await storage.joinRoom(room.id, req.session.userId!, language || user?.preferredLanguage || "en");
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  app.get("/api/rooms", requireAuth, async (req: Request, res: Response) => {
    try {
      const rooms = await storage.getUserRooms(req.session.userId!);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.get("/api/rooms/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      const inRoom = await storage.isUserInRoom(roomId, req.session.userId!);
      if (!inRoom) return res.status(403).json({ error: "Not a member of this room" });

      const room = await storage.getRoomById(roomId);
      if (!room) return res.status(404).json({ error: "Room not found" });

      const participants = await storage.getRoomParticipants(roomId);
      res.json({ ...room, participants });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.get("/api/rooms/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      const inRoom = await storage.isUserInRoom(roomId, req.session.userId!);
      if (!inRoom) return res.status(403).json({ error: "Not a member of this room" });

      const messages = await storage.getRoomMessages(roomId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/rooms/:id/leave", requireAuth, async (req: Request, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      await storage.leaveRoom(roomId, req.session.userId!);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave room" });
    }
  });

  app.put("/api/rooms/:id/language", requireAuth, async (req: Request, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      const { language } = req.body;
      if (!language) return res.status(400).json({ error: "Language is required" });
      await storage.updateParticipantLanguage(roomId, req.session.userId!, language);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update language" });
    }
  });

  app.get("/api/languages", (_req: Request, res: Response) => {
    res.json(getSupportedLanguages());
  });

  app.get("/api/admin/stats", requireAdmin, async (req: Request, res: Response) => {
    const totalUsers = await storage.getTotalUsers();
    const totalRooms = await storage.getTotalRooms();
    res.json({ totalUsers, totalRooms });
  });

  app.post("/api/admin/rooms/:id/toggle", requireAdmin, async (req: Request, res: Response) => {
    const roomId = parseInt(req.params.id);
    const room = await storage.getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    await storage.setRoomActive(roomId, !room.isActive);
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/role", requireAdmin, async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    await storage.setUserRole(userId, role);
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  setupSocketIO(httpServer);

  return httpServer;
}
