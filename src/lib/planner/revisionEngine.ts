export type ExamType = "Internal" | "Board" | "Competitive";

export type ExamInput = {
  id: string;
  subject: string | null;
  exam_type: ExamType;
  date: string;
  preparedness: number | null;
  competitive_exam_name?: string | null;
  exam_board?: string | null;
};

export type RevisionProfile = {
  slotMinutes: number;
  maxSlotsPerDay: number;
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
  remainingSlots: number;
  competitive_exam_name?: string | null;
  exam_board?: string | null;
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
  unmet: any[];
  notes: string[];
};

const BASE_MINUTES_BY_TYPE: Record<ExamType, number> = {
  Internal: 120,
  Board: 480,
  Competitive: 600,
};

const DEFAULT_PROFILE_BY_TYPE: Record<ExamType, RevisionProfile> = {
  Internal: { slotMinutes: 30, maxSlotsPerDay: 2 },
  Board: { slotMinutes: 45, maxSlotsPerDay: 3 },
  Competitive: { slotMinutes: 60, maxSlotsPerDay: 3 },
};

/* --- Helpers --- */
export function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export function addDays(dateYYYYMMDD: string, days: number): string {
  const cleanDate = dateYYYYMMDD.split('T')[0];
  const d = new Date(cleanDate + "T00:00:00");
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

const getDynamicLabel = (d: RevisionDemand, suffix: string) => {
  if (d.examType === "Competitive" && d.competitive_exam_name) return d.competitive_exam_name;
  if (d.examType === "Board" && d.exam_board) return `${d.subject} (${d.exam_board})`;
  return `${d.subject} ${suffix}`;
};


export function buildRevisionDemand(exam: ExamInput): RevisionDemand | null {
  const examDate = toDateOnly(exam.date);
  const subject = (exam.subject ?? "Unknown").trim();
  const preparedness = Math.max(0, Math.min(100, exam.preparedness ?? 50));
  
  const base = BASE_MINUTES_BY_TYPE[exam.exam_type];
  const multiplier = Math.max(0.4, (100 - preparedness) / 50);
  const totalMinutes = Math.round(base * multiplier);

  const profile = DEFAULT_PROFILE_BY_TYPE[exam.exam_type];
  return {
    examId: exam.id,
    examDate,
    subject,
    examType: exam.exam_type,
    preparedness,
    profile,
    totalMinutes,
    slotMinutes: profile.slotMinutes,
    remainingSlots: Math.ceil(totalMinutes / profile.slotMinutes),
    competitive_exam_name: exam.competitive_exam_name,
    exam_board: exam.exam_board
  };
}

/* --- Main Engine --- */
export function planRevisionSlots(
  exams: ExamInput[],
  opts: { startDate: string; numDays: number; capacityByDate: Record<string, number>; includeExamDay: boolean }
): RevisionPlanResult {
  const notes: string[] = [];
  const windowDates = Array.from({ length: opts.numDays }, (_, i) => addDays(opts.startDate, i));

  const demands = exams
    .map(buildRevisionDemand)
    .filter((d): d is RevisionDemand => d !== null && daysBetween(opts.startDate, d.examDate) >= 0);

  // 🎯 Use ONE consistent array for the whole process
  const days: DailyRevisionPlan[] = windowDates.map(date => ({
    date,
    capacityMinutes: opts.capacityByDate[date] ?? 0,
    usedMinutes: 0,
    remainingMinutes: opts.capacityByDate[date] ?? 0,
    slots: [],
  }));

  /* PHASE 0: GOLDEN SLOTS (Pre-Exam Lock) */
  demands.forEach(d => {
    const dayBefore = addDays(d.examDate, -1);
    const targetDay = days.find(day => day.date === dayBefore);
    if (targetDay) {
      const lockMinutes = d.examType === "Internal" ? 60 : 120;
      targetDay.slots.push({
        date: targetDay.date,
        examId: d.examId,
        subject: d.subject,
        examType: d.examType,
        slotMinutes: lockMinutes,
        label: `FINAL: ${getDynamicLabel(d, "")}`,
      });
      targetDay.usedMinutes += lockMinutes;
      targetDay.remainingMinutes -= lockMinutes;
      d.remainingSlots = Math.max(0, d.remainingSlots - Math.ceil(lockMinutes / d.slotMinutes));
    }
  });

  /* PHASE A: NORMAL CAPACITY FILL */
  let placed = true;
  while (placed) {
    placed = false;
    for (const day of days) {
      if (day.remainingMinutes <= 0) continue;

      const eligibleDemands = demands.filter(d => 
        d.remainingSlots > 0 && 
        daysBetween(day.date, d.examDate) > 0 && // 🎯 STRICTLY before exam
        day.remainingMinutes >= d.slotMinutes
      ).sort((a, b) => {
        const da = daysBetween(day.date, a.examDate);
        const db = daysBetween(day.date, b.examDate);
        if (da !== db) return da - db;
        return typePriority(b.examType) - typePriority(a.examType);
      });

      if (eligibleDemands.length > 0) {
        const d = eligibleDemands[0];
        day.slots.push({
          date: day.date,
          examId: d.examId,
          subject: d.subject,
          examType: d.examType,
          slotMinutes: d.slotMinutes,
          label: getDynamicLabel(d, "Revision"),
        });
        d.remainingSlots--;
        day.usedMinutes += d.slotMinutes;
        day.remainingMinutes -= d.slotMinutes;
        placed = true;
      }
    }
  }

  /* PHASE B: OVERLOAD (Cramming) */
  demands.filter(d => d.remainingSlots > 0).forEach(d => {
    while (d.remainingSlots > 0) {
      // 🎯 Find the last possible day that is BEFORE the exam
      const targetDay = [...days]
        .reverse()
        .find(day => daysBetween(day.date, d.examDate) > 0);

      if (!targetDay) break; 

      targetDay.slots.push({
        date: targetDay.date,
        examId: d.examId,
        subject: d.subject,
        examType: d.examType,
        slotMinutes: d.slotMinutes,
        label: getDynamicLabel(d, "Extra Prep"),
      });
      d.remainingSlots--;
      targetDay.usedMinutes += d.slotMinutes;
      targetDay.remainingMinutes -= d.slotMinutes; 
    }
  });

  return { days, demands, unmet: [], notes };
}