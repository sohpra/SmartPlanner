"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useSubjects } from "@/hooks/use-subjects";

export default function ProjectsPage() {
  const { projects, isLoading, error, createProject, deleteProject } =
    useProjects();
  const { subjects, loading: subjectsLoading } = useSubjects();

  // form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [hours, setHours] = useState(1);

  if (isLoading) {
    return <div className="p-8">Loading projects…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Error loading projects: {error}
      </div>
    );
  }

  async function handleAddProject() {
    await createProject({
      name,
      subject: subject || null,
      due_date: dueDate,
      estimated_minutes: hours * 60,
    });

    // reset
    setName("");
    setSubject("");
    setDueDate("");
    setHours(1);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
      </div>

      {/* Add project */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Add project</h2>

        <div className="grid grid-cols-2 gap-6">
          {/* LEFT — identity */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Project name</span>
              <input
                className="mt-1 w-full rounded border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. History coursework"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Subject (optional)</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={subjectsLoading}
              >
                <option value="">
                  {subjectsLoading
                    ? "Loading subjects…"
                    : "Select subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* RIGHT — constraints */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Due date</span>
              <input
                type="date"
                className="mt-1 w-full rounded border p-2"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                Estimated effort (hours)
              </span>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border p-2"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </label>
          </div>
        </div>

        <button
          onClick={handleAddProject}
          disabled={!name || !dueDate || hours <= 0}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Add project
        </button>
      </div>

      {/* Project list */}
      <div className="space-y-3">
        {projects.length === 0 && (
          <div className="rounded-lg border bg-gray-50 p-6 text-sm text-gray-500">
            No projects added yet.
          </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4"
          >
            <div>
              <div className="font-medium">{project.name}</div>
              <div className="text-sm text-gray-500">
                {project.subject && `${project.subject} · `}
                Due{" "}
                {new Date(project.due_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {project.completed_minutes / 60} /{" "}
                {project.estimated_minutes / 60}h
              </div>
            </div>

            <button
              onClick={async () => {
                if (confirm("Delete this project?")) {
                  await deleteProject(project.id);
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
