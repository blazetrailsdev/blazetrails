import type { TutorialStep } from "./types.js";

export interface TutorialEntry {
  slug: string;
  title: string;
  description: string;
  stepCount: number;
  loadSteps: () => Promise<TutorialStep[]>;
}

export const tutorials: TutorialEntry[] = [
  {
    slug: "docs",
    title: "Getting Started",
    description: "Build a document management app with Users, Folders, and Documents.",
    stepCount: 8,
    loadSteps: async () => (await import("./docs/index.js")).steps,
  },
  {
    slug: "music",
    title: "Music Collection",
    description: "Build a music library with Artists, Albums, Tracks, and Genres.",
    stepCount: 10,
    loadSteps: async () => {
      throw new Error("Music tutorial content not yet available");
    },
  },
  {
    slug: "finances",
    title: "Personal Finances",
    description: "Build a budgeting app with Accounts, Categories, Transactions, and Budgets.",
    stepCount: 10,
    loadSteps: async () => {
      throw new Error("Finances tutorial content not yet available");
    },
  },
];

export function getTutorial(slug: string): TutorialEntry | undefined {
  return tutorials.find((t) => t.slug === slug);
}
