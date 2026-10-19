import type { Memory } from "./types";

const demoDate = (daysAgo: number, hour: number): string => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const DEMO_MEMORIES: Memory[] = [
  {
    id: "demo-ai-project-direction",
    title: "AI project: start with the evidence layer",
    content:
      "I decided to build the evidence-backed memory layer first for my AI project. It is the smallest useful slice and helps me prove that answers are grounded before I add a chatty interface or semantic search.",
    tags: ["ai-project", "decision", "buildathon"],
    createdAt: demoDate(8, 10),
    updatedAt: demoDate(8, 10),
  },
  {
    id: "demo-why-evidence",
    title: "Why citations matter",
    content:
      "My reason for prioritizing citations is trust: if I can open the exact note behind an answer, I can quickly check whether the assistant understood me correctly. No evidence should mean an honest 'not found' response.",
    tags: ["ai-project", "trust", "product-principle"],
    createdAt: demoDate(7, 16),
    updatedAt: demoDate(7, 16),
  },
  {
    id: "demo-mvp-scope",
    title: "MVP scope for the memory buddy",
    content:
      "For the first demo, I am keeping the scope to saving memories, keyword retrieval, grounded answers, and clickable sources. Authentication, payments, embeddings, and integrations can wait until the core loop works.",
    tags: ["mvp", "scope", "buildathon"],
    createdAt: demoDate(6, 11),
    updatedAt: demoDate(6, 11),
  },
  {
    id: "demo-research-plan",
    title: "Research plan for human-computer interaction",
    content:
      "This week I will read the assigned paper on explainable interfaces, highlight three useful ideas, and write a 250-word reflection. I blocked Tuesday evening for reading and Thursday morning for the draft.",
    tags: ["study", "hci", "schedule"],
    createdAt: demoDate(5, 18),
    updatedAt: demoDate(5, 18),
  },
  {
    id: "demo-database-decision",
    title: "Project database decision",
    content:
      "I chose SQLite for the class project because the dataset is small, the schema is easy to inspect, and I can keep the demo reproducible without provisioning a hosted database.",
    tags: ["database", "decision", "class-project"],
    createdAt: demoDate(4, 14),
    updatedAt: demoDate(4, 14),
  },
  {
    id: "demo-demo-deadline",
    title: "Buildathon demo deadline",
    content:
      "The final demo is Friday at 4:00 PM. I need a working save-and-ask flow before polishing the visual design, and I should leave at least one hour for a clean deploy rehearsal.",
    tags: ["deadline", "buildathon", "planning"],
    createdAt: demoDate(3, 9),
    updatedAt: demoDate(3, 9),
  },
  {
    id: "demo-morning-routine",
    title: "A better morning routine",
    content:
      "A short walk and a paper to-do list help me start focused. I want to keep the routine simple: water, ten-minute walk, then choose one important task before opening messages.",
    tags: ["personal", "routine", "focus"],
    createdAt: demoDate(2, 8),
    updatedAt: demoDate(2, 8),
  },
  {
    id: "demo-presentation-feedback",
    title: "Presentation feedback to use",
    content:
      "The strongest feedback was to show the before-and-after user journey instead of explaining every implementation detail. I will open with a saved note, ask a question, then click the source citation.",
    tags: ["presentation", "feedback", "demo"],
    createdAt: demoDate(1, 13),
    updatedAt: demoDate(1, 13),
  },
  {
    id: "demo-next-week",
    title: "Next week priorities",
    content:
      "After the demo, I want to add import and export first, then experiment with embeddings only if keyword retrieval is not enough. I also want to ask two classmates to try the citation flow.",
    tags: ["next-steps", "planning", "ai-project"],
    createdAt: demoDate(0, 15),
    updatedAt: demoDate(0, 15),
  },
];

export function cloneDemoMemories(): Memory[] {
  return DEMO_MEMORIES.map((memory) => ({ ...memory, tags: [...memory.tags] }));
}
