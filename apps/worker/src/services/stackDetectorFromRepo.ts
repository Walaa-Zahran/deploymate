import { parseGitHubRepoUrl } from "../integrations/github/parseRepoUrl.js";
import {
  getJsonFile,
  getTextFile,
  listRootFiles,
} from "../integrations/github/githubContents.js";

type DetectedStack = {
  language: string;
  framework: string;
  runtime?: string;
  packageManager?: string;
  confidence: number; // 0..1
  signals: string[];
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function hasDep(pkg: PackageJson, dep: string) {
  return Boolean(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]);
}

export async function detectStackFromGitHub(
  repoUrl: string,
  githubToken?: string,
): Promise<DetectedStack> {
  const ref = parseGitHubRepoUrl(repoUrl);

  const signals: string[] = [];
  const root = await listRootFiles(ref, githubToken);

  const hasFile = (name: string) =>
    root.some((x) => x.type === "file" && x.name === name);

  // 1) Node/TS ecosystem
  const pkg = await getJsonFile<PackageJson>(ref, "package.json", githubToken);
  if (pkg) signals.push("Found package.json");

  // 2) Angular
  const angularJson = await getJsonFile<any>(ref, "angular.json", githubToken);
  if (angularJson) signals.push("Found angular.json");

  // 3) Python
  const requirementsTxt = await getTextFile(
    ref,
    "requirements.txt",
    githubToken,
  );
  if (requirementsTxt) signals.push("Found requirements.txt");

  // 4) .NET
  const rootDirsAndFiles = root.map((x) => x.name.toLowerCase());
  const looksDotNet = rootDirsAndFiles.some(
    (n) => n.endsWith(".sln") || n.endsWith(".csproj"),
  );
  if (looksDotNet) signals.push("Found .sln/.csproj in repo root");

  // 5) Docker
  if (hasFile("Dockerfile")) signals.push("Found Dockerfile");

  // Decide
  // Angular
  if (angularJson || (pkg && hasDep(pkg, "@angular/core"))) {
    let confidence = 0.75;
    if (angularJson && hasDep(pkg ?? {}, "@angular/core")) confidence = 0.9;

    const pm = hasFile("pnpm-lock.yaml")
      ? "pnpm"
      : hasFile("yarn.lock")
        ? "yarn"
        : hasFile("package-lock.json")
          ? "npm"
          : undefined;

    if (pm) signals.push(`Detected package manager: ${pm}`);

    return {
      language: "TypeScript",
      framework: "Angular",
      runtime: "Node.js",
      packageManager: pm,
      confidence,
      signals,
    };
  }

  // React / Next
  if (pkg && (hasDep(pkg, "react") || hasDep(pkg, "next"))) {
    const fw = hasDep(pkg, "next") ? "Next.js" : "React";
    let confidence = 0.75;

    const pm = hasFile("pnpm-lock.yaml")
      ? "pnpm"
      : hasFile("yarn.lock")
        ? "yarn"
        : hasFile("package-lock.json")
          ? "npm"
          : undefined;

    if (pm) signals.push(`Detected package manager: ${pm}`);

    return {
      language: "TypeScript/JavaScript",
      framework: fw,
      runtime: "Node.js",
      packageManager: pm,
      confidence,
      signals,
    };
  }

  // Django / Python
  if (requirementsTxt) {
    const isDjango = requirementsTxt.toLowerCase().includes("django");
    return {
      language: "Python",
      framework: isDjango ? "Django" : "Python (unknown framework)",
      runtime: "Python",
      confidence: isDjango ? 0.75 : 0.55,
      signals,
    };
  }

  // .NET
  if (looksDotNet) {
    return {
      language: "C#",
      framework: ".NET",
      runtime: ".NET",
      confidence: 0.7,
      signals,
    };
  }

  // fallback
  return {
    language: "Unknown",
    framework: "Unknown",
    confidence: 0.25,
    signals,
  };
}
