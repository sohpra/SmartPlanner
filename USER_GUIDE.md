# 📘 Smart Planner: User Guide

Welcome to **Smart Planner**! This app isn't just a to-do list; it's an intelligent companion that adapts to your pace. It schedules your revision, tracks your streaks, and helps you balance school work with exam prep.

---

## 🏠 The Dashboard (Your Command Center)

The main screen gives you a snapshot of your day and your long-term consistency.

### 1. The Stats
*   **🔥 Current Streak:** The number of consecutive days you have achieved "Mission Secured". Don't break the chain!
*   **🏆 Elite Status:** A count of the days where you went *above and beyond* the plan.
*   **⏳ Banked Time:** The total "Bonus Minutes" you've accumulated over time.

### 2. Today's Mission
*   **Work Load Bar:** This visualizes your day in minutes.
    *   **🟦 Blue:** Work in progress.
    *   **🟩 Green (Secured):** You have completed 100% of the planned work.
    *   **🟪 Purple (Elite):** You have done *more* than planned.
*   **Priority Checklist:** These are the specific tasks and revision slots scheduled for today. Simply click the checkbox when you finish a task.

### 3. Bonus Actions
*   **🚀 +15m / Elite Session (+30m):** Finished your list but still have energy? Click these buttons to log extra study time. This is the fastest way to trigger an **Elite Day**.
*   **🔄 Re-Shuffle Roadmap:** Life happens. If you missed tasks yesterday or want to reset your schedule, click this. The AI will look at what's left and reorganize your entire calendar instantly.

---

## 📚 Exam Register

This is where you manage your upcoming tests. The planner uses this info to automatically fill your daily schedule with revision slots.

### 1. Adding an Exam
Click **+ Add Exam** and fill in the details:
*   **Type:**
    *   *Internal:* For class tests or unit exams.
    *   *Board:* For major finals.
    *   *Competitive:* For entrance exams or Olympiads.
*   **Readiness Slider:** Be honest!
    *   If you slide it to **Low**, the planner will schedule *more* revision sessions.
    *   If you slide it to **High**, it will schedule fewer sessions.
*   **Revision Plan:** The app suggests a default plan (e.g., "8 Standard Sessions"). You can customize this by adding **Practice Papers**, **Mind Maps**, or **Flashcard** sessions.

### 2. Managing Progress
*   **The Progress Bar:** Shows how many revision sessions you've completed vs. how many were planned.
*   **"Extra Session Complete":** If you decide to study for a specific exam *outside* of the schedule, click this button on the exam card. It logs the progress and adapts the plan.

---

## 🏆 Gamification Rules

How do you win?

| Status | Requirement | Reward |
| :--- | :--- | :--- |
| **🛡️ Mission Secured** | Complete **100%** of the tasks planned for today. | Increases your **Current Streak**. |
| **🦄 Elite Day** | Complete **>100%** of the plan (e.g., by logging Bonus Effort). | Increases **Elite Count** and adds to **Banked Time**. |

---

## 💡 Pro Tips

1.  **Trust the Re-Shuffle:** Don't stress if you miss a day. The system is designed to be flexible. Just hit "Re-Shuffle" and let the algorithm fix your schedule.
2.  **Practice Papers:** When adding an exam, try adding a "Practice Paper" requirement. The planner is smart enough to schedule these on days where you have more free time.
3.  **Timezones Matter:** The planner resets at midnight **your local time**. Make sure to check off your tasks before you go to sleep to keep your streak alive!

---

## 🗓️ Views

*   **Daily:** Your focus mode. Shows only what you need to do today.
*   **Weekly:** A bird's-eye view of the week ahead. Good for spotting busy days.
*   **Monthly:** The long-term calendar. Shows exam dates and deadlines.

---

## 🧠 How the Scheduler Works

Ever wonder how the app decides what you do today? Here is the logic behind the magic.

### 1. The "Readiness" Algorithm
When you add an exam, we calculate how many study sessions you need using a weighted formula:
*   **Base Workload:** Determined by the exam type (e.g., A "Board Exam" starts with ~8 sessions, while an "Internal" test starts with ~4).
*   **Your Confidence:** We apply a multiplier based on your slider input.
    *   *0% Prepared:* We double the workload (200%).
    *   *50% Prepared:* We keep the standard workload (100%).
    *   *100% Prepared:* We reduce it to maintenance mode (40%).

### 2. The "Tetris" Placement Engine
Once we know *how many* slots you need, the scheduler places them on your calendar:
1.  **Big Rocks First:** Long tasks like **Practice Papers** (2-3 hours) are scheduled first. The system looks for days with high capacity (usually weekends) within the specific window you set (e.g., "5 to 30 days before the exam").
2.  **Filling the Gaps:** Shorter **Standard Sessions** (30-60 mins) are sprinkled into the remaining days to ensure consistent revision without burnout.
3.  **Dynamic Balancing:** If a day is already full with other tasks, the scheduler skips it and moves the slot to the next available opening.

### 3. The Re-Shuffle
Life is unpredictable. When you click **Re-Shuffle Roadmap**, the system deletes all *future* uncompleted revision slots, counts how many are left, and re-runs the placement engine from *Today* onwards. This smooths out any backlog over the remaining days.