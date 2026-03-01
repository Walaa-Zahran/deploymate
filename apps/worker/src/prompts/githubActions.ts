export function githubActionsPrompt(input: {
  framework: string;
  packageManager?: string;
}): string {
  const pm = input.packageManager ?? "npm";

  // I'll generate a workflow that builds + runs tests (if available).
  return `
Generate a GitHub Actions workflow YAML for a ${input.framework} project.

Requirements:
- Trigger on push and pull_request to main.
- Use ubuntu-latest.
- Setup Node 20.
- Install deps using ${pm}.
- Run lint if script exists.
- Run test if script exists.
- Run build.
- Use best-practice caching.
Return ONLY YAML content (no markdown fences).
`.trim();
}
