import { chatComplete } from "../integrations/llm/openaiClient.js";
import { SYSTEM_PROMPT } from "../prompts/system.js";
import { dockerfilePrompt } from "../prompts/dockerfile.js";
import { githubActionsPrompt } from "../prompts/githubActions.js";
import { doAppSpecPrompt } from "../prompts/doAppSpec.js";

type DetectedStack = {
  framework: string;
  packageManager?: string;
};

function cleanYamlOrText(s: string) {
  // Remove accidental ``` fences if the model included them
  return s.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
}

export async function generateArtifacts(input: {
  repoUrl: string;
  detected: DetectedStack;
}): Promise<{
  dockerfile: string;
  githubActionsYaml: string;
  doAppSpecYaml: string;
}> {
  const dockerfile = cleanYamlOrText(
    await chatComplete({
      system: SYSTEM_PROMPT,
      user: dockerfilePrompt({
        framework: input.detected.framework,
        packageManager: input.detected.packageManager
      })
    })
  );

  const gha = cleanYamlOrText(
    await chatComplete({
      system: SYSTEM_PROMPT,
      user: githubActionsPrompt({
        framework: input.detected.framework,
        packageManager: input.detected.packageManager
      })
    })
  );

  const serviceName = "deploymate-app";
  const doSpec = cleanYamlOrText(
    await chatComplete({
      system: SYSTEM_PROMPT,
      user: doAppSpecPrompt({
        framework: input.detected.framework,
        repoUrl: input.repoUrl,
        serviceName
      })
    })
  );

  return { dockerfile, githubActionsYaml: gha, doAppSpecYaml: doSpec };
}