import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots } from "./revisionEngine";

export async function syncRevisionSlots(exam: any) {
  // 1. Clear existing slots
  await supabase
    .from("revision_slots")
    .delete()
    .eq("exam_id", exam.id);

  // 2. Generate the "Virtual" plan
  // We use your engine to calculate the 'Ideal' spread
  const virtualPlan = planRevisionSlots([exam], {
    startDate: new Date().toISOString().split('T')[0],
    numDays: 14,
    capacityByDate: {}, // Let the engine assume fresh capacity
    includeExamDay: false
  });

  // 3. Map to DB rows with "Smart Labels"
  const slotsToInsert = virtualPlan.days.flatMap(day => 
    day.slots.map((slot: any) => {
      // 🎯 IMPROVED: Detect if this is the 'Final' block from the engine
      const isFinal = slot.label?.includes("FINAL");
      
      let displayDescription = exam.competitive_exam_name || exam.subject || "Revision";
      if (isFinal) displayDescription = `FINAL: ${displayDescription}`;

      return {
        user_id: exam.user_id,
        exam_id: exam.id,
        date: day.date, 
        // 🎯 ensure 120m for big blocks if that's what we want to 'lock'
        duration_minutes: slot.slotMinutes || 30,
        description: displayDescription, 
        is_completed: false
      };
    })
  );

  if (slotsToInsert.length === 0) return;

  // 4. Bulk Insert
  const { error } = await supabase
    .from("revision_slots")
    .insert(slotsToInsert);

  if (error) console.error("Error saving revision slots:", error);
}