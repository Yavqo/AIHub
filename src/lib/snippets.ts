import type { Snippet } from "@/components/CodeBlock/CodeBlock";
import { DEFAULT_VOICE } from "@/lib/models";
import type { ModelKind } from "@/lib/types";

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

export function speechSnippets(baseUrl: string, model: string, opts: { voice?: string; key?: string } = {}): Snippet[] {
  const key = opts.key ?? "$YAVQO_API_KEY";
  const voice = opts.voice || DEFAULT_VOICE;

  return [
    {
      label: "curl",
      code: `curl ${baseUrl}/audio/speech \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "voice": "${voice}",
    "input": "Welcome to Yavqo AIHub. Your deployment is ready.",
    "response_format": "wav"
  }' \\
  --output speech.wav`,
    },
    {
      label: "TypeScript",
      code: `import fs from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.YAVQO_API_KEY,
});

const speech = await client.audio.speech.create({
  model: "${model}",
  voice: "${voice}" as "alloy",
  input: "Welcome to Yavqo AIHub. Your deployment is ready.",
  response_format: "wav",
});

await fs.writeFile("speech.wav", Buffer.from(await speech.arrayBuffer()));`,
    },
    {
      label: "Python",
      code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["YAVQO_API_KEY"],
)

with client.audio.speech.with_streaming_response.create(
    model="${model}",
    voice="${voice}",
    input="Welcome to Yavqo AIHub. Your deployment is ready.",
    response_format="wav",
) as response:
    response.stream_to_file("speech.wav")`,
    },
  ];
}

export function decisionSnippets(baseUrl: string, model: string, opts: { key?: string } = {}): Snippet[] {
  const key = opts.key ?? "$YAVQO_API_KEY";

  return [
    {
      label: "curl",
      code: `curl ${baseUrl}/decisions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "input": "The mug I ordered Monday arrived cracked. Please send a refund.",
    "questions": {
      "is_damaged": {
        "type": "noul",
        "instructions": "Did the item arrive damaged?"
      },
      "queue": {
        "type": "choice",
        "instructions": "Which support queue should handle this?",
        "criteria": {
          "billing": "Payment, invoice or refund requests.",
          "replacements": "Damaged, missing or wrong items."
        }
      },
      "urgency": {
        "type": "score",
        "instructions": "Rate customer urgency.",
        "criteria": ["Calm", "Annoyed", "Demanding immediate escalation"]
      }
    }
  }'`,
    },
    {
      label: "TypeScript",
      code: `const res = await fetch("${baseUrl}/decisions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.YAVQO_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "${model}",
    input: "The mug I ordered Monday arrived cracked. Please send a refund.",
    questions: {
      is_damaged: { type: "noul", instructions: "Did the item arrive damaged?" },
      queue: {
        type: "choice",
        instructions: "Which support queue should handle this?",
        criteria: {
          billing: "Payment, invoice or refund requests.",
          replacements: "Damaged, missing or wrong items.",
        },
      },
    },
  }),
});

const { answers, usage } = await res.json();
console.log(answers, usage);`,
    },
    {
      label: "Python",
      code: `import os, requests

res = requests.post(
    "${baseUrl}/decisions",
    headers={"Authorization": f"Bearer {os.environ['YAVQO_API_KEY']}"},
    json={
        "model": "${model}",
        "input": "The mug I ordered Monday arrived cracked. Please send a refund.",
        "questions": {
            "is_damaged": {"type": "noul", "instructions": "Did the item arrive damaged?"},
            "queue": {
                "type": "choice",
                "instructions": "Which support queue should handle this?",
                "criteria": {
                    "billing": "Payment, invoice or refund requests.",
                    "replacements": "Damaged, missing or wrong items.",
                },
            },
        },
    },
)
res.raise_for_status()
print(res.json())`,
    },
  ];
}

export function realtimeSnippets(baseUrl: string, model: string, opts: { voice?: string; key?: string } = {}): Snippet[] {
  const key = opts.key ?? "$YAVQO_API_KEY";
  const voice = opts.voice || DEFAULT_VOICE;

  return [
    {
      label: "curl",
      code: `# 1. Mint a short-lived session token on your backend
curl -X POST ${baseUrl}/realtime/sessions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "voice": "${voice}",
    "ttl_minutes": 15,
    "modalities": ["AUDIO"]
  }'`,
    },
    {
      label: "TypeScript",
      code: `// 1. On your server: mint a single-use token (never expose YAVQO_API_KEY to browsers)
const res = await fetch("${baseUrl}/realtime/sessions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.YAVQO_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "${model}",
    voice: "${voice}",
    ttl_minutes: 15,
    modalities: ["AUDIO"],
  }),
});
const session = await res.json();

// 2. In your client: open the WebSocket with session.token
const ws = new WebSocket(\`\${session.websocket_url}?access_token=\${encodeURIComponent(session.token)}\`);
ws.onopen = () => console.log("Connected to", session.model);`,
    },
    {
      label: "Python",
      code: `import os, requests

res = requests.post(
    "${baseUrl}/realtime/sessions",
    headers={"Authorization": f"Bearer {os.environ['YAVQO_API_KEY']}"},
    json={
        "model": "${model}",
        "voice": "${voice}",
        "ttl_minutes": 15,
        "modalities": ["AUDIO"],
    },
)
res.raise_for_status()
session = res.json()
print("Token:", session["token"])
print("WebSocket:", session["websocket_url"])`,
    },
  ];
}

export function snippetsForModel(
  kind: ModelKind,
  baseUrl: string,
  model: string,
  opts: { voice?: string; prompt?: string } = {},
): Snippet[] {
  switch (kind) {
    case "tts":
      return speechSnippets(baseUrl, model, opts);
    case "decision":
      return decisionSnippets(baseUrl, model);
    case "realtime":
      return realtimeSnippets(baseUrl, model, opts);
    default:
      return chatSnippets(baseUrl, model, opts);
  }
}
