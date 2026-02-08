import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots } from "./revisionEngine";

export async function syncRevisionSlots(exam: any) {
  const today = new Date().toISOString().split('T')[0];
  
  // 🎯 DYNAMIC WINDOW: Calculate days to exam or use 60-day default
  const examDate = exam.date.split('T')[0];
  const diffInDays = Math.ceil((new Date(examDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
  const planningHorizon = Math.max(60, diffInDays + 2); // Always reach the exam

  // 1. Generate slots using the Engine
  const virtualPlan = planRevisionSlots([exam], {
    startDate: today,
    numDays: planningHorizon,
    capacityByDate: {},
    includeExamDay: false
  });

  // 2. Clear old uncompleted slots for THIS exam
  await supabase
    .from("revision_slots")
    .delete()
    .match({ exam_id: exam.id, is_completed: false });

  // 3. Map to DB rows
  const rows = virtualPlan.days.flatMap(day => 
    day.slots.map((slot: any) => ({
      user_id: exam.user_id,
      exam_id: exam.id,
      date: day.date, 
      duration_minutes: slot.slotMinutes, // This will be 120 for "FINAL"
      description: slot.label,            // This will be "FINAL: Subject"
      is_completed: false
    }))
  );

  if (rows.length === 0) return;

  // 4. Push to Supabase
  const { error } = await supabase.from("revision_slots").insert(rows);
  if (error) console.error("❌ Sync Error:", error.message);
  else console.log(`✅ Synced ${rows.length} revision slots for ${exam.subject}`);
}