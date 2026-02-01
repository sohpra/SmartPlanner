/* =========================
   SmartPlanner — Layer 2
   Exam → Revision Demand → Slot Plan
   Pure TypeScript (no Supabase, no React)
   ========================= */

export type ExamType = "Internal" | "Board" | "Competitive";

export type ExamInput = {
  id: string;
  subject: string | null;
  exam_type: ExamType;
  date: string;
  preparedness: number | null;
  topics?: unknown;
};

export type RevisionProfile = {
  slotMinutes: number;
  maxSlotsPerDay: number;
  maxSlotsPerDayWhenClose?: number;
  closeWindowDays?: number;
};

export type RevisionDemand = {
  examId: string;
  examDate: string;
  subject: string;
  examType: ExamType;
  preparedness: number;
  profile: RevisionProfile;

  totalMinutes: number;
  slotMinutes: number;
  totalSlots: number;
  remainingSlots: number;
};

export type PlannedRevisionSlot = {
  date: string;
  examId: string;
  subject: string;
  examType: ExamType;
  slotMinutes: number;
  label: string;
};

export type DailyRevisionPlan = {
  date: string;
  capacityMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  slots: PlannedRevisionSlot[];
};

export type RevisionPlanResult = {
  days: DailyRevisionPlan[];
  demands: RevisionDemand[];
  unmet: {
    examId: string;
    subject: string;
    examDate: string;
    remainingSlots: number;
    remainingMinutes: number;
  }[];
  notes: string[];
};

export type RevisionEngineOptions = {
  startDate: string;
  numDays?: number;
  capacityByDate: Record<string, number>;
  includeExamDay?: boolean;
};

/* -------------------- */

const BASE_MINUTES_BY_TYPE: Record<ExamType, number> = {
  Internal: 120,
  Board: 480,
  Competitive: 600,
};

const DEFAULT_PROFILE_BY_TYPE: Record<ExamType, RevisionProfile> = {
  Internal: { slotMinutes: 30, maxSlotsPerDay: 2 },
  Board: {
    slotMinutes: 45,
    maxSlotsPerDay: 2,
    maxSlotsPerDayWhenClose: 3,
    closeWindowDays: 3,
  },
  Competitive: {
    slotMinutes: 60,
    maxSlotsPerDay: 2,
    maxSlotsPerDayWhenClose: 3,
    closeWindowDays: 3,
  },
};

function hasFutureCapacity(
  days: DailyRevisionPlan[],
  fromDate: string,
  examDate: string,
  slotMinutes: number
) {
  return days.some(
    (d) =>
      d.date > fromDate && d.date < examDate && d.remainingMinutes >= slotMinutes
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Accepts "YYYY-MM-DD" or ISO and returns "YYYY-MM-DD"
export function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}
//changed
// src/lib/planner/revisionEngine.ts
export function addDays(dateYYYYMMDD: string, days: number): string {
  // If dateYYYYMMDD is malformed or missing, fallback to today to prevent crash
  if (!dateYYYYMMDD || dateYYYYMMDD === "undefined") {
    dateYYYYMMDD = new Date().toISOString().slice(0, 10);
  }

  // Ensure we are only using the date part (YYYY-MM-DD)
  const cleanDate = dateYYYYMMDD.split('T')[0];
  const d = new Date(cleanDate + "T00:00:00");

  if (isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function typePriority(t: ExamType): number {
  if (t === "Competitive") return 3;
  if (t === "Board") return 2;
  return 1;
}

export function buildRevisionDemand(exam: ExamInput): RevisionDemand | null {
  const examDate = toDateOnly(exam.date);
  const subject = (exam.subject ?? "").trim();
  if (!examDate || !subject) return null;

  // 50% is baseline:
  // 25% => multiplier 1.5 (more minutes)
  // 75% => multiplier 0.5 (fewer minutes) but floored at 0.4
  const preparedness = clamp(exam.preparedness ?? 50, 0, 100);
  const base = BASE_MINUTES_BY_TYPE[exam.exam_type];
  const multiplier = clamp((100 - preparedness) / 50, 0.4, 2);
  const totalMinutes = Math.round(base * multiplier);

  const profile = DEFAULT_PROFILE_BY_TYPE[exam.exam_type];
  const slotMinutes = profile.slotMinutes;
  const totalSlots = Math.ceil(totalMinutes / slotMinutes);

  return {
    examId: exam.id,
    examDate,
    subject,
    examType: exam.exam_type,
    preparedness,
    profile,
    totalMinutes,
    slotMinutes,
    totalSlots,
    remainingSlots: totalSlots,
  };
}

function maxSlotsForExamOnDay(d: RevisionDemand, daysToExam: number) {
  const p = d.profile;
  if (
    p.maxSlotsPerDayWhenClose != null &&
    p.closeWindowDays != null &&
    daysToExam <= p.closeWindowDays
  ) {
    return p.maxSlotsPerDayWhenClose;
  }
  return p.maxSlotsPerDay;
}

function makeLabel(d: RevisionDemand) {
  if (d.examType === "Competitive") return `${d.subject} — past paper`;
  if (d.examType === "Board") return `${d.subject} — exam practice`;
  return `${d.subject} — revision`;
}

function sortDemandsForDay(demands: RevisionDemand[], today: string) {
  return [...demands].sort((a, b) => {
    const da = daysBetween(today, a.examDate);
    const db = daysBetween(today, b.examDate);
    if (da !== db) return da - db;

    const pa = typePriority(a.examType);
    const pb = typePriority(b.examType);
    if (pa !== pb) return pb - pa;

    // lower preparedness first
    if (a.preparedness !== b.preparedness) return a.preparedness - b.preparedness;

    return a.subject.localeCompare(b.subject);
  });
}

/* =========================
   CORE ENGINE
   ========================= */

export function planRevisionSlots(
  exams: ExamInput[],
  opts: RevisionEngineOptions
): RevisionPlanResult {
  const numDays = opts.numDays ?? 7;
  const includeExamDay = opts.includeExamDay ?? true;
  const notes: string[] = [];

  const windowDates = Array.from({ length: numDays }, (_, i) =>
    addDays(opts.startDate, i)
  );

  const demands = exams
    .map(buildRevisionDemand)
    .filter((d): d is RevisionDemand => {
      if (!d) return false;
      return daysBetween(opts.startDate, d.examDate) >= 0;
    });

  const days: DailyRevisionPlan[] = windowDates.map((date) => {
    const cap = opts.capacityByDate[date] ?? 0;
    return {
      date,
      capacityMinutes: cap,
      usedMinutes: 0,
      remainingMinutes: cap,
      slots: [],
    };
  });

  if (demands.length === 0) {
    return { days, demands: [], unmet: [], notes };
  }

  /* ============================================================
     PHASE A — FILL ALL AVAILABLE CAPACITY (EARLIEST FIRST)
     ============================================================ */

  let placedSomething = true;

  while (placedSomething) {
    placedSomething = false;

    for (const day of days) {
      if (day.remainingMinutes <= 0) continue;

      const eligible = demands
        .filter((d) => {
          if (d.remainingSlots <= 0) return false;
          const daysToExam = daysBetween(day.date, d.examDate);
          if (daysToExam < 0) return false;
          if (!includeExamDay && daysToExam === 0) return false;
          return day.remainingMinutes >= d.slotMinutes;
        })
        .sort((a, b) => {
          const da = daysBetween(day.date, a.examDate);
          const db = daysBetween(day.date, b.examDate);
          if (da !== db) return da - db;
          if (typePriority(a.examType) !== typePriority(b.examType)) {
            return typePriority(b.examType) - typePriority(a.examType);
          }
          return a.preparedness - b.preparedness;
        });

      if (eligible.length === 0) continue;

      const d = eligible[0];

      day.slots.push({
        date: day.date,
        examId: d.examId,
        subject: d.subject,
        examType: d.examType,
        slotMinutes: d.slotMinutes,
        label: makeLabel(d),
      });

      d.remainingSlots--;
      day.usedMinutes += d.slotMinutes;
      day.remainingMinutes -= d.slotMinutes;
      placedSomething = true;
    }
  }

  /* ============================================================
     PHASE B — OVERLOAD (ONLY IF ABSOLUTELY NECESSARY)
     ============================================================ */

  const unmetAfterCapacity = demands.filter((d) => d.remainingSlots > 0);

  if (unmetAfterCapacity.length > 0) {
    notes.push("Overload applied after exhausting all base capacity.");

    for (const d of unmetAfterCapacity) {
      while (d.remainingSlots > 0) {
        let targetDay: DailyRevisionPlan | undefined;

        for (let i = days.length - 1; i >= 0; i--) {
          const day = days[i];
          const daysToExam = daysBetween(day.date, d.examDate);
          if (daysToExam < 0) continue;
          if (!includeExamDay && daysToExam === 0) continue;
          targetDay = day;
          break;
        }

        if (!targetDay) break;

        targetDay.slots.push({
          date: targetDay.date,
          examId: d.examId,
          subject: d.subject,
          examType: d.examType,
          slotMinutes: d.slotMinutes,
          label: makeLabel(d),
        });

        d.remainingSlots--;
        targetDay.usedMinutes += d.slotMinutes;
        targetDay.remainingMinutes -= d.slotMinutes; // allowed to go negative
      }
    }
  }

  /* ============================================================
     UNMET + NOTES
     ============================================================ */

  const unmet = demands
    .filter((d) => d.remainingSlots > 0)
    .map((d) => ({
      examId: d.examId,
      subject: d.subject,
      examDate: d.examDate,
      remainingSlots: d.remainingSlots,
      remainingMinutes: d.remainingSlots * d.slotMinutes,
    }));

  const totalPlanned = days.reduce((s, d) => s + d.usedMinutes, 0);
  const totalDemand = demands.reduce((s, d) => s + d.totalMinutes, 0);

  notes.push(`Planned ${totalPlanned} mins across ${numDays} days.`);
  notes.push(`Total revision demand: ${totalDemand} mins.`);

  return { days, demands, unmet, notes };
}

