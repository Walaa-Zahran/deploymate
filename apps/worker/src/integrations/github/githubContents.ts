import { GitHubRepoRef } from "./parseRepoUrl.js";

type GitHubContentItem = {
  type: "file" | "dir";
  name: string;
  path: string;
};

type GitHubFileResponse = {
  type: "file";
  encoding: "base64";
  content: string; // base64
  path: string;
  name: string;
};

function base64ToUtf8(b64: string) {
  // GitHub sometimes includes newlines in base64
  const cleaned = b64.replace(/\n/g, "");
  return Buffer.from(cleaned, "base64").toString("utf-8");
}

export async function listRootFiles(
  ref: GitHubRepoRef,
  token?: string,
): Promise<GitHubContentItem[]> {
  const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API listRootFiles failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as any[];
  return data
    .filter((x) => x?.type === "file" || x?.type === "dir")
    .map((x) => ({ type: x.type, name: x.name, path: x.path }));
}

export async function getTextFile(
  ref: GitHubRepoRef,
  path: string,
  token?: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `GitHub API getTextFile failed (${path}): ${res.status} ${text}`,
    );
  }

  const data = (await res.json()) as GitHubFileResponse;
  if (data.type !== "file" || data.encoding !== "base64") return null;

  return base64ToUtf8(data.content);
}

export async function getJsonFile<T>(
  ref: GitHubRepoRef,
  path: string,
  token?: string,
): Promise<T | null> {
  const txt = await getTextFile(ref, path, token);
  if (!txt) return null;

  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}
