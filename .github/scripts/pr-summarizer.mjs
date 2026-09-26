import { Octokit } from "@octokit/action";

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
];

async function callGeminiWithFallback(apiKey, prompt) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    console.log(`Attempting PR summary using Gemini model: ${model}...`);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Model ${model} returned status ${response.status}: ${errorText}`);
        lastError = new Error(`Model ${model} failed (${response.status})`);
        continue; // Try next model in the fallback list
      }

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) {
        console.log(`Successfully generated summary using model: ${model}`);
        return { text: generatedText, modelUsed: model };
      }
    } catch (err) {
      console.warn(`Error connecting to model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models in fallback list failed. Last error: ${lastError?.message}`);
}

async function run() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("Missing GEMINI_API_KEY environment variable. Skipping PR summary generation.");
    process.exit(0);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("Missing GITHUB_TOKEN environment variable.");
    process.exit(1);
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("Missing GITHUB_EVENT_PATH.");
    process.exit(1);
  }

  const { readFileSync } = await import("fs");
  const eventData = JSON.parse(readFileSync(eventPath, "utf8"));
  const pullRequest = eventData.pull_request;

  if (!pullRequest) {
    console.log("No pull request found in event payload. Exiting.");
    process.exit(0);
  }

  const octokit = new Octokit({ auth: githubToken });
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const pullNumber = pullRequest.number;

  console.log(`Fetching diff for PR #${pullNumber} in ${owner}/${repo}...`);
  const diffResponse = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner,
    repo,
    pull_number: pullNumber,
    headers: {
      accept: "application/vnd.github.v3.diff",
    },
  });

  const diffText = diffResponse.data;
  if (!diffText || typeof diffText !== "string" || diffText.trim().length === 0) {
    console.log("PR diff is empty. Skipping summary.");
    process.exit(0);
  }

  // Truncate diff if extremely large to fit context comfortably
  const truncatedDiff = diffText.length > 30000 ? diffText.substring(0, 30000) + "\n...[diff truncated]" : diffText;

  const prompt = `You are a software engineering assistant generating clear, concise PR documentation for a university Secure Software Development project.

Review the following git diff and output ONLY markdown in the exact format shown below:

TITLE: <Conventional Commit title, e.g. fix(auth): prevent public admin account creation>

### Summary
<2-3 sentences in plain English explaining what was fixed or added, the root cause, and why it matters.>

### Key Changes
- <Bullet point 1: Specific file or security check modified>
- <Bullet point 2: Specific file or security check modified>
- <Bullet point 3: Specific file or security check modified>

---
*Generated automatically using Gemini AI model fallback*

Git diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`;

  const { text: resultText, modelUsed } = await callGeminiWithFallback(geminiApiKey, prompt);

  // Extract title if present in format "TITLE: <title>"
  let newTitle = null;
  let newBody = resultText;

  const titleMatch = resultText.match(/^TITLE:\s*(.+)$/m);
  if (titleMatch && titleMatch[1]) {
    newTitle = titleMatch[1].trim();
    // Remove the TITLE line from the body
    newBody = resultText.replace(/^TITLE:\s*.+$/m, "").trim();
  }

  // Append model badge to body
  newBody += `\n\n> *AI Summary generated using \`${modelUsed}\`*`;

  console.log(`Updating PR #${pullNumber}...`);
  const updatePayload = {
    owner,
    repo,
    pull_number: pullNumber,
    body: newBody,
  };

  // Only update title if original title is default/generic (e.g. branch name or empty)
  if (newTitle && (pullRequest.title.includes("/") || pullRequest.title.startsWith("Update") || pullRequest.title.length < 10)) {
    updatePayload.title = newTitle;
    console.log(`Setting new PR title: ${newTitle}`);
  }

  await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", updatePayload);
  console.log(`PR #${pullNumber} updated successfully!`);
}

run().catch((err) => {
  console.error("PR Summarizer failed:", err);
  process.exit(1);
});
