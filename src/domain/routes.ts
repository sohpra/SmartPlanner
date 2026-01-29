import { z } from 'zod';
import { insertExamSchema, insertRevisionSlotSchema, insertRecurringTaskSchema, exams, revisionSlots, recurringTasks } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  exams: {
    list: {
      method: 'GET' as const,
      path: '/api/exams',
      responses: {
        200: z.array(z.custom<typeof exams.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/exams',
      input: insertExamSchema,
      responses: {
        201: z.custom<typeof exams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/exams/:id',
      input: insertExamSchema.partial(),
      responses: {
        200: z.custom<typeof exams.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/exams/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  revision: {
    list: {
      method: 'GET' as const,
      path: '/api/revision-slots',
      input: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof revisionSlots.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/revision-slots',
      input: insertRevisionSlotSchema,
      responses: {
        201: z.custom<typeof revisionSlots.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/revision-slots/generate',
      input: z.object({
        startDate: z.string(),
        endDate: z.string(),
        intensity: z.enum(['low', 'medium', 'high']),
        excludedDays: z.array(z.number()), // 0-6
      }),
      responses: {
        201: z.array(z.custom<typeof revisionSlots.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/revision-slots/:id',
      input: insertRevisionSlotSchema.partial(),
      responses: {
        200: z.custom<typeof revisionSlots.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/revision-slots/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  recurringTasks: {
    list: {
      method: 'GET' as const,
      path: '/api/recurring-tasks',
      responses: {
        200: z.array(z.custom<typeof recurringTasks.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/recurring-tasks',
      input: insertRecurringTaskSchema,
      responses: {
        201: z.custom<typeof recurringTasks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/recurring-tasks/:id',
      input: insertRecurringTaskSchema.partial(),
      responses: {
        200: z.custom<typeof recurringTasks.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/recurring-tasks/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE EXPORTS
// ============================================
export type ExamInput = z.infer<typeof api.exams.create.input>;
export type RevisionSlotInput = z.infer<typeof api.revision.create.input>;
export type RecurringTaskInput = z.infer<typeof api.recurringTasks.create.input>;
