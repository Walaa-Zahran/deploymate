type DetectedStack = {
  language: string;
  framework: string;
  buildTool?: string;
  confidence: number; // 0..1
  notes: string[];
};

function includesAny(text: string, tokens: string[]) {
  const lower = text.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

export function detectStackFromRepoUrl(repoUrl: string): DetectedStack {
  const notes: string[] = [];

  // SUPER lightweight heuristic for now (fast for hackathon).
  // Later we’ll replace with real repo inspection via GitHub API / cloning.
  if (includesAny(repoUrl, ["angular"])) {
    notes.push("Repo URL contains 'angular'.");
    return {
      language: "TypeScript",
      framework: "Angular",
      buildTool: "Angular CLI",
      confidence: 0.7,
      notes,
    };
  }

  if (includesAny(repoUrl, ["react", "next"])) {
    notes.push("Repo URL contains 'react' or 'next'.");
    return {
      language: "TypeScript/JavaScript",
      framework: "React/Next.js",
      confidence: 0.6,
      notes,
    };
  }

  if (includesAny(repoUrl, ["django"])) {
    notes.push("Repo URL contains 'django'.");
    return { language: "Python", framework: "Django", confidence: 0.6, notes };
  }

  if (includesAny(repoUrl, ["laravel"])) {
    notes.push("Repo URL contains 'laravel'.");
    return { language: "PHP", framework: "Laravel", confidence: 0.6, notes };
  }

  notes.push(
    "No strong signal from repo URL. Using generic web service assumptions.",
  );
  return { language: "Unknown", framework: "Unknown", confidence: 0.2, notes };
}
