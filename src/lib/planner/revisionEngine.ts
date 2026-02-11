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

  /* --- PHASE 0: THE FINAL PUSH (Day Before) --- */
  demands.forEach(d => {
    const dayBefore = addDays(d.examDate, -1);
    const targetDay = days.find(day => day.date === dayBefore);
    if (targetDay) {
      const lockMinutes = d.examType === "Internal" ? 30 : 60;
      
      // Respect capacity: Don't kill "Today" if it's already full of homework
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

  /* --- PHASE A: POLITE INTERLEAVING --- */
  // We do two passes to spread subjects out
  for (let pass = 1; pass <= 2; pass++) {
    for (const day of days) {
      if (day.remainingMinutes <= 0) continue;

      for (const d of demands) {
        if (d.remainingSlots <= 0) continue;
        const gap = daysBetween(day.date, d.examDate);
        if (gap <= 0) continue;
        
        // Don't overfill today in polite mode
        if (day.remainingMinutes < d.slotMinutes) continue;

        const subjectCount = day.slots.filter(s => s.subject === d.subject).length;
        
        // Internals: 1 per day. Boards/Competitive: 2 per day in pass 2.
        const limit = d.examType === "Internal" ? 1 : (pass === 1 ? 1 : 2);

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

  /* --- PHASE B: EMERGENCY OVERFLOW (Capacity Respecting) --- */
  // If we have slots left, we try to fit them in the 4 days before, but still respect 0 gap.
  demands.filter(d => d.remainingSlots > 0).forEach(d => {
    const emergencyWindow = days.filter(day => {
      const gap = daysBetween(day.date, d.examDate);
      return gap > 0 && gap <= 4; 
    });

    for (const day of emergencyWindow) {
      if (d.remainingSlots <= 0) break;
      if (day.remainingMinutes < d.slotMinutes) continue; // 🎯 THE FIX: Respect the bottom of the budget

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
  });

  /* --- PHASE C: THE "NO CHOICE" OVERLOAD (Strict Crisis Only) --- */
  // Only if we reach the day before and there is literally NO other time.
  demands.filter(d => d.remainingSlots > 0).forEach(d => {
    const dayBefore = addDays(d.examDate, -1);
    const targetDay = days.find(day => day.date === dayBefore);

    if (targetDay && d.remainingSlots > 0) {
      // Limit force-feeding to 1 extra slot so we don't have 10 slots on one day
      const forceMins = d.slotMinutes;
      targetDay.slots.push({
        date: targetDay.date,
        examId: d.examId,
        subject: d.subject,
        examType: d.examType,
        slotMinutes: forceMins,
        label: `CRISIS: ${getDynamicLabel(d, "")}`,
      });
      targetDay.usedMinutes += forceMins;
      targetDay.remainingMinutes -= forceMins;
      d.remainingSlots--;
    }
  });

  return { days, demands, unmet: demands.filter(d => d.remainingSlots > 0), notes: [] };
}