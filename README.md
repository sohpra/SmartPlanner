# Plan Bee - Smart Planner

A dynamic and intelligent personal planning application designed to help users manage their daily tasks, long-term projects, and exam revision schedules. It provides a gamified experience to motivate users by tracking streaks and rewarding extra effort.

The application is built with a modern tech stack, featuring a Next.js frontend and a Supabase backend for real-time data persistence and authentication.

## ✨ Key Features

*   **Dynamic Planner:** View your schedule in daily, weekly, or monthly formats. The planner automatically balances your workload based on predefined capacity.
*   **Intelligent Task Scheduling:** The core planning engine (`buildWeekPlan`) organizes your tasks, deadlines, and revision sessions into a coherent daily checklist.
*   **Exam & Revision Management:** Add exams with custom revision requirements (e.g., standard sessions, practice papers). The system automatically schedules and shuffles revision slots on your roadmap.
*   **Gamified Statistics:** Stay motivated by tracking your "Mission Secured" streak, achieving "Elite Day" status for going above and beyond, and banking bonus time.
*   **Real-time Sync:** All progress is synced to the Supabase database, including task completions and daily stats.
*   **Responsive UI:** A clean and responsive interface built with Tailwind CSS, suitable for both desktop and mobile use.
*   **Celebrations:** Fun confetti animations to celebrate completing your daily goals and logging extra effort.

## 🛠️ Tech Stack

*   **Framework:** Next.js (with App Router)
*   **Language:** TypeScript
*   **Backend & Database:** Supabase
*   **Styling:** Tailwind CSS
*   **UI Components:** Lucide React (for icons)
*   **Animations:** canvas-confetti

## 🚀 Getting Started

Follow these instructions to get a local copy of the project up and running.

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   A Supabase account

### Installation

1.  Clone the repository:
    ```sh
    git clone <your-repository-url>
    cd smartplanner
    ```

2.  Install the dependencies:
    ```sh
    npm install
    ```

### Environment Variables

The project connects to a Supabase backend. You need to create a `.env.local` file in the root of the project and add your Supabase project URL and anon key.

You can find these in your Supabase project dashboard under `Project Settings` > `API`.

**.env.local**

```
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### Running the Application

Once the environment variables are set, you can start the development server:

```sh
npm run dev
```

Open http://localhost:3000 in your browser to see the application.

## 📂 Project Structure

The project follows the standard Next.js App Router structure.

```
/
├── app/
│   ├── components/       # Reusable React components (Modals, Checklists, Cards)
│   ├── exams/            # Route and UI for the Exam Register page
│   ├── planner/          # Route and UI for the main Planner Dashboard
│   └── layout.tsx        # Root layout
├── hooks/                # Custom React hooks for data fetching (e.g., useExams, useProjects)
├── lib/
│   ├── planner/          # Core business logic for planning and revision scheduling
│   └── supabase/         # Supabase client and type definitions
└── public/               # Static assets
```

## 🧠 Core Concepts

### The Planning Engine (`buildWeekPlan`)

Located in lib/planner/buildWeekPlan.ts, this is the heart of the application. It takes all user data as input—tasks, deadlines, exams, projects, and daily capacity—to generate a structured plan for the next 60 days. It calculates the workload for each day and determines the list of tasks for the "Priority Checklist".

### Revision Slot Orchestration (`syncRevisionSlots`)

This crucial function in lib/planner/revisionPersistence.ts is responsible for creating, deleting, and re-shuffling revision sessions on the user's timeline. When an exam is added or removed, this function runs to recalculate the optimal placement of study slots based on the exam date and defined requirements.

### Daily Stats & Gamification

The application uses a Supabase RPC function sync_daily_stats to process daily user activity.

*   **Mission Secured:** Achieved when all planned tasks for the day are completed. This increments the user's `current_streak`.
*   **Elite Day:** Achieved when the user completes more tasks than planned or logs a significant amount of bonus time. This is tracked separately and contributes to the `lifetime_bonus_mins`.
*   **Bonus Effort:** Users can manually log extra effort (+15m or +30m), which instantly updates their workload metrics for the day and gets synced to the database.

## 📜 Available Scripts

*   `npm run dev`: Starts the development server.
*   `npm run build`: Creates a production build of the application.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Runs ESLint to check for code quality and style issues.