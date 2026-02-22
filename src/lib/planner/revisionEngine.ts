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
  const subject = (exam.subject ?? "Unknown").trim();
  const preparedness = Math.max(0, Math.min(100, exam.preparedness ?? 50));

  const requirements: SlotRequirement[] =
    exam.slot_requirements?.length
      ? exam.slot_requirements
      : FALLBACK_REQUIREMENTS[exam.exam_type];

  return requirements.map((req): RevisionDemand => {
    // Preparedness scales the number of standard sessions needed.
    // Practice papers are always done in full regardless of preparedness.
    let count = req.count;
    if (req.type === "standard") {
      const multiplier = Math.max(0.4, (100 - preparedness) / 50);
      count = Math.max(1, Math.round(req.count * multiplier));
    }

    const completedKey = `${exam.id}:${req.type}`;
    const alreadyDone = completionMap[completedKey] ?? 0;
    const remainingSlots = Math.max(0, count - alreadyDone);

    return {
      examId: exam.id,
      examDate,
      subject,
      examType: exam.exam_type,
      preparedness,
      slotType: req.type,
      slotMinutes: req.duration_minutes,
      remainingSlots,
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
    .sort((a, b) => daysBetween(startStr, a.examDate) - daysBetween(startStr, b.examDate));

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
  // Papers that already have fixed DB slots are skipped — we only place new ones.
  for (const demand of paperDemands) {
    if (demand.remainingSlots <= 0) continue;

    const existingDates = new Set(
      opts.existingFixedPaperDates?.[demand.examId] ?? []
    );

    let papersToPlace = demand.remainingSlots;

    // Candidate dates within the allowed window
    const candidates = windowDates.filter((date) => {
      if (existingDates.has(date)) return false; // already has a paper
      const gap = daysBetween(date, demand.examDate);
      return gap >= demand.minDaysBefore && gap <= demand.maxDaysBefore;
    });

    const engineOccupied = Object.fromEntries(days.map((d) => [d.date, d.usedMinutes]));

    // Score all candidates, sort best first
    const scored = candidates
      .map((date) => ({
        date,
        score: scoreDayForPracticePaper(
          date,
          demand.slotMinutes,
          opts.capacityByDate,          // already reduced (homework/rocks removed)
          opts.originalBaseCapMap,      // raw budget for busyness ratio
          engineOccupied,
          taskCountByDate
        ),
      }))
      .filter((c): c is { date: string; score: number } => c.score !== null)
      .sort((a, b) => b.score - a.score);

    // ── DIAGNOSTIC ───────────────────────────────────────────────────────────
    console.log(`📄 Paper demand: ${demand.subject}`, {
      slotMinutes: demand.slotMinutes,
      minDaysBefore: demand.minDaysBefore,
      maxDaysBefore: demand.maxDaysBefore,
      examDate: demand.examDate,
      candidateCount: candidates.length,
      scoredCount: scored.length,
      sampleCandidates: candidates.slice(0, 5).map(date => ({
        date,
        gap: daysBetween(date, demand.examDate),
        reducedCap: opts.capacityByDate[date] ?? 0,
        originalBase: opts.originalBaseCapMap[date] ?? 0,
        engineUsed: engineOccupied[date] ?? 0,
        free: (opts.capacityByDate[date] ?? 0) - (engineOccupied[date] ?? 0),
        passesFloor: ((opts.capacityByDate[date] ?? 0) - (engineOccupied[date] ?? 0)) >= demand.slotMinutes,
      })),
    });
    // ── END DIAGNOSTIC ───────────────────────────────────────────────────────

    for (const { date } of scored) {
      if (papersToPlace <= 0) break;

      const targetDay = days.find((d) => d.date === date)!;

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

      targetDay.usedMinutes += demand.slotMinutes;
      targetDay.remainingMinutes -= demand.slotMinutes;
      taskCountByDate[date] = (taskCountByDate[date] || 0) + 1;
      existingDates.add(date); // prevent double-placing on same date
      papersToPlace--;
    }

    // If we couldn't place all papers, record in unmet (handled at end)
    demand.remainingSlots = papersToPlace;
  }

  // ── PHASE 0: Final push — guaranteed standard slot day before exam ────────
  for (const demand of standardDemands) {
    if (demand.remainingSlots <= 0) continue;

    const dayBefore = addDays(demand.examDate, -1);
    const targetDay = days.find((d) => d.date === dayBefore);
    if (!targetDay) continue;

    const lockMinutes =
      demand.examType === "Internal" ? 30 : demand.slotMinutes;

    if (targetDay.remainingMinutes >= lockMinutes) {
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
      demand.remainingSlots = Math.max(0, demand.remainingSlots - 1);
    }
  }

  // ── PHASE A: Polite interleaving (2 passes, max 1–2 subjects per day) ─────
  for (let pass = 1; pass <= 2; pass++) {
    for (const day of days) {
      if (day.remainingMinutes <= 0) continue;

      for (const demand of standardDemands) {
        if (demand.remainingSlots <= 0) continue;

        const gap = daysBetween(day.date, demand.examDate);
        if (gap <= 0) continue; // never on or after exam day
        if (day.remainingMinutes < demand.slotMinutes) continue;

        const subjectCount = day.slots.filter(
          (s) => s.subject === demand.subject && s.slotType !== "practice_paper"
        ).length;
        const limit = demand.examType === "Internal" ? 1 : pass === 1 ? 1 : 2;

        if (subjectCount < limit) {
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
