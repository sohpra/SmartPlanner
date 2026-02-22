"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";
import { X, Sparkles, PencilLine, Loader2, ChevronDown, Plus, Trash2, FileText, BookOpen } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotType = "standard" | "practice_paper" | "mind_map" | "flashcards";

type SlotRequirement = {
  id: string; // local key only, not persisted
  type: SlotType;
  duration_minutes: number;
  count: number;
  min_days_before?: number;
  max_days_before?: number;
};

// ─── Defaults per exam type ───────────────────────────────────────────────────

const DEFAULT_REQUIREMENTS: Record<string, Omit<SlotRequirement, 'id'>[]> = {
  internal: [
    { type: "standard", duration_minutes: 30, count: 4 },
  ],
  board: [
    { type: "standard",       duration_minutes: 45,  count: 8                                    },
    { type: "practice_paper", duration_minutes: 120, count: 2, min_days_before: 5, max_days_before: 30 },
  ],
  competitive: [
    { type: "standard",       duration_minutes: 60,  count: 10                                   },
    { type: "practice_paper", duration_minutes: 180, count: 3, min_days_before: 7, max_days_before: 45 },
  ],
};

const DEFAULT_BASE_COUNTS: Record<string, number> = {
  internal:    4,
  board:       8,
  competitive: 10,
};

/**
 * Mirrors the multiplier logic in revisionEngine.buildRevisionDemands.
 * preparedness 0   → multiplier 2.0 → 200% of base count
 * preparedness 50  → multiplier 1.0 → 100% of base count
 * preparedness 100 → multiplier 0.4 → 40%  of base count (floor)
 */
function computeSuggestedCount(baseCount: number, preparedness: number): number {
  const multiplier = Math.max(0.4, (100 - preparedness) / 50);
  return Math.max(1, Math.round(baseCount * multiplier));
}

const SLOT_TYPE_META: Record<SlotType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  standard:       { label: "Standard Session",  icon: <BookOpen className="w-3.5 h-3.5" />,  color: "blue",   description: "Regular review session"       },
  practice_paper: { label: "Practice Paper",    icon: <FileText className="w-3.5 h-3.5" />,  color: "amber",  description: "Full timed paper under exam conditions" },
  mind_map:       { label: "Mind Map",          icon: <Sparkles className="w-3.5 h-3.5" />,  color: "purple", description: "Visual summary & connections"  },
  flashcards:     { label: "Flashcards",        icon: <BookOpen className="w-3.5 h-3.5" />,  color: "emerald",description: "Active recall practice"         },
};

const COLOR_CLASSES: Record<string, { badge: string; border: string; icon: string }> = {
  blue:    { badge: "bg-blue-50 text-blue-700 border-blue-100",    border: "border-blue-200",    icon: "bg-blue-100 text-blue-600"    },
  amber:   { badge: "bg-amber-50 text-amber-700 border-amber-100", border: "border-amber-200",   icon: "bg-amber-100 text-amber-600"  },
  purple:  { badge: "bg-purple-50 text-purple-700 border-purple-100", border: "border-purple-200", icon: "bg-purple-100 text-purple-600" },
  emerald: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", border: "border-emerald-200", icon: "bg-emerald-100 text-emerald-600" },
};

// ─── Sub-component: Single slot requirement row ───────────────────────────────

function SlotRequirementRow({
  req,
  onChange,
  onRemove,
  showWindowFields,
}: {
  req: SlotRequirement;
  onChange: (updated: SlotRequirement) => void;
  onRemove: () => void;
  showWindowFields: boolean;
}) {
  const meta = SLOT_TYPE_META[req.type];
  const colors = COLOR_CLASSES[meta.color];

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white p-4 space-y-3`}>
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded-lg ${colors.icon}`}>{meta.icon}</span>
          <select
            value={req.type}
            onChange={e => onChange({ ...req, type: e.target.value as SlotType, id: req.id })}
            className="text-xs font-black uppercase tracking-wider bg-transparent border-none focus:ring-0 cursor-pointer text-slate-700"
          >
            {(Object.keys(SLOT_TYPE_META) as SlotType[]).map(t => (
              <option key={t} value={t}>{SLOT_TYPE_META[t].label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Duration (min)</label>
          <input
            type="number"
            min={15}
            max={360}
            step={15}
            value={req.duration_minutes}
            onChange={e => onChange({ ...req, duration_minutes: Number(e.target.value) })}
            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold border-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sessions</label>
          <input
            type="number"
            min={1}
            max={20}
            value={req.count}
            onChange={e => onChange({ ...req, count: Number(e.target.value) })}
            className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold border-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Window fields — only for practice_paper (and if parent says to show) */}
      {showWindowFields && req.type === "practice_paper" && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Min days before</label>
            <input
              type="number"
              min={1}
              max={60}
              value={req.min_days_before ?? 5}
              onChange={e => onChange({ ...req, min_days_before: Number(e.target.value) })}
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold border-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Max days before</label>
            <input
              type="number"
              min={1}
              max={90}
              value={req.max_days_before ?? 30}
              onChange={e => onChange({ ...req, max_days_before: Number(e.target.value) })}
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-bold border-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <p className="col-span-2 text-[9px] text-gray-400 font-medium -mt-1">
            Paper will be placed on a high-availability day within this window.
          </p>
        </div>
      )}

      {/* Summary pill */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${colors.badge}`}>
        {meta.icon}
        {req.count}× {req.duration_minutes}m
        {req.type === "practice_paper" && ` · ${req.min_days_before ?? 5}–${req.max_days_before ?? 30}d before`}
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function ExamModal({ open, onClose, onAdded }: any) {
  const [examType, setExamType]       = useState("internal");
  const [subject, setSubject]         = useState("");
  const [date, setDate]               = useState("");
  const [preparedness, setPreparedness] = useState(50);
  const [isSyncing, setIsSyncing]     = useState(false);

  const [examBoard, setExamBoard]     = useState("");
  const [examName, setExamName]       = useState("");
  const [topicInput, setTopicInput]   = useState("");

  // Revision plan state
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [requirements, setRequirements] = useState<SlotRequirement[]>([]);

  const { subjects } = useSubjects();

  // Reset on open
  useEffect(() => {
    if (open) {
      setExamType("internal");
      setSubject("");
      setDate("");
      setPreparedness(50);
      setExamBoard("");
      setExamName("");
      setTopicInput("");
      setIsSyncing(false);
      setRevisionOpen(false);
      setRequirements(DEFAULT_REQUIREMENTS["internal"].map((r: any) => ({ ...r, id: crypto.randomUUID() })));
    }
  }, [open]);

  // When preparedness changes, live-update standard session counts to match engine logic
  useEffect(() => {
    const base = DEFAULT_BASE_COUNTS[examType] ?? 4;
    setRequirements(prev => prev.map(r =>
      r.type === "standard"
        ? { ...r, count: computeSuggestedCount(base, preparedness) }
        : r
    ));
  }, [preparedness, examType]);

  // When exam type changes, reset requirements to sensible defaults
  // (preparedness effect above will then scale the count immediately after)
  useEffect(() => {
    setRequirements(DEFAULT_REQUIREMENTS[examType]?.map((r: any) => ({ ...r, id: crypto.randomUUID() })) ?? []);
    if (examType !== "internal") setRevisionOpen(true);
  }, [examType]);

  function addRequirement() {
    setRequirements(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "standard",
      duration_minutes: 45,
      count: 2,
    }]);
  }

  function updateRequirement(id: string, updated: SlotRequirement) {
    setRequirements(prev => prev.map(r => r.id === id ? updated : r));
  }

  function removeRequirement(id: string) {
    setRequirements(prev => prev.filter(r => r.id !== id));
  }

  // Summary stats for the revision plan header
  const totalSessions = requirements.reduce((s, r) => s + r.count, 0);
  const totalMinutes  = requirements.reduce((s, r) => s + r.count * r.duration_minutes, 0);
  const hasPapers     = requirements.some(r => r.type === "practice_paper");

  async function handleSubmit() {
    if (!subject || !date) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("User session not found. Please log in again."); return; }

    setIsSyncing(true);

    const formattedType = examType.charAt(0).toUpperCase() + examType.slice(1);

    // Strip local-only `id` field before persisting
    const slotRequirementsPayload = requirements.map(({ id: _id, ...rest }) => rest);

    const payload: any = {
      user_id: user.id,
      subject,
      exam_type: formattedType,
      date: new Date(date).toISOString(),
      preparedness,
      topics: examType === "internal" ? topicInput : null,
      exam_board: examType === "board" ? examBoard : null,
      competitive_exam_name: examType === "competitive" ? examName : null,
      color: "#3b82f6",
      slot_requirements: slotRequirementsPayload, // 👈 new JSONB column
    };

    try {
      const { data: newExam, error: examError } = await supabase
        .from("exams")
        .insert([payload])
        .select()
        .single();

      if (examError) throw examError;

      // Do NOT call syncRevisionSlots here — onAdded() is responsible for sync.
      // Calling it twice causes the second run to delete what the first just wrote.
      onAdded?.();
      onClose();
    } catch (error: any) {
      console.error("Submission Error:", error);
      alert(`Failed to save briefing: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
        <div className="p-6 md:p-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between sticky top-0 bg-white py-2 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 md:p-2.5 rounded-xl rotate-3">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-black italic tracking-tighter text-slate-900">New Briefing</h2>
            </div>
            <button onClick={onClose} disabled={isSyncing} className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Exam type + Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Category</label>
              <select
                disabled={isSyncing}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                value={examType}
                onChange={e => setExamType(e.target.value)}
              >
                <option value="internal">Internal</option>
                <option value="board">Board Exam</option>
                <option value="competitive">Competitive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Subject</label>
              <select
                disabled={isSyncing}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              >
                <option value="">Select...</option>
                {subjects.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dynamic detail field */}
          <div className="space-y-1.5 animate-in slide-in-from-left duration-300">
            <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">
              {examType === "internal" ? "Key Topics" : examType === "board" ? "Exam Board" : "Exam Name"}
            </label>
            <div className="relative">
              <input
                disabled={isSyncing}
                type="text"
                placeholder={examType === "competitive" ? "e.g. Maths Olympiad" : "Enter details..."}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 pl-11 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                value={examType === "internal" ? topicInput : examType === "board" ? examBoard : examName}
                onChange={e => {
                  if (examType === "internal") setTopicInput(e.target.value);
                  else if (examType === "board") setExamBoard(e.target.value);
                  else setExamName(e.target.value);
                }}
              />
              <PencilLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Target Date</label>
            <input
              disabled={isSyncing}
              type="date"
              className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Readiness slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[9px] md:text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Readiness</label>
              <span className="text-xl font-black text-blue-600 italic">{preparedness}%</span>
            </div>
            <input
              disabled={isSyncing}
              type="range" min={0} max={100}
              value={preparedness}
              onChange={e => setPreparedness(Number(e.target.value))}
              className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] text-gray-400 font-medium">Less prepared = more sessions</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                preparedness >= 70 ? "bg-emerald-50 text-emerald-600" :
                preparedness >= 40 ? "bg-blue-50 text-blue-600" :
                "bg-amber-50 text-amber-600"
              }`}>
                {computeSuggestedCount(DEFAULT_BASE_COUNTS[examType] ?? 4, preparedness)} standard sessions suggested
              </span>
            </div>
          </div>

          {/* ── Revision Plan (collapsible) ────────────────────────────── */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden">

            {/* Toggle header */}
            <button
              type="button"
              onClick={() => setRevisionOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Revision Plan</span>
                {/* Summary pills — visible when collapsed */}
                {!revisionOpen && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {totalSessions} sessions
                    </span>
                    <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
                    </span>
                    {hasPapers && (
                      <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black px-2 py-0.5 rounded-full">
                        Papers ✓
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${revisionOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Expanded content */}
            {revisionOpen && (
              <div className="px-5 pb-5 pt-4 space-y-3 bg-white animate-in slide-in-from-top-1 duration-200">

                {/* Summary bar */}
                <div className="flex items-center gap-2 flex-wrap pb-1">
                  <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[9px] font-black px-2.5 py-1 rounded-full">
                    {totalSessions} sessions planned
                  </span>
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2.5 py-1 rounded-full">
                    {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
                  </span>
                  {hasPapers && (
                    <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> Practice papers will be placed on high-availability days
                    </span>
                  )}
                </div>

                {/* Requirement rows */}
                <div className="space-y-3">
                  {requirements.map(req => (
                    <SlotRequirementRow
                      key={req.id}
                      req={req}
                      onChange={updated => updateRequirement(req.id, updated)}
                      onRemove={() => removeRequirement(req.id)}
                      showWindowFields={true}
                    />
                  ))}
                </div>

                {/* Add button */}
                <button
                  type="button"
                  onClick={addRequirement}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Session Type
                </button>
              </div>
            )}
          </div>
          {/* ── End Revision Plan ──────────────────────────────────────── */}

          {/* Submit */}
          <div className="flex flex-col md:flex-row gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!subject || !date || isSyncing}
              className="w-full bg-slate-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-600 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analysing Schedule...</>
              ) : (
                "Confirm Briefing"
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}