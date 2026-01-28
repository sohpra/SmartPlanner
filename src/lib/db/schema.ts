import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

/* =========================================================
   CONSTANTS
========================================================= */

export const SUBJECTS = [
  "Maths", "English", "Biology", "Chemistry", "Physics", "Geography",
  "History", "French", "Spanish", "German", "Latin", "Greek",
  "Mandarin", "CS", "Economics", "Politics", "Art", "Drama", "DE",
] as const;

export const RECURRING_TASK_TYPES = ["homework", "music", "club"] as const;
export const MUSIC_INSTRUMENTS = ["piano", "singing", "violin", "viola"] as const;

/* =========================================================
   TABLES
========================================================= */

export const exams = pgTable("exams", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").notNull(),

  subject: text("subject"), // Required for Internal & Board, null for Competitive

  examType: text("exam_type", {
    enum: ["Internal", "Board", "Competitive"],
  })
    .notNull()
    .default("Internal"),

  examBoard: text("exam_board"),

  competitiveExamName: text("competitive_exam_name"),

  date: timestamp("date", { withTimezone: true }).notNull(),

  color: text("color").notNull().default("#3b82f6"),

  preparedness: integer("preparedness"), // 0–100 (Board exams)

  topics: jsonb("topics").$type<
    { name: string; difficulty: number }[]
  >(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const revisionSlots = pgTable("revision_slots", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").notNull(),

  examId: uuid("exam_id").references(() => exams.id),

  date: timestamp("date", { withTimezone: true }).notNull(),

  durationMinutes: integer("duration_minutes")
    .notNull()
    .default(60),

  description: text("description").notNull(),

  isCompleted: boolean("is_completed").default(false),

  isRestDay: boolean("is_rest_day").default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const recurringTasks = pgTable("recurring_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").notNull(),

  name: text("name").notNull(),

  taskType: text("task_type", {
    enum: ["homework", "music", "club"],
  }).notNull(),

  subject: text("subject"), // homework only

  instrument: text("instrument"), // music only

  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday

  durationMinutes: integer("duration_minutes")
    .notNull()
    .default(60),

  color: text("color").notNull().default("#8b5cf6"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* =========================================================
   RELATIONS (NO users TABLE — Supabase Auth handles users)
========================================================= */

export const examsRelations = relations(exams, ({ many }) => ({
  slots: many(revisionSlots),
}));

export const revisionSlotsRelations = relations(revisionSlots, ({ one }) => ({
  exam: one(exams, {
    fields: [revisionSlots.examId],
    references: [exams.id],
  }),
}));

export const recurringTasksRelations = relations(recurringTasks, () => ({}));

/* =========================================================
   INSERT SCHEMAS
========================================================= */

export const insertExamSchema = createInsertSchema(exams, {
  subject: z.string().nullable().optional(),
  competitiveExamName: z.string().nullable().optional(),
  topics: z
    .array(
      z.object({
        name: z.string().min(1, "Topic name is required"),
        difficulty: z.number().min(0).max(100),
      })
    )
    .min(1, "Internal exams must have at least one topic")
    .nullable()
    .optional(),
  preparedness: z.number().min(0).max(100).nullable().optional(),
}).omit({ id: true, createdAt: true, userId: true });

export const insertRevisionSlotSchema =
  createInsertSchema(revisionSlots).omit({
    id: true,
    createdAt: true,
    userId: true,
  });

export const insertRecurringTaskSchema = createInsertSchema(recurringTasks, {
  taskType: z.enum(["homework", "music", "club"]),
  subject: z.string().nullable().optional(),
  instrument: z.string().nullable().optional(),
  dayOfWeek: z.number().min(0).max(6),
  durationMinutes: z.number().min(15).max(180),
}).omit({ id: true, createdAt: true, userId: true });

/* =========================================================
   TYPES
========================================================= */

export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;

export type RevisionSlot = typeof revisionSlots.$inferSelect;
export type InsertRevisionSlot = z.infer<typeof insertRevisionSlotSchema>;

export type RecurringTask = typeof recurringTasks.$inferSelect;
export type InsertRecurringTask = z.infer<typeof insertRecurringTaskSchema>;

/* =========================================================
   API CONTRACT TYPES
========================================================= */

export type CreateExamRequest = InsertExam;
export type UpdateExamRequest = Partial<InsertExam>;

export type CreateRevisionSlotRequest = InsertRevisionSlot;
export type UpdateRevisionSlotRequest = Partial<InsertRevisionSlot>;

export type GenerateTimetableRequest = {
  startDate: string;
  endDate: string;
  intensity: "low" | "medium" | "high";
  excludedDays: number[];
};

export type ExamResponse = Exam;
export type RevisionSlotResponse = RevisionSlot;

export type FullTimetableResponse = {
  exams: Exam[];
  slots: RevisionSlot[];
};
