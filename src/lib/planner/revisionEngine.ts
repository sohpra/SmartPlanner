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
  Internal: { slotMinutes: 30, maxSlotsPerDay: 1 }, // Cap internals at 1 per day
  Board: { slotMinutes: 45, maxSlotsPerDay: 2 },   // Cap boards at 2 per day
  Competitive: { slotMinutes: 60, maxSlotsPerDay: 2 }, // Cap competitive at 2 per day
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

const getDynamicLabel = (d: RevisionDemand, suffix: string) => {
  if (d.examType === "Competitive" && d.competitive_exam_name) return d.competitive_exam_name;
  if (d.examType === "Board" && d.exam_board) return `${d.subject} (${d.exam_board})`;
  return `${d.subject}${suffix ? ' ' + suffix : ''}`;
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
  const windowDates = Array.from({ length: opts.numDays }, (_, i) => addDays(opts.startDate, i));

  const demands = exams
    .map(buildRevisionDemand)
    .filter((d): d is RevisionDemand => d !== null && daysBetween(opts.startDate, d.examDate) >= 0)
    .sort((a, b) => daysBetween(opts.startDate, a.examDate) - daysBetween(opts.startDate, b.examDate));

  const days: DailyRevisionPlan[] = windowDates.map(date => ({
    date,
    capacityMinutes: opts.capacityByDate[date] ?? 0,
    usedMinutes: 0,
    remainingMinutes: opts.capacityByDate[date] ?? 0,
    slots: [],
  }));

  /* --- PHASE 0: ANCHORS (Strictly Capped) --- */
  demands.forEach(d => {
    const dayBefore = addDays(d.examDate, -1);
    const targetDay = days.find(day => day.date === dayBefore);
    if (targetDay) {
      const lockMinutes = d.examType === "Internal" ? 30 : 60;
      
      // 🎯 THE FIX: Even "Golden" slots MUST respect the gap.
      // If Today is the day before an exam and gap is 0, this will skip.
      if (targetDay.remainingMinutes >= lockMinutes) {
        targetDay.slots.unshift({
          date: targetDay.date,
          examId: d.examId,
          subject: d.subject,
          examType: d.examType,
          slotMinutes: lockMinutes,
          label: `FINAL: ${getDynamicLabel(d, "")}`,
        });
        targetDay.usedMinutes += lockMinutes;
        targetDay.remainingMinutes -= lockMinutes;
        d.remainingSlots = Math.max(0, d.remainingSlots - 1);
      }
    }
  });

/* --- PHASE A: PROTECT TODAY & INTERLEAVE --- */
/* --- PHASE A: INTERLEAVING (The "Polite" Phase) --- */
for (let pass = 1; pass <= 2; pass++) {
  for (const day of days) {
    if (day.remainingMinutes <= 0) continue;

    for (const d of demands) {
      if (d.remainingSlots <= 0) continue;
      if (daysBetween(day.date, d.examDate) <= 0) continue;
      
      if (day.remainingMinutes < d.slotMinutes) continue;

      const subjectCount = day.slots.filter(s => s.subject === d.subject).length;
      
      // 🎯 REVERTED: Internal exams stay at 1 slot/day to prevent crowding.
      // Competitive/Board exams can still take 2 slots if space permits.
      const limit = pass === 1 ? 1 : (d.examType === "Internal" ? 1 : 2);

      if (subjectCount < limit) {
        day.slots.push({
          date: day.date,
          examId: d.examId,
          subject: d.subject,
          examType: d.examType,
          slotMinutes: d.slotMinutes,
          label: getDynamicLabel(d, ""),
        });
        day.usedMinutes += d.slotMinutes;
        day.remainingMinutes -= d.slotMinutes;
        d.remainingSlots--;
      }
    }
  }
}

/* --- PHASE B: EMERGENCY OVERFLOW (The "Last Resort" Phase) --- */
demands.filter(d => d.remainingSlots > 0).forEach(d => {
  // 🎯 REFINED: Only "Emergency Overload" the 2 days before the exam.
  // This prevents the engine from overloading you too early in the week.
  const emergencyWindow = days.filter(day => {
    const gap = daysBetween(day.date, d.examDate);
    return gap > 0 && gap <= 2; 
  });

  for (const day of emergencyWindow) {
    if (d.remainingSlots <= 0) break;

    day.slots.push({
      date: day.date,
      examId: d.examId,
      subject: d.subject,
      examType: d.examType,
      slotMinutes: d.slotMinutes,
      label: `URGENT: ${getDynamicLabel(d, "")}`,
    });
    
    day.usedMinutes += d.slotMinutes;
    day.remainingMinutes -= d.slotMinutes;
    d.remainingSlots--;
  }
});

/* --- PHASE B: EMERGENCY OVERLOAD (The "No Choice" Phase) --- */
// If we STILL have slots left, we force them in, even if it exceeds 150m.
demands.filter(d => d.remainingSlots > 0).forEach(d => {
  // We only look at the 4 days leading up to the exam for an overload.
  const emergencyWindow = days.filter(day => {
    const gap = daysBetween(day.date, d.examDate);
    return gap > 0 && gap <= 4;
  });

  for (const day of emergencyWindow) {
    if (d.remainingSlots <= 0) break;

    // We add the slot even if remainingMinutes is 0 or negative.
    day.slots.push({
      date: day.date,
      examId: d.examId,
      subject: d.subject,
      examType: d.examType,
      slotMinutes: d.slotMinutes,
      label: `URGENT: ${getDynamicLabel(d, "")}`,
    });
    
    day.usedMinutes += d.slotMinutes;
    day.remainingMinutes -= d.slotMinutes; // This will go negative, showing the overload in UI
    d.remainingSlots--;
  }
});
  return { days, demands, unmet: demands.filter(d => d.remainingSlots > 0), notes: [] };
}