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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Accepts "YYYY-MM-DD" or ISO and returns "YYYY-MM-DD"
export function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export function addDays(dateYYYYMMDD: string, days: number): string {
  const d = new Date(dateYYYYMMDD + "T00:00:00");
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

      // 🔒 invariant: past exams do not exist
      return daysBetween(opts.startDate, d.examDate) >= 0;
    });

  if (demands.length === 0) {
    return {
      days: windowDates.map((date) => {
        const cap = opts.capacityByDate[date] ?? 0;
        return {
          date,
          capacityMinutes: cap,
          usedMinutes: 0,
          remainingMinutes: cap,
          slots: [],
        };
      }),
      demands: [],
      unmet: [],
      notes: ["No valid upcoming exams found to generate revision demands."],
    };
  }

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

  for (const day of days) {
    if (day.remainingMinutes <= 0) continue;

    const eligible = demands.filter((d) => {
      if (d.remainingSlots <= 0) return false;

      const daysToExam = daysBetween(day.date, d.examDate);
      if (daysToExam < 0) return false;
      if (!includeExamDay && daysToExam === 0) return false;

      return true;
    });

    if (eligible.length === 0) continue;

    const ordered = sortDemandsForDay(eligible, day.date);

    for (const d of ordered) {
      if (day.remainingMinutes < d.slotMinutes) continue;
      if (d.remainingSlots <= 0) continue;

      const daysToExam = daysBetween(day.date, d.examDate);
      const maxSlotsToday = maxSlotsForExamOnDay(d, daysToExam);

      const alreadyToday = day.slots.filter((s) => s.examId === d.examId).length;
      if (alreadyToday >= maxSlotsToday) continue;

      const isLastAllowedDay = !includeExamDay && daysToExam === 1;

      // ✅ Rule: if includeExamDay=false, ensure there is revision on the day before.
      // Minimal way: reserve 1 slot until day-before so we can’t schedule EVERYTHING too early.
      const mustReserveOneForDayBefore = !includeExamDay && daysToExam > 1;

      const effectiveRemainingForToday = mustReserveOneForDayBefore
        ? Math.max(0, d.remainingSlots - 1)
        : d.remainingSlots;

      if (effectiveRemainingForToday <= 0 && !isLastAllowedDay) {
        continue; // keep the reserved slot for day-before
      }

      const remainingDays = Math.max(1, daysToExam + 1); // includes today
      const targetSlotsToday = isLastAllowedDay
        ? d.remainingSlots // pull forward everything remaining
        : Math.max(1, Math.ceil(effectiveRemainingForToday / remainingDays));

      const remainingDailyCap = Math.max(0, maxSlotsToday - alreadyToday);
      const maxByCapacity = Math.floor(day.remainingMinutes / d.slotMinutes);

      const canPlace = Math.max(
        0,
        Math.min(targetSlotsToday, effectiveRemainingForToday, remainingDailyCap, maxByCapacity)
      );

      for (let i = 0; i < canPlace; i++) {
        if (day.remainingMinutes < d.slotMinutes) break;
        if (d.remainingSlots <= 0) break;

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
      }

      if (day.remainingMinutes <= 0) break;
    }
  }

  const unmet = demands
    .filter((d) => d.remainingSlots > 0)
    .map((d) => ({
      examId: d.examId,
      subject: d.subject,
      examDate: d.examDate,
      remainingSlots: d.remainingSlots,
      remainingMinutes: d.remainingSlots * d.slotMinutes,
    }));

  if (unmet.length > 0) {
    notes.push(
      "Not all revision demand could be scheduled within the window/capacity."
    );
  }

  const totalPlanned = days.reduce((s, d) => s + d.usedMinutes, 0);
  const totalDemand = demands.reduce((s, d) => s + d.totalMinutes, 0);

  notes.push(`Planned ${totalPlanned} mins of revision across ${numDays} days.`);
  notes.push(`Total computed revision demand: ${totalDemand} mins.`);

  return { days, demands, unmet, notes };
}
