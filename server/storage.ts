import { db } from "./db";
import { users, rooms, roomParticipants, messages } from "@shared/schema";
import type { User, InsertUser, Room, RoomParticipant, Message } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const storage = {
  async createUser(data: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const [user] = await db
      .insert(users)
      .values({ ...data, password: hashedPassword })
      .returning();
    return user;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  },

  async updateUser(id: number, data: Partial<Pick<User, "displayName" | "profilePhoto" | "publicKey" | "preferredLanguage">>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  },

  async deleteUser(id: number): Promise<void> {
    await db.delete(roomParticipants).where(eq(roomParticipants.userId, id));
    await db.delete(messages).where(eq(messages.senderId, id));
    await db.delete(users).where(eq(users.id, id));
  },

  async createRoom(name: string, createdBy: number, languages: string[] = ["en"]): Promise<Room> {
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode));
      if (existing.length === 0) break;
      roomCode = generateRoomCode();
      attempts++;
    }

    const [room] = await db
      .insert(rooms)
      .values({ roomCode, name, createdBy, languages })
      .returning();

    await db.insert(roomParticipants).values({
      roomId: room.id,
      userId: createdBy,
      language: languages[0] || "en",
    });

    return room;
  },

  async getRoomByCode(roomCode: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode.toUpperCase()));
    return room;
  },

  async getRoomById(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  },

  async getUserRooms(userId: number): Promise<(Room & { participantCount: number })[]> {
    const participations = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.userId, userId));

    const result: (Room & { participantCount: number })[] = [];
    for (const p of participations) {
      const room = await this.getRoomById(p.roomId);
      if (room && room.isActive) {
        const allParticipants = await db
          .select()
          .from(roomParticipants)
          .where(eq(roomParticipants.roomId, room.id));
        result.push({ ...room, participantCount: allParticipants.length });
      }
    }
    return result;
  },

  async joinRoom(roomId: number, userId: number, language: string = "en"): Promise<RoomParticipant> {
    const existing = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));

    if (existing.length > 0) return existing[0];

    const [participant] = await db
      .insert(roomParticipants)
      .values({ roomId, userId, language })
      .returning();
    return participant;
  },

  async leaveRoom(roomId: number, userId: number): Promise<void> {
    await db
      .delete(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  },

  async isUserInRoom(roomId: number, userId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
    return result.length > 0;
  },

  async getRoomParticipants(roomId: number): Promise<(RoomParticipant & { user: Pick<User, "id" | "displayName" | "profilePhoto"> })[]> {
    const participants = await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, roomId));

    const result = [];
    for (const p of participants) {
      const user = await this.getUserById(p.userId);
      if (user) {
        result.push({
          ...p,
          user: { id: user.id, displayName: user.displayName, profilePhoto: user.profilePhoto },
        });
      }
    }
    return result;
  },

  async createMessage(
    roomId: number,
    senderId: number,
    content: string,
    messageType: string = "text",
    originalLanguage?: string,
    translatedContent?: Record<string, string>
  ): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values({ roomId, senderId, content, messageType, originalLanguage, translatedContent })
      .returning();
    return message;
  },

  async getRoomMessages(roomId: number, limit: number = 50): Promise<(Message & { sender: Pick<User, "id" | "displayName" | "profilePhoto"> })[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const result = [];
    for (const m of msgs.reverse()) {
      const user = await this.getUserById(m.senderId);
      result.push({
        ...m,
        sender: user
          ? { id: user.id, displayName: user.displayName, profilePhoto: user.profilePhoto }
          : { id: m.senderId, displayName: "Unknown", profilePhoto: null },
      });
    }
    return result;
  },

  async getTotalUsers(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  },

  async getTotalRooms(): Promise<number> {
    const result = await db.select().from(rooms);
    return result.length;
  },

  async setRoomActive(roomId: number, isActive: boolean): Promise<void> {
    await db.update(rooms).set({ isActive }).where(eq(rooms.id, roomId));
  },

  async setUserRole(userId: number, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  },

  async getParticipantLanguage(roomId: number, userId: number): Promise<string> {
    const [p] = await db
      .select()
      .from(roomParticipants)
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
    return p?.language || "en";
  },

  async updateParticipantLanguage(roomId: number, userId: number, language: string): Promise<void> {
    await db
      .update(roomParticipants)
      .set({ language })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)));
  },
};
