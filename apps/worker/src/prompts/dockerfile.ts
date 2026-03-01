export function dockerfilePrompt(input: {
  framework: string;
  packageManager?: string;
}): string {
  const pm = input.packageManager ?? "npm";

  if (input.framework === "Angular") {
    return `
Generate a production-ready Dockerfile for an Angular SPA.

Requirements:
- Multi-stage build.
- Build with ${pm}.
- Serve with nginx in final stage.
- Use Node 20+ for build stage.
- Copy built dist output to nginx html.
- Expose port 80.
Return ONLY Dockerfile content.
`.trim();
  }

  if (input.framework === "Next.js") {
    return `
Generate a production-ready Dockerfile for a Next.js app.

Requirements:
- Multi-stage build.
- Build with ${pm}.
- Use Node 20+.
- Run in production mode.
- Expose port 3000.
Return ONLY Dockerfile content.
`.trim();
  }

  if (input.framework === "React") {
    return `
Generate a production-ready Dockerfile for a React SPA.

Requirements:
- Multi-stage build.
- Build with ${pm}.
- Serve with nginx in final stage.
- Use Node 20+ for build stage.
- Expose port 80.
Return ONLY Dockerfile content.
`.trim();
  }

  return `
Generate a production-ready Dockerfile for a generic web service.

Requirements:
- Use a sensible official base image.
- Expose a sensible port.
Return ONLY Dockerfile content.
`.trim();
}
