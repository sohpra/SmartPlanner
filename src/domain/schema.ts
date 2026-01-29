import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Import auth models
export * from "./models/auth";
import { users } from "./models/auth";

// === SUBJECTS LIST ===
export const SUBJECTS = [
  "Maths", "English", "Biology", "Chemistry", "Physics", "Geography",
  "History", "French", "Spanish", "German", "Latin", "Greek",
  "Mandarin", "CS", "Economics", "Politics", "Art", "Drama", "DE"
] as const;

// === TABLE DEFINITIONS ===
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  subject: text("subject"), // Required for Internal and Board, null for Competitive
  examType: text("exam_type", { enum: ["Internal", "Board", "Competitive"] }).notNull().default("Internal"),
  examBoard: text("exam_board"),
  competitiveExamName: text("competitive_exam_name"), // Only for Competitive exams
  date: timestamp("date").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  preparedness: integer("preparedness"), // 0-100 for Board exams
  topics: jsonb("topics").$type<{ name: string; difficulty: number }[]>(), // For Internal exams
  createdAt: timestamp("created_at").defaultNow(),
});

export const revisionSlots = pgTable("revision_slots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  examId: integer("exam_id").references(() => exams.id),
  date: timestamp("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  description: text("description").notNull(),
  isCompleted: boolean("is_completed").default(false),
  isRestDay: boolean("is_rest_day").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RECURRING TASK TYPES ===
export const RECURRING_TASK_TYPES = ["homework", "music", "club"] as const;

// === MUSIC INSTRUMENTS ===
export const MUSIC_INSTRUMENTS = ["piano", "singing", "violin", "viola"] as const;

// === RECURRING TASKS TABLE ===
export const recurringTasks = pgTable("recurring_tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  taskType: text("task_type", { enum: ["homework", "music", "club"] }).notNull(),
  subject: text("subject"), // Only for homework type
  instrument: text("instrument"), // Only for music type (piano, singing, violin, viola)
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
  durationMinutes: integer("duration_minutes").notNull().default(60),
  color: text("color").notNull().default("#8b5cf6"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const examsRelations = relations(exams, ({ one, many }) => ({
  user: one(users, {
    fields: [exams.userId],
    references: [users.id],
  }),
  slots: many(revisionSlots),
}));

export const revisionSlotsRelations = relations(revisionSlots, ({ one }) => ({
  user: one(users, {
    fields: [revisionSlots.userId],
    references: [users.id],
  }),
  exam: one(exams, {
    fields: [revisionSlots.examId],
    references: [exams.id],
  }),
}));

export const recurringTasksRelations = relations(recurringTasks, ({ one }) => ({
  user: one(users, {
    fields: [recurringTasks.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertExamSchema = createInsertSchema(exams, {
  subject: z.string().nullable().optional(),
  competitiveExamName: z.string().nullable().optional(),
  topics: z.array(z.object({
    name: z.string().min(1, "Topic name is required"),
    difficulty: z.number().min(0).max(100)
  })).min(1, "Internal exams must have at least one topic").nullable().optional(),
  preparedness: z.number().min(0).max(100).nullable().optional(),
}).omit({ id: true, createdAt: true, userId: true });

export const insertRevisionSlotSchema = createInsertSchema(revisionSlots).omit({ id: true, createdAt: true, userId: true });

export const insertRecurringTaskSchema = createInsertSchema(recurringTasks, {
  taskType: z.enum(["homework", "music", "club"]),
  subject: z.string().nullable().optional(),
  instrument: z.string().nullable().optional(),
  dayOfWeek: z.number().min(0).max(6),
  durationMinutes: z.number().min(15).max(180),
}).omit({ id: true, createdAt: true, userId: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type RevisionSlot = typeof revisionSlots.$inferSelect;
export type InsertRevisionSlot = z.infer<typeof insertRevisionSlotSchema>;
export type RecurringTask = typeof recurringTasks.$inferSelect;
export type InsertRecurringTask = z.infer<typeof insertRecurringTaskSchema>;

// Request types
export type CreateExamRequest = InsertExam;
export type UpdateExamRequest = Partial<InsertExam>;
export type CreateRevisionSlotRequest = InsertRevisionSlot;
export type UpdateRevisionSlotRequest = Partial<InsertRevisionSlot>;
export type GenerateTimetableRequest = {
  startDate: string;
  endDate: string;
  intensity: 'low' | 'medium' | 'high';
  excludedDays: number[];
};

// Response types
export type ExamResponse = Exam;
export type RevisionSlotResponse = RevisionSlot;
export type FullTimetableResponse = {
  exams: Exam[];
  slots: RevisionSlot[];
};
