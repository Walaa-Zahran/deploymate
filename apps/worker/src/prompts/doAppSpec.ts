export function doAppSpecPrompt(input: {
  framework: string;
  repoUrl: string;
  serviceName: string;
}): string {
  // App Platform spec. I'll keep it generic and safe.
  // I'll assume the repo contains the Dockerfile we generated at root.
  return `
Generate a DigitalOcean App Platform app spec YAML for deploying this repo: ${input.repoUrl}

Requirements:
- service name: ${input.serviceName}
- Use a Dockerfile at repo root.
- Run as a web service.
- Set HTTP port depending on framework:
  - Angular/React SPA with nginx: 80
  - Next.js: 3000
  - otherwise: 8080
- Include health_check path: /health (if applicable; ok to omit for static nginx)
Return ONLY YAML content (no markdown fences).
`.trim();
}
