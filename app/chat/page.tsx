"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };
type ModelKey = "claude" | "gemini";
// setup → confirming → chatting → reflecting
type Phase = "setup" | "confirming" | "chatting" | "reflecting";

const MODELS: { key: ModelKey; label: string; sublabel: string }[] = [
  { key: "claude", label: "Claude", sublabel: "Sonnet 4.6" },
  { key: "gemini", label: "Gemini", sublabel: "2.5 Flash" },
];

const CORA_DONE_SIGNAL = "i think i've got it, thanks for teaching me";

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildCoraPrompt(topic: string, objective: string) {
  return `You are a student named Cora who is learning about ${topic} for the first time. You know nothing about it.

LEARNING OBJECTIVE
The student should walk away from this conversation understanding: ${objective}
Use this as your guide for what to ask about. Don't follow a fixed structure, ask whatever questions naturally help you understand toward this objective.

PERSONALITY
- You are friendly, curious, and a little confused
- Keep every response to 1-2 short sentences
- Never give answers or show prior knowledge
- Never introduce concepts the person hasn't mentioned yet
- Only ask ONE question per response, never two
- You don't always have to ask a question, sometimes react with a short comment or observation instead, like a real conversation partner would

ENGAGEMENT
If the person's responses become short, vague, or low effort, do not just continue normally. Ask something more specific and concrete to help them re-engage, like asking for a real example instead of a general explanation.

DETOUR RULE
If the person goes off topic, acknowledge it briefly in one sentence then come back to where you left off.

IMPORTANT
- Pay close attention to what the person just said
- If they explained something clearly, build on it and don't ask them to repeat it
- If their explanation was vague or unclear, ask them to explain it a different way
- Never ask about something already covered by the learning objective if it's already been explained

GOING DEEPER
Once you feel the learning objective has mostly been covered, ask at least one deeper question before stopping. Like asking for an example, or what would happen if someone didn't understand this.

STOPPING CONDITION
Only stop once you believe the learning objective has been clearly met and you've asked at least one deeper question. When stopping, summarize what you learned in 2-3 sentences and say "I think I've got it, thanks for teaching me!"

REFLECTION
After your summary, ask the person to reflect on what part was hardest to explain.

WRONG ANSWERS
If something sounds incorrect, say you're confused and ask them to explain it a different way. Never say they are wrong directly.

Start by saying: "Hi! I'm Cora. I'm trying to learn about ${topic} but I'm really struggling, can you help me?"`;
}

function buildReflectionPrompt(topic: string, objective: string) {
  return `You are a reflective learning coach facilitating a meta-reflection conversation with someone who just finished a peer-teaching exercise. They were asked to teach an AI student named Cora about "${topic}", with the goal that the student would understand: "${objective}".

Your role is to ask 2-3 thoughtful, open-ended meta-reflection questions about their teaching experience — one at a time. Do not ask all questions at once.

Focus on questions like:
- What was hardest to explain and why?
- What would they do differently if they had to teach it again?
- What did they notice about their own understanding through the process of explaining it?
- Were there any moments where they realized they didn't understand something as well as they thought?

Tone: warm, analytical, and genuinely curious. You are NOT Cora. You are a distinct reflective coach persona.

Keep your responses concise (2-3 sentences max). After their third substantive answer, close the reflection warmly with a brief synthesis of what you heard and a thank-you.

Start by saying: "Great work teaching Cora! I'd love to take a moment to reflect on that experience with you. What part of the explanation felt hardest to put into words?"`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatTranscript(
  topic: string,
  objective: string,
  coraMessages: Message[],
  reflectionMessages: Message[]
) {
  const lines: string[] = [
    `CORA SESSION TRANSCRIPT`,
    `Topic: ${topic}`,
    `Learning objective: ${objective}`,
    `Date: ${new Date().toLocaleString()}`,
    ``,
    `── TEACHING SESSION ──`,
    ``,
  ];
  for (const m of coraMessages) {
    lines.push(`${m.role === "assistant" ? "Cora" : "Teacher"}: ${m.content}`);
    lines.push(``);
  }
  if (reflectionMessages.length > 0) {
    lines.push(`── REFLECTION ──`);
    lines.push(``);
    for (const m of reflectionMessages) {
      lines.push(`${m.role === "assistant" ? "Reflection Coach" : "Teacher"}: ${m.content}`);
      lines.push(``);
    }
  }
  return lines.join("\n");
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CoraIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="11" fill="var(--logo-bg)" />
      <circle cx="18" cy="12" r="3"     fill="var(--logo-fg)" />
      <circle cx="11" cy="24" r="2.3"   fill="var(--logo-fg)" fillOpacity="0.75" />
      <circle cx="25" cy="24" r="2.3"   fill="var(--logo-fg)" fillOpacity="0.75" />
      <line x1="18"   y1="15"  x2="12"   y2="22.2" stroke="var(--logo-fg)" strokeWidth="1.4" strokeOpacity="0.45" strokeLinecap="round" />
      <line x1="18"   y1="15"  x2="24"   y2="22.2" stroke="var(--logo-fg)" strokeWidth="1.4" strokeOpacity="0.45" strokeLinecap="round" />
      <line x1="13.2" y1="24"  x2="22.8" y2="24"   stroke="var(--logo-fg)" strokeWidth="1.4" strokeOpacity="0.45" strokeLinecap="round" />
    </svg>
  );
}

function ReflectionIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="11" fill="var(--logo-bg)" />
      <circle cx="18" cy="18" r="7" stroke="var(--logo-fg)" strokeWidth="1.8" strokeOpacity="0.9" />
      <line x1="18" y1="11" x2="18" y2="7"  stroke="var(--logo-fg)" strokeWidth="1.6" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="18" y1="25" x2="18" y2="29" stroke="var(--logo-fg)" strokeWidth="1.6" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="11" y1="18" x2="7"  y2="18" stroke="var(--logo-fg)" strokeWidth="1.6" strokeOpacity="0.6" strokeLinecap="round" />
      <line x1="25" y1="18" x2="29" y2="18" stroke="var(--logo-fg)" strokeWidth="1.6" strokeOpacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function CheckMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function HeaderBtn({
  onClick, children, style: extraStyle,
}: {
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "5px",
        padding: "5px 11px", borderRadius: "8px",
        border: "1px solid var(--border)", background: "transparent",
        color: "var(--text-2)", fontSize: "12.5px", fontWeight: 500,
        cursor: "pointer", transition: "all 0.12s",
        ...extraStyle,
      }}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = "var(--bg-hover)"; el.style.color = "var(--text-1)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = "var(--text-2)"; }}
    >
      {children}
    </button>
  );
}

function ModelPicker({ value, onChange }: { value: ModelKey; onChange: (m: ModelKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.key === value)!;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "5px 10px", borderRadius: "8px",
          border: "1px solid var(--border)",
          background: open ? "var(--bg-hover)" : "transparent",
          color: "var(--text-2)", fontSize: "12.5px", fontWeight: 500,
          cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = "var(--bg-hover)"; el.style.color = "var(--text-1)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = open ? "var(--bg-hover)" : "transparent"; el.style.color = "var(--text-2)"; }}
      >
        <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{current.label}</span>
        <span style={{ opacity: 0.7 }}>{current.sublabel}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="pop-in" style={{
          position: "absolute", bottom: "calc(100% + 7px)", left: 0,
          width: "190px", background: "var(--pop-bg)",
          border: "1px solid var(--border)", borderRadius: "12px",
          boxShadow: "var(--pop-shadow)", zIndex: 200, padding: "5px",
        }}>
          <p style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", padding: "5px 9px 3px" }}>Model</p>
          {MODELS.map((m) => (
            <button key={m.key} type="button"
              onClick={() => { onChange(m.key); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "8px 9px", borderRadius: "7px", border: "none",
                background: value === m.key ? "var(--accent-dim)" : "transparent",
                cursor: "pointer", transition: "background 0.1s", textAlign: "left",
              }}
              onMouseEnter={(e) => { if (value !== m.key) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = value === m.key ? "var(--accent-dim)" : "transparent"; }}
            >
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-1)" }}>{m.label}</span>
                <span style={{ fontSize: "11.5px", color: "var(--text-3)" }}>{m.sublabel}</span>
              </span>
              {value === m.key && <span style={{ color: "var(--accent)" }}><CheckMark /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PromptModal({ topic, objective, onClose, onConfirm }: {
  topic: string; objective: string; onClose: () => void; onConfirm?: (prompt: string) => void;
}) {
  const displayTopic     = topic.trim()     || "[TOPIC]";
  const displayObjective = objective.trim() || "[LEARNING OBJECTIVE]";
  const defaultPrompt = buildCoraPrompt(displayTopic, displayObjective);

  const [tab, setTab] = useState<"default" | "custom">("default");
  const [defaultText, setDefaultText] = useState(defaultPrompt);
  const [customText, setCustomText]   = useState("");

  const activeText = tab === "default" ? defaultText : customText;
  const setActiveText = tab === "default" ? setDefaultText : setCustomText;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px", borderRadius: "7px", border: "none",
    background: active ? "var(--bg-surface)" : "transparent",
    color: active ? "var(--text-1)" : "var(--text-3)",
    fontSize: "13px", fontWeight: active ? 600 : 400,
    cursor: "pointer", transition: "all 0.12s",
    boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
  });

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
    }}>
      <div className="pop-in" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: "640px", height: "80vh",
        background: "var(--pop-bg)", border: "1px solid var(--border)",
        borderRadius: "16px", boxShadow: "var(--pop-shadow)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-1)" }}>System prompt</p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "20px", lineHeight: 1, padding: "0 2px" }}>×</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", background: "var(--bg-secondary)", borderRadius: "9px", padding: "3px", width: "fit-content", marginBottom: "-1px" }}>
            <button style={tabStyle(tab === "default")} onClick={() => setTab("default")}>Default</button>
            <button style={tabStyle(tab === "custom")}  onClick={() => setTab("custom")}>Custom</button>
          </div>
        </div>

        {/* Helper text */}
        <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
          <p style={{ fontSize: "12px", color: "var(--text-3)" }}>
            {tab === "default"
              ? "Pre-built Cora prompt with your topic and objective. Edit freely."
              : "Write your own system prompt from scratch."}
          </p>
        </div>

        {/* Editable textarea */}
        <textarea
          key={tab}
          autoFocus
          value={activeText}
          onChange={(e) => setActiveText(e.target.value)}
          placeholder={tab === "custom" ? "Write your system prompt here…" : undefined}
          spellCheck={false}
          style={{
            flex: 1, padding: "12px 18px",
            fontSize: "12.5px", lineHeight: 1.75, color: "var(--text-2)",
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            background: "transparent", border: "none", outline: "none", resize: "none",
          }}
        />

        {/* Footer */}
        {onConfirm ? (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-3)", marginRight: "auto" }}>
              {activeText.trim().length === 0 && "Prompt cannot be empty"}
            </span>
            <button onClick={onClose} style={{
              padding: "9px 18px", borderRadius: "9px", border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-2)", fontSize: "13.5px",
              fontWeight: 500, cursor: "pointer",
            }}>
              ← Back
            </button>
            <button
              onClick={() => activeText.trim() && onConfirm(activeText)}
              disabled={!activeText.trim()}
              style={{
                padding: "9px 22px", borderRadius: "9px", border: "none",
                background: activeText.trim()
                  ? "linear-gradient(135deg, #3b5bdb 0%, #5b7cf0 100%)"
                  : "var(--border)",
                color: activeText.trim() ? "#fff" : "var(--text-3)",
                fontSize: "13.5px", fontWeight: 600,
                cursor: activeText.trim() ? "pointer" : "default",
                boxShadow: activeText.trim() ? "0 2px 10px rgba(59,91,219,0.35)" : "none",
                transition: "all 0.15s",
              }}
            >
              Confirm & start →
            </button>
          </div>
        ) : (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{
              padding: "9px 18px", borderRadius: "9px", border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-2)", fontSize: "13.5px",
              fontWeight: 500, cursor: "pointer",
            }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat message list + input (reused for both Cora and Reflection) ───────────

function ChatInput({
  input, setInput, onSend, loading, placeholder, model, onModelChange, showModelPicker,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  loading: boolean;
  placeholder: string;
  model: ModelKey;
  onModelChange: (m: ModelKey) => void;
  showModelPicker: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  const canSend = !!input.trim() && !loading;

  return (
    <div style={{ flexShrink: 0, padding: "10px 18px 18px", background: "var(--bg)" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <div
          style={{
            background: "var(--bg-surface)", borderRadius: "18px",
            border: "1.5px solid var(--border-strong)",
            boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
            padding: "12px 14px 10px", transition: "box-shadow 0.15s, border-color 0.15s",
          }}
          onFocusCapture={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = "var(--accent)";
            el.style.boxShadow = "0 2px 16px rgba(59,91,219,0.12), 0 0 0 3px rgba(59,91,219,0.08)";
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--border-strong)";
              el.style.boxShadow = "0 2px 16px rgba(0,0,0,0.07)";
            }
          }}
        >
          <textarea
            ref={ref}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            rows={1}
            style={{
              display: "block", width: "100%", resize: "none",
              background: "transparent", border: "none", outline: "none",
              fontSize: "14.5px", color: "var(--text-1)",
              lineHeight: 1.65, maxHeight: "200px", fontFamily: "inherit", minHeight: "24px",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
            {showModelPicker
              ? <ModelPicker value={model} onChange={onModelChange} />
              : <div />}
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "34px", height: "34px", borderRadius: "10px", border: "none",
                background: canSend ? "linear-gradient(135deg, #3b5bdb 0%, #5b7cf0 100%)" : "var(--border)",
                color: "#fff", cursor: canSend ? "pointer" : "default",
                transition: "all 0.15s",
                boxShadow: canSend ? "0 2px 8px rgba(59,91,219,0.4)" : "none",
              }}
              onMouseEnter={(e) => { if (canSend) (e.currentTarget as HTMLElement).style.transform = "scale(1.07)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: "11px", color: "var(--text-3)", marginTop: "7px" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ m, label, accentLabel }: { m: Message; label: string; accentLabel?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: "10px",
      flexDirection: m.role === "user" ? "row-reverse" : "row",
      alignItems: "flex-end",
    }}>
      {m.role === "assistant" && (
        <div style={{ flexShrink: 0, marginBottom: "2px" }}>
          {accentLabel ? <ReflectionIcon size={28} /> : <CoraIcon size={28} />}
        </div>
      )}
      <div style={{
        maxWidth: "72%", padding: "11px 15px",
        borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: m.role === "user" ? "var(--user-bubble)" : "var(--bot-bubble)",
        color: m.role === "user" ? "var(--user-text)" : "var(--bot-text)",
        fontSize: "14.5px", lineHeight: 1.6,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        boxShadow: m.role === "assistant" ? "var(--card-shadow)" : "none",
        border: m.role === "assistant" ? "1px solid var(--border)" : "none",
      }}>
        {m.role === "assistant" && (
          <p style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--accent)", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </p>
        )}
        {m.content}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [dark, setDark] = useState(false);
  const [model, setModel] = useState<ModelKey>("claude");
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptModalConfirmMode, setPromptModalConfirmMode] = useState(false);

  // Cora chat
  const [coraMessages, setCoraMessages] = useState<Message[]>([]);
  const [coraInput, setCoraInput] = useState("");
  const [coraLoading, setCoraLoading] = useState(false);
  // whether Cora's last message contained the done signal AND user has replied
  const [coraSessionDone, setCoraSessionDone] = useState(false);
  const [coraReflectionAsked, setCoraReflectionAsked] = useState(false);

  // Reflection chat
  const [reflMessages, setReflMessages] = useState<Message[]>([]);
  const [reflInput, setReflInput] = useState("");
  const [reflLoading, setReflLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const topicRef   = useRef<HTMLInputElement>(null);

  const isReady = topic.trim().length > 0 && objective.trim().length > 0;
  const currentModel = MODELS.find((m) => m.key === model)!;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coraMessages, reflMessages, coraLoading, reflLoading]);

  // Detect when Cora says she's done AND the user has subsequently replied
  useEffect(() => {
    if (phase !== "chatting" || coraMessages.length < 2) return;
    const lastAssistant = [...coraMessages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const isDone = lastAssistant.content.toLowerCase().includes(CORA_DONE_SIGNAL);
    if (!isDone) return;
    // Check if user has replied after the done message
    const doneIdx = coraMessages.lastIndexOf(lastAssistant);
    const userAfterDone = coraMessages.slice(doneIdx + 1).some((m) => m.role === "user");
    if (userAfterDone && !coraReflectionAsked) {
      setCoraSessionDone(true);
      setCoraReflectionAsked(true);
    }
  }, [coraMessages, phase, coraReflectionAsked]);

  // ── Setup handlers ────────────────────────────────────────────────────────

  function handleSetupKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && isReady) { e.preventDefault(); openConfirmModal(); }
  }

  function openConfirmModal() {
    if (!isReady) return;
    setPromptModalConfirmMode(true);
    setShowPromptModal(true);
  }

  function openViewModal() {
    setPromptModalConfirmMode(false);
    setShowPromptModal(true);
  }

  const [activeSystemPrompt, setActiveSystemPrompt] = useState("");

  const handleConfirmAndStart = useCallback(async (finalPrompt: string) => {
    setShowPromptModal(false);
    setPromptModalConfirmMode(false);
    setActiveSystemPrompt(finalPrompt);
    setPhase("chatting");
    setCoraMessages([]);
    setCoraSessionDone(false);
    setCoraReflectionAsked(false);
    setError(null);

    // Kick off Cora's opening message
    setCoraLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: finalPrompt,
          messages: [{ role: "user", content: "__start__" }],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`);
      setCoraMessages([{ role: "assistant", content: d.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCoraLoading(false);
    }
  }, [model]);

  function handleReset() {
    setPhase("setup");
    setCoraMessages([]);
    setReflMessages([]);
    setCoraInput("");
    setReflInput("");
    setCoraSessionDone(false);
    setCoraReflectionAsked(false);
    setError(null);
    setTimeout(() => topicRef.current?.focus(), 60);
  }

  // ── Cora send ─────────────────────────────────────────────────────────────

  async function sendCoraMessage() {
    const text = coraInput.trim();
    if (!text || coraLoading) return;

    const next: Message[] = [...coraMessages, { role: "user", content: text }];
    setCoraMessages(next);
    setCoraInput("");
    setCoraLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: activeSystemPrompt || buildCoraPrompt(topic.trim(), objective.trim()),
          messages: next,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`);
      setCoraMessages([...next, { role: "assistant", content: d.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCoraLoading(false);
    }
  }

  // ── Start reflection ──────────────────────────────────────────────────────

  async function startReflection() {
    setPhase("reflecting");
    setReflMessages([]);
    setReflLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: buildReflectionPrompt(topic.trim(), objective.trim()),
          messages: [{ role: "user", content: "__start__" }],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`);
      setReflMessages([{ role: "assistant", content: d.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReflLoading(false);
    }
  }

  // ── Reflection send ───────────────────────────────────────────────────────

  async function sendReflMessage() {
    const text = reflInput.trim();
    if (!text || reflLoading) return;

    const next: Message[] = [...reflMessages, { role: "user", content: text }];
    setReflMessages(next);
    setReflInput("");
    setReflLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: buildReflectionPrompt(topic.trim(), objective.trim()),
          messages: next,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `Request failed (${res.status})`);
      setReflMessages([...next, { role: "assistant", content: d.content }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReflLoading(false);
    }
  }

  // ── Transcript export ─────────────────────────────────────────────────────

  function handleDownload() {
    const text = formatTranscript(topic, objective, coraMessages, reflMessages);
    const slug = topic.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    downloadText(text, `cora-session-${slug}.txt`);
  }

  async function handleCopyTranscript() {
    const text = formatTranscript(topic, objective, coraMessages, reflMessages);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inSession = phase === "chatting" || phase === "reflecting";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", position: "relative", zIndex: 1 }}>

        {/* ── Header ── */}
        <header style={{
          flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 18px",
          borderBottom: "1px solid var(--border)", background: "var(--bg-surface)",
        }}>
          <button onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "9px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {phase === "reflecting" ? <ReflectionIcon size={30} /> : <CoraIcon size={30} />}
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              {phase === "reflecting" ? "Reflection" : "Cora"}
            </span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HeaderBtn onClick={openViewModal}><EyeIcon /> View prompt</HeaderBtn>

            {inSession && coraMessages.length > 0 && (
              <>
                <HeaderBtn onClick={handleCopyTranscript}>
                  {copied ? "Copied!" : "Copy transcript"}
                </HeaderBtn>
                <HeaderBtn onClick={handleDownload}><DownloadIcon /> Download</HeaderBtn>
              </>
            )}

            {inSession && (
              <HeaderBtn onClick={handleReset}>New session</HeaderBtn>
            )}

            <button
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "32px", height: "32px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-2)", cursor: "pointer", transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = "var(--bg-hover)"; el.style.color = "var(--text-1)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = "transparent"; el.style.color = "var(--text-2)"; }}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        {/* ── Setup ── */}
        {phase === "setup" && (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
            <div className="fade-up" style={{ width: "100%", maxWidth: "480px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
                <CoraIcon size={40} />
                <div>
                  <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", lineHeight: 1.2 }}>Hi, I'm Cora</h1>
                  <p style={{ fontSize: "13.5px", color: "var(--text-2)", marginTop: "2px" }}>An AI student for education research</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Topic</label>
                  <input
                    ref={topicRef}
                    autoFocus
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={handleSetupKey}
                    placeholder="e.g. Fractions, Photosynthesis, World War II…"
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: "10px",
                      border: "1.5px solid var(--border)", background: "var(--bg-surface)",
                      color: "var(--text-1)", fontSize: "14.5px", outline: "none",
                      transition: "border-color 0.15s", fontFamily: "inherit",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learning objective</label>
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    onKeyDown={handleSetupKey}
                    placeholder="Students will be able to…"
                    rows={3}
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: "10px",
                      border: "1.5px solid var(--border)", background: "var(--bg-surface)",
                      color: "var(--text-1)", fontSize: "14.5px", outline: "none", resize: "none",
                      lineHeight: 1.55, transition: "border-color 0.15s", fontFamily: "inherit",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                </div>
              </div>

              <button
                onClick={openConfirmModal}
                disabled={!isReady}
                style={{
                  width: "100%", padding: "12px", borderRadius: "10px", border: "none",
                  background: isReady ? "linear-gradient(135deg, #3b5bdb 0%, #5b7cf0 100%)" : "var(--border)",
                  color: isReady ? "#fff" : "var(--text-3)",
                  fontSize: "14.5px", fontWeight: 600,
                  cursor: isReady ? "pointer" : "default",
                  transition: "all 0.15s",
                  boxShadow: isReady ? "0 2px 12px rgba(59,91,219,0.3)" : "none",
                }}
                onMouseEnter={(e) => { if (isReady) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(59,91,219,0.4)"; }}
                onMouseLeave={(e) => { if (isReady) (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(59,91,219,0.3)"; }}
              >
                Review prompt & start →
              </button>
            </div>
          </div>
        )}

        {/* ── Cora chat ── */}
        {phase === "chatting" && (
          <>
            <main style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
              <div style={{ maxWidth: "680px", margin: "0 auto", paddingTop: "28px", paddingBottom: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "4px 13px", borderRadius: "99px",
                    border: "1px solid var(--border)", background: "var(--bg-surface)",
                    fontSize: "12px", color: "var(--text-3)",
                  }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>{topic}</span>
                    <span>·</span>
                    <span>{currentModel.label} {currentModel.sublabel}</span>
                  </div>
                </div>

                {coraMessages.map((m, i) => (
                  <div key={i} className="msg-in">
                    <MessageBubble m={m} label="Cora" />
                  </div>
                ))}

                {coraLoading && (
                  <div className="msg-in" style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                    <div style={{ flexShrink: 0, marginBottom: "2px" }}><CoraIcon size={28} /></div>
                    <div style={{
                      padding: "13px 16px", borderRadius: "18px 18px 18px 4px",
                      background: "var(--bot-bubble)", border: "1px solid var(--border)",
                      boxShadow: "var(--card-shadow)",
                    }}>
                      <p style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--accent)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cora</p>
                      <TypingDots />
                    </div>
                  </div>
                )}

                {error && (
                  <div style={{ textAlign: "center", fontSize: "13px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 16px" }}>
                    {error}
                  </div>
                )}

                {/* Reflection prompt banner */}
                {coraSessionDone && !coraLoading && (
                  <div className="fade-up" style={{
                    background: "var(--accent-dim)", border: "1.5px solid var(--accent)",
                    borderRadius: "14px", padding: "18px 20px", textAlign: "center",
                  }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-1)", marginBottom: "6px" }}>
                      Session complete 🎉
                    </p>
                    <p style={{ fontSize: "13px", color: "var(--text-2)", marginBottom: "14px" }}>
                      Ready to reflect on your teaching experience?
                    </p>
                    <button
                      onClick={startReflection}
                      style={{
                        padding: "9px 22px", borderRadius: "9px", border: "none",
                        background: "linear-gradient(135deg, #3b5bdb 0%, #5b7cf0 100%)",
                        color: "#fff", fontSize: "13.5px", fontWeight: 600,
                        cursor: "pointer", boxShadow: "0 2px 10px rgba(59,91,219,0.35)",
                      }}
                    >
                      Continue to Reflection →
                    </button>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </main>

            <ChatInput
              input={coraInput} setInput={setCoraInput}
              onSend={sendCoraMessage} loading={coraLoading}
              placeholder={`Teach Cora about ${topic}…`}
              model={model} onModelChange={setModel} showModelPicker
            />
          </>
        )}

        {/* ── Reflection ── */}
        {phase === "reflecting" && (
          <>
            <main style={{ flex: 1, overflowY: "auto", padding: "0 18px" }}>
              <div style={{ maxWidth: "680px", margin: "0 auto", paddingTop: "28px", paddingBottom: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "4px 13px", borderRadius: "99px",
                    border: "1px solid var(--border)", background: "var(--bg-surface)",
                    fontSize: "12px", color: "var(--text-3)",
                  }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>Reflection</span>
                    <span>·</span>
                    <span>{topic}</span>
                  </div>
                </div>

                {reflMessages.map((m, i) => (
                  <div key={i} className="msg-in">
                    <MessageBubble m={m} label="Reflection Coach" accentLabel />
                  </div>
                ))}

                {reflLoading && (
                  <div className="msg-in" style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                    <div style={{ flexShrink: 0, marginBottom: "2px" }}><ReflectionIcon size={28} /></div>
                    <div style={{
                      padding: "13px 16px", borderRadius: "18px 18px 18px 4px",
                      background: "var(--bot-bubble)", border: "1px solid var(--border)",
                      boxShadow: "var(--card-shadow)",
                    }}>
                      <p style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--accent)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Reflection Coach</p>
                      <TypingDots />
                    </div>
                  </div>
                )}

                {error && (
                  <div style={{ textAlign: "center", fontSize: "13px", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 16px" }}>
                    {error}
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </main>

            <ChatInput
              input={reflInput} setInput={setReflInput}
              onSend={sendReflMessage} loading={reflLoading}
              placeholder="Reflect on your teaching experience…"
              model={model} onModelChange={setModel} showModelPicker={false}
            />
          </>
        )}
      </div>

      {/* ── Prompt modal ── */}
      {showPromptModal && (
        <PromptModal
          topic={topic}
          objective={objective}
          onClose={() => { setShowPromptModal(false); setPromptModalConfirmMode(false); }}
          onConfirm={promptModalConfirmMode ? handleConfirmAndStart : undefined}
        />
      )}
    </>
  );
}
