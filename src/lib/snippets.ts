import type { Snippet } from "@/components/CodeBlock/CodeBlock";

export function chatSnippets(baseUrl: string, model: string, opts: { system?: string; prompt?: string; key?: string } = {}): Snippet[] {
  const key = opts.key ?? "$YAVQO_API_KEY";
  const prompt = (opts.prompt ?? "Write a haiku about sunlight.").replace(/"/g, '\\"');
  const system = opts.system?.replace(/"/g, '\\"');
  const messages = [
    ...(system ? [`{ "role": "system", "content": "${system}" }`] : []),
    `{ "role": "user", "content": "${prompt}" }`,
  ];

  return [
    {
      label: "curl",
      code: `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [${messages.join(", ")}]
  }'`,
    },
    {
      label: "TypeScript",
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.YAVQO_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "${model}",
  messages: [${messages.join(", ")}],
});

console.log(completion.choices[0].message.content);`,
    },
    {
      label: "Python",
      code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["YAVQO_API_KEY"],
)

completion = client.chat.completions.create(
    model="${model}",
    messages=[${messages.join(", ")}],
)

print(completion.choices[0].message.content)`,
    },
  ];
}
