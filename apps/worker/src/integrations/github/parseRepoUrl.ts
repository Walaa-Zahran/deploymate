export type GitHubRepoRef = { owner: string; repo: string };

export function parseGitHubRepoUrl(repoUrl: string): GitHubRepoRef {
  // Accept:
  // - https://github.com/OWNER/REPO
  // - https://github.com/OWNER/REPO.git
  // - git@github.com:OWNER/REPO.git
  const cleaned = repoUrl.trim();

  // SSH style
  const sshMatch = cleaned.match(/^git@github\.com:(.+?)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // HTTPS style
  const url = new URL(cleaned);
  if (url.hostname !== "github.com") {
    throw new Error("Only github.com repos are supported right now");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Invalid GitHub repo URL");

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  return { owner, repo };
}
