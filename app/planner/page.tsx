// app/planner/page.tsx
"use client";

import { Suspense } from 'react';
import PlannerClient from './PlannerClient'; // No curly braces for default exports

export const dynamic = 'force-dynamic';

export default function PlannerPage() {
  return (
    <Suspense fallback={<div>Loading Plan Bee...</div>}>
      <PlannerClient />
    </Suspense>
  );
}