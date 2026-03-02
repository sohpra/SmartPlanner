import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface Reminder {
  id: string;
  text: string;
  is_completed: boolean;
  date: string;
}

export function useReminders(currentDate: string) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const fetchReminders = useCallback(async () => {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .gte('date', currentDate) // Fetch everything from today onwards
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });
    
    setReminders(data || []);
  }, [currentDate]);

  const addReminder = async (text: string, targetDate: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('reminders')
      .insert([{ user_id: user.id, text, date: targetDate, is_completed: false }])
      .select();
    if (data) setReminders(prev => [...prev, data[0]].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const toggleReminder = async (id: string, currentState: boolean) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !currentState } : r));
    await supabase.from('reminders').update({ is_completed: !currentState }).eq('id', id);
  };

  const deleteReminder = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    await supabase.from('reminders').delete().eq('id', id);
  };

  const moveReminder = async (id: string, date: string) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().split('T')[0];
    setReminders(prev => prev.map(r => r.id === id ? { ...r, date: nextDate } : r));
    await supabase.from('reminders').update({ date: nextDate }).eq('id', id);
  };

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  return { reminders, toggleReminder, addReminder, deleteReminder, moveReminder };
}