// ─────────────────────────────────────────────────────────────────────────────
// revisionEngine.ts
//
// Changes from original:
//   - Reads slot_requirements from ExamInput instead of using hardcoded
//     BASE_MINUTES_BY_TYPE / DEFAULT_PROFILE_BY_TYPE constants
//   - Splits demands into two queues: practice_papers and standard
//   - Practice papers placed first with a day-quality scoring function
//     (favours high-capacity, low-task-count days)
//   - Practice papers get isFixed = true so persistence never overwrites them
//   - Standard slot phases (0, A, B, C) unchanged in logic, adapted for types
//   - Date helpers re-exported from dateUtils (no circular dep with buildWeekPlan)
// ─────────────────────────────────────────────────────────────────────────────

import { toDateOnly, addDays, daysBetween, buildDateWindow } from "./dateUtils";
import type {
  ExamType,
  ExamInput,
  SlotType,
  SlotRequirement,
  RevisionDemand,
  PlannedRevisionSlot,
  DailyRevisionPlan,
  RevisionPlanResult,
} from "./types";

// Re-export date utils so callers that previously imported from here still work
export { toDateOnly, addDays, daysBetween, buildDateWindow };

// ─── Fallback defaults (used when exam has no slot_requirements) ──────────────

const FALLBACK_REQUIREMENTS: Record<ExamType, SlotRequirement[]> = {
  Internal:    [{ type: "standard",       duration_minutes: 30,  count: 4                                    }],
  Board:       [{ type: "standard",       duration_minutes: 45,  count: 8                                    },
                { type: "practice_paper", duration_minutes: 120, count: 2, min_days_before: 5,  max_days_before: 30 }],
  Competitive: [{ type: "standard",       duration_minutes: 60,  count: 10                                   },
                { type: "practice_paper", duration_minutes: 180, count: 3, min_days_before: 7,  max_days_before: 45 }],
};

// ─── Display label helpers ────────────────────────────────────────────────────

function getDynamicLabel(d: RevisionDemand, prefix = ""): string {
  let base: string;
  if (d.examType === "Competitive" && d.competitive_exam_name)
    base = d.competitive_exam_name;
  else if (d.examType === "Board" && d.exam_board)
    base = `${d.subject} (${d.exam_board})`;
  else
    base = d.subject;

  const typeTag =
    d.slotType === "practice_paper" ? " · Practice Paper"
    : d.slotType === "mind_map"     ? " · Mind Map"
    : d.slotType === "flashcards"   ? " · Flashcards"
    : "";

  return `${prefix}${base}${typeTag}`.trim();
}

// ─── Build demands from a single exam ────────────────────────────────────────

/**
 * Returns one RevisionDemand per slot_requirement entry.
 * completionMap counts how many slots of each type have already been completed:
 *   { [`${examId}:standard`]: 3, [`${examId}:practice_paper`]: 1 }
 */


export function buildRevisionDemands(
  exam: ExamInput,
  completionMap: Record<string, number> = {}
): RevisionDemand[] {
  const examDate = toDateOnly(exam.date);
  // 🛡️ Fix TS Error: Provide a fallback string if subject is null
  const subjectName = (exam.subject ?? "Unknown Subject").trim();

  const requirements: SlotRequirement[] =
    exam.slot_requirements && Array.isArray(exam.slot_requirements) && exam.slot_requirements.length > 0
      ? exam.slot_requirements
      : FALLBACK_REQUIREMENTS[exam.exam_type] || FALLBACK_REQUIREMENTS.Internal;

  return requirements.map((req): RevisionDemand => {
    // 🎯 Use the count directly from the requirement
    const totalCount = Number(req.count) || 0;

    const completedKey = `${exam.id}:${req.type}`;
    const alreadyDone = completionMap[completedKey] ?? 0;
    const remaining = Math.max(0, totalCount - alreadyDone);

    // 🔍 The "Console Truth" - Keep this to verify the math
    if (subjectName.includes("Computer")) {
      console.log(`🧬 [${subjectName}] MATH:`, {
        requested: totalCount,
        done: alreadyDone,
        remaining: remaining
      });
    }

    return {
      examId: exam.id,
      examDate,
      subject: subjectName, // 🛡️ Now guaranteed to be a string
      examType: exam.exam_type,
      preparedness: exam.preparedness ?? 50,
      slotType: req.type,
      slotMinutes: req.duration_minutes,
      remainingSlots: remaining, 
      minDaysBefore: req.min_days_before ?? defaultMinDays(exam.exam_type, req.type),
      maxDaysBefore: req.max_days_before ?? defaultMaxDays(exam.exam_type, req.type),
      competitive_exam_name: exam.competitive_exam_name,
      exam_board: exam.exam_board,
    };
  });
}

function defaultMinDays(examType: ExamType, slotType: SlotType): number {
  if (slotType !== "practice_paper") return 1;
  return examType === "Internal" ? 3 : examType === "Board" ? 5 : 7;
}

function defaultMaxDays(examType: ExamType, slotType: SlotType): number {
  if (slotType !== "practice_paper") return 999;
  return examType === "Internal" ? 14 : examType === "Board" ? 30 : 45;
}

// ─── Day quality score for practice paper placement ──────────────────────────

/**
 * Returns a 0–100 quality score for placing a practice paper on a given day,
 * or null if the day cannot physically fit the paper.
 *
 * IMPORTANT: `reducedCapMap` is the capacity AFTER homework/rocks have already
 * been subtracted (engineCapacityMap). Do NOT add an extra homework buffer here
 * since that load is already accounted for.
 *
 * `originalBaseCapMap` is the raw daily budget before any subtraction, used
 * only to compute a meaningful busyness ratio (otherwise free/base = 1 always).
 *
 * Scoring:
 *   60 pts — free minutes available (normalised to 240m ceiling)
 *   20 pts — focus score (penalises days with many existing tasks)
 *   20 pts — busyness ratio (free / original base capacity)
 */
function scoreDayForPracticePaper(
  date: string,
  requiredMinutes: number,
  reducedCapMap: Record<string, number>,
  originalBaseCapMap: Record<string, number>,
  engineOccupiedCap: Record<string, number>,
  taskCountByDate: Record<string, number>
): number | null {
  const free = (reducedCapMap[date] ?? 0) - (engineOccupiedCap[date] ?? 0);
  const originalBase = originalBaseCapMap[date] ?? 0;

  // Hard floor: the remaining free time must fit the paper.
  // No extra buffer needed — homework is already removed from reducedCapMap.
  if (free < requiredMinutes) return null;

  // Require at least a minimal day (not a holiday/zero-cap day)
  if (originalBase === 0) return null;

  const taskCount = taskCountByDate[date] ?? 0;
  const capacityScore  = Math.min(free / 240, 1) * 60;
  const focusScore     = Math.max(0, 20 - taskCount * 5);
  const busynessScore  = (free / originalBase) * 20;  // now meaningful

  return capacityScore + focusScore + busynessScore;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function planRevisionSlots(
  exams: ExamInput[],
  opts: {
    startDate: string;
    numDays: number;
    // Capacity already reduced by homework/rocks — what the revision engine
    // actually has to work with per day
    capacityByDate: Record<string, number>;
    // Original daily budget before any subtraction — used for busyness scoring
    originalBaseCapMap: Record<string, number>;
    includeExamDay: boolean;
    // Keyed as `${examId}:${slotType}` → count of completed slots
    completionMap?: Record<string, number>;
    // IDs of practice_paper slots that are already fixed in DB — skip re-placing
    existingFixedPaperDates?: Record<string, string[]>; // examId → dates already used
  }
): RevisionPlanResult {
  
  const startStr = toDateOnly(opts.startDate);
  const windowDates = buildDateWindow(startStr, opts.numDays);

  // Build all demands, split by type
  const allDemands = exams.flatMap((exam) =>
    buildRevisionDemands(exam, opts.completionMap ?? {})
  ).filter((d) => daysBetween(startStr, d.examDate) > 0);

  const paperDemands  = allDemands.filter((d) => d.slotType === "practice_paper");
  const standardDemands = allDemands
  .filter((d) => d.slotType !== "practice_paper")
  .sort((a, b) => {
    // 1. Prioritize shorter slots (30m) so they don't get blocked by 120m slots
    if (a.slotMinutes !== b.slotMinutes) return a.slotMinutes - b.slotMinutes;
    // 2. Then sort by proximity to exam
    return daysBetween(startStr, a.examDate) - daysBetween(startStr, b.examDate);
  });
    // ── 🧪 NUCLEAR DEBUG LOG ──────────────────────────────────────────────────
  const tuesdayKey = "2026-03-03"; 
  console.log("🧪 TUESDAY ENGINE VIEW:", {
    exists: !!opts.capacityByDate[tuesdayKey],
    capacity: opts.capacityByDate[tuesdayKey],
    isStandardDemandsEmpty: standardDemands.length === 0,
    csDemand: standardDemands.find(d => d.subject.includes("Computer")),
  });

  // Build daily plan objects
  const days: DailyRevisionPlan[] = windowDates.map((date) => ({
    date,
    capacityMinutes: opts.capacityByDate[date] ?? 0,
    usedMinutes: 0,
    remainingMinutes: opts.capacityByDate[date] ?? 0,
    slots: [],
  }));

  // Running task count per date (for practice paper scoring)
  const taskCountByDate: Record<string, number> = {};
  windowDates.forEach((d) => (taskCountByDate[d] = 0));

  // ── PHASE PP: Practice Papers (placed first, scored, marked isFixed) ────────
  for (const demand of paperDemands) {
    if (demand.remainingSlots <= 0) continue;

    const existingDates = new Set(
      opts.existingFixedPaperDates?.[demand.examId] ?? []
    );

    let papersToPlace = demand.remainingSlots;

    const candidates = windowDates.filter((date) => {
      if (existingDates.has(date)) return false;
      const gap = daysBetween(date, demand.examDate);
      return gap >= demand.minDaysBefore && gap <= demand.maxDaysBefore;
    });

    const engineOccupied = Object.fromEntries(days.map((d) => [d.date, d.usedMinutes]));

    const scored = candidates
      .map((date) => ({
        date,
        score: scoreDayForPracticePaper(
          date,
          demand.slotMinutes,
          opts.capacityByDate,
          opts.originalBaseCapMap,
          engineOccupied,
          taskCountByDate
        ),
      }))
      .filter((c): c is { date: string; score: number } => c.score !== null)
      .sort((a, b) => b.score - a.score);

    for (const { date } of scored) {
      if (papersToPlace <= 0) break;

      // 🎯 1. Proximity Check
      const minGap = 4; 
      const isTooClose = Array.from(existingDates).some(existingDate => {
        return Math.abs(daysBetween(date, existingDate)) < minGap;
      });

      if (isTooClose && scored.length > papersToPlace + 2) {
        continue; 
      }

      const targetDay = days.find((d) => d.date === date)!;

      // 🎯 2. Formal Placement
      targetDay.slots.push({
        date,
        examId: demand.examId,
        subject: demand.subject,
        examType: demand.examType,
        slotType: "practice_paper",
        slotMinutes: demand.slotMinutes,
        label: getDynamicLabel(demand, ""),
        isFixed: true,
      });

      // 🎯 3. Critical: Update the counters so the NEXT paper knows this day is now full
      targetDay.usedMinutes += demand.slotMinutes;
      targetDay.remainingMinutes -= demand.slotMinutes;
      taskCountByDate[date] = (taskCountByDate[date] || 0) + 1;
      
      existingDates.add(date); 
      papersToPlace--;
    }

    demand.remainingSlots = papersToPlace;
  }

    // ── PHASE 0: Guaranteed FINAL standard slot day before exam ────────
    for (const demand of standardDemands) {
      if (demand.remainingSlots <= 0) continue;

      const dayBefore = addDays(demand.examDate, -1);
      const targetDay = days.find((d) => d.date === dayBefore);
      if (!targetDay) continue;

      // 🎯 THE FIX: Ensure Competitive exams are included in the Final Push
      const isHighStakes = demand.examType === "Board" || demand.examType === "Competitive";
      
      // Competitive exams should keep their full slot duration (e.g. 60m)
      const lockMinutes = (demand.examType === "Internal") ? 30 : demand.slotMinutes;

      const alreadyHasSlot = targetDay.slots.some(s => s.examId === demand.examId);
      if (alreadyHasSlot) continue;

      // Use a slight "Overload" for the day before a Competitive exam
      const dayBeforeBuffer = isHighStakes ? 15 : 0;

      if (targetDay.remainingMinutes + dayBeforeBuffer >= lockMinutes) {
        targetDay.slots.unshift({
          date: dayBefore,
          examId: demand.examId,
          subject: demand.subject,
          examType: demand.examType,
          slotType: demand.slotType,
          slotMinutes: lockMinutes,
          label: getDynamicLabel(demand, "FINAL: "),
          isFixed: false,
        });
        targetDay.usedMinutes += lockMinutes;
        targetDay.remainingMinutes -= lockMinutes;
        taskCountByDate[dayBefore] = (taskCountByDate[dayBefore] || 0) + 1;
        demand.remainingSlots--;
      }
    }

  // ── PHASE A: Standard Slot Placement (With Spacing) ────────
  // We use multiple passes to spread tasks across the window
  for (let pass = 1; pass <= 4; pass++) {
    for (const day of days) {
      // Don't even try if the day is effectively full
      if (day.remainingMinutes < 15) continue; 

      for (const demand of standardDemands) {
        if (demand.remainingSlots <= 0) continue;

        const gap = daysBetween(day.date, demand.examDate);
        // Only place in the future relative to the day, and before the exam
        if (gap <= 0) continue; 

        // 🎯 THE SPACING RULE:
        // Only allow a slot if this specific exam isn't already on this day.
        // This prevents the "75m merge" by forcing the second 45m slot 
        // to find a different day in the loop.
        const alreadyHasSlot = day.slots.some(s => s.examId === demand.examId);
        
        if (!alreadyHasSlot && day.remainingMinutes >= demand.slotMinutes) {
          day.slots.push({
            date: day.date,
            examId: demand.examId,
            subject: demand.subject,
            examType: demand.examType,
            slotType: demand.slotType,
            slotMinutes: demand.slotMinutes,
            label: getDynamicLabel(demand),
            isFixed: false,
          });

          day.usedMinutes += demand.slotMinutes;
          day.remainingMinutes -= demand.slotMinutes;
          taskCountByDate[day.date] = (taskCountByDate[day.date] || 0) + 1;
          demand.remainingSlots--;
        }
      }
    }
  }

  // ── PHASE B: Emergency overflow — last 4 days before exam ─────────────────
  for (const demand of standardDemands.filter((d) => d.remainingSlots > 0)) {
    const emergencyWindow = days.filter((day) => {
      const gap = daysBetween(day.date, demand.examDate);
      return gap > 0 && gap <= 4;
    });

    for (const day of emergencyWindow) {
      if (demand.remainingSlots <= 0) break;
      if (day.remainingMinutes < demand.slotMinutes) continue;

      day.slots.push({
        date: day.date,
        examId: demand.examId,
        subject: demand.subject,
        examType: demand.examType,
        slotType: demand.slotType,
        slotMinutes: demand.slotMinutes,
        label: getDynamicLabel(demand),
        isFixed: false,
      });
      day.usedMinutes += demand.slotMinutes;
      day.remainingMinutes -= demand.slotMinutes;
      taskCountByDate[day.date] = (taskCountByDate[day.date] || 0) + 1;
      demand.remainingSlots--;
    }
  }

  // ── PHASE C: Crisis overload — force onto day-before if still unmet ───────
  for (const demand of standardDemands.filter((d) => d.remainingSlots > 0)) {
    const dayBefore = addDays(demand.examDate, -1);
    const targetDay = days.find((d) => d.date === dayBefore);

    if (targetDay && targetDay.remainingMinutes > -30) {
      targetDay.slots.push({
        date: dayBefore,
        examId: demand.examId,
        subject: demand.subject,
        examType: demand.examType,
        slotType: demand.slotType,
        slotMinutes: demand.slotMinutes,
        label: getDynamicLabel(demand, "CRISIS: "),
        isFixed: false,
      });
      targetDay.usedMinutes += demand.slotMinutes;
      targetDay.remainingMinutes -= demand.slotMinutes;
      taskCountByDate[dayBefore] = (taskCountByDate[dayBefore] || 0) + 1;
      demand.remainingSlots--;
    }
  }

  const unmet = [...paperDemands, ...standardDemands].filter(
    (d) => d.remainingSlots > 0
  );

  return { days, demands: allDemands, unmet, notes: [] };
}
