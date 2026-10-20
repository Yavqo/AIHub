"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/Button/Button";
import Card from "@/components/Card/Card";
import CodeBlock from "@/components/CodeBlock/CodeBlock";
import { SelectField, TextArea } from "@/components/FormField/FormField";
import Icon from "@/components/Icon/Icon";
import Modal from "@/components/Modal/Modal";
import { apiBaseUrl } from "@/lib/site";
import { chatSnippets } from "@/lib/snippets";
import styles from "./playground.module.css";

export type PlaygroundTarget = { id: string; label: string; group: string; modelName: string; hasSystemPrompt: boolean; isDeployment: boolean; status: "active" | "paused" | "suspended" };

type Message = { role: "user" | "assistant"; content: string; reasoning?: string; error?: boolean };

const SUGGESTIONS = ["Explain closures in JavaScript", "Write a SQL query for monthly signups", "Summarise the benefits of solar power"];

export default function Playground({ targets, initialModel }: { targets: PlaygroundTarget[]; initialModel: string }) {
  const [model, setModel] = useState(initialModel);
  const current = targets.find((t) => t.id === model);
  const [system, setSystem] = useState(current?.hasSystemPrompt ? "" : "You are Sunlight, a helpful assistant from Yavqo.");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  function patchLast(fn: (m: Message) => Message) {
    setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1])]);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            ...(system.trim() ? [{ role: "system", content: system.trim() }] : []),
            ...history.map(({ role, content }) => ({ role, content })),
          ],
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        patchLast((m) => ({ ...m, error: true, content: json?.error?.message ?? "Something went wrong. Try again." }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.startsWith("data:") ? line.slice(5).trim() : "";
          if (!data || data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta ?? {};
            const piece: string = delta.content ?? "";
            const thought: string = delta.reasoning_content ?? delta.reasoning ?? "";
            if (piece || thought) {
              patchLast((m) => ({ ...m, content: m.content + piece, reasoning: thought ? (m.reasoning ?? "") + thought : m.reasoning }));
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patchLast((m) => ({ ...m, error: true, content: "The connection dropped. Try again." }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  const lastPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? (input || undefined);

  return (
    <div className={`y-container ${styles.page}`}>
      <Card className={styles.settings} compact>
        <div className={styles.settingsHead}>
          <h1 className="y-feature">Playground</h1>
        </div>
        <SelectField id="pg-model" label="Deployment or model" value={model} onChange={(e) => setModel(e.target.value)}>
          {[...new Set(targets.map((t) => t.group))].map((group) => (
            <optgroup key={group} label={group}>
              {targets.filter((t) => t.group === group).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.status === "suspended" ? " (suspended)" : t.status === "paused" ? " (paused)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <TextArea
          id="pg-system"
          label={current?.hasSystemPrompt ? "Extra system prompt" : "System prompt"}
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          rows={4}
          hint={current?.hasSystemPrompt ? "This deployment's own system prompt is applied first." : undefined}
        />
        <div className={styles.range}>
          <label className={styles.rangeTop} htmlFor="pg-temp"><span>Temperature</span><strong>{temperature.toFixed(1)}</strong></label>
          <input id="pg-temp" type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
        </div>
        <div className={styles.range}>
          <label className={styles.rangeTop} htmlFor="pg-max"><span>Max tokens</span><strong>{maxTokens}</strong></label>
          <input id="pg-max" type="range" min={64} max={4096} step={64} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
        </div>
        <div className={styles.toolbar}>
          <Button variant="outline" onClick={() => setCodeOpen(true)}>Copy as code</Button>
          <Button variant="outline" onClick={() => setMessages([])} disabled={!messages.length || streaming}>Clear chat</Button>
        </div>
      </Card>

      <section className={styles.chat} aria-label="Conversation">
        <div className={styles.thread} ref={threadRef} aria-live="polite">
          {messages.length === 0 ? (
            current?.status === "suspended" || current?.status === "paused" ? (
              <div className={styles.empty}>
                <h2 className="y-sub">{current.status === "suspended" ? "This deployment is suspended" : "This deployment is paused"}</h2>
                <p className="y-muted">
                  {current.status === "suspended"
                    ? "Yavqo suspended it, so it can't answer messages. See the project page for details or contact Yavqo support."
                    : "Resume it on the project page to chat with it."}
                </p>
              </div>
            ) : (
            <div className={styles.empty}>
              <h2 className="y-sub">Try a prompt</h2>
              <p className="y-muted">Messages here are billed like API calls{current?.isDeployment ? `, to the ${current.group} project` : ""}.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className={styles.suggestion} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
            )
          ) : (
            messages.map((m, i) => {
              const last = i === messages.length - 1;
              return (
                <div key={i} className={`${styles.msg} ${m.role === "user" ? styles.user : ""}`}>
                  <span className={styles.who}>{m.role === "user" ? "You" : current?.label ?? "Sunlight"}</span>
                  {m.reasoning ? (
                    <details className={styles.thinking}>
                      <summary>Thought process</summary>
                      <p>{m.reasoning}</p>
                    </details>
                  ) : null}
                  <div className={`${styles.bubble} ${m.error ? styles.errorText : ""}`}>
                    {m.content}
                    {last && streaming && m.role === "assistant" ? <span className={styles.caret} aria-hidden /> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="pg-input" className="y-sr-only">Message</label>
          <textarea
            id="pg-input"
            className={styles.input}
            rows={1}
            placeholder="Message Sunlight"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {streaming ? (
            <button type="button" className={styles.send} onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
              <Icon name="stop" />
            </button>
          ) : (
            <button type="submit" className={styles.send} disabled={!input.trim()} aria-label="Send message">
              <Icon name="send" />
            </button>
          )}
        </form>
      </section>

      <Modal open={codeOpen} title="Use this in your app" onClose={() => setCodeOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="y-muted">Use an API key from the same project as the deployment.</p>
          <CodeBlock
            snippets={chatSnippets(current?.isDeployment ? `${apiBaseUrl}/deployments/${model}` : apiBaseUrl, model, { system: system || undefined, prompt: lastPrompt })}
          />
        </div>
      </Modal>
    </div>
  );
}
