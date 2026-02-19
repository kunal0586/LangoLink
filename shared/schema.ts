import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  profilePhoto: text("profile_photo"),
  publicKey: text("public_key"),
  role: text("role").notNull().default("user"),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 8 }).notNull().unique(),
  name: text("name").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  languages: jsonb("languages").$type<string[]>().notNull().default(sql`'["en"]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const roomParticipants = pgTable("room_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  language: text("language").notNull().default("en"),
  joinedAt: timestamp("joined_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  translatedContent: jsonb("translated_content").$type<Record<string, string>>(),
  originalLanguage: text("original_language"),
  messageType: text("message_type").notNull().default("text"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
  password: true,
  displayName: true,
  preferredLanguage: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  languages: z.array(z.string()).min(1).optional(),
});

export const joinRoomSchema = z.object({
  roomCode: z.string().length(6),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1),
  messageType: z.enum(["text", "voice", "image"]).optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Room = typeof rooms.$inferSelect;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
