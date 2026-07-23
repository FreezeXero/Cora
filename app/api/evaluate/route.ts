import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const { objectives, messages } = (await request.json()) as {
    objectives: string[];
    messages: Message[];
  };

  if (!objectives?.length || !messages?.length) {
    return Response.json({ results: (objectives ?? []).map(() => false) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ results: objectives.map(() => false) });
  }

  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Cora" : "Teacher"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are a strict evaluator of a teaching conversation. Your job is to determine which learning objectives the TEACHER (labeled "Teacher") has genuinely met. Be conservative — when in doubt, return false.

An objective is met (true) ONLY if the teacher has explicitly explained the concept in their own words with sufficient depth. Apply these rules strictly:

- Briefly mentioning a term or concept is NOT enough.
- Cora inferring or restating something the teacher implied is NOT enough.
- The teacher must have actually explained the idea themselves, not just agreed with Cora's description.
- For any objective about explaining WHY something is true, the teacher must have conveyed the reasoning or mechanism — either through a direct explanation OR through a concrete example that clearly illustrates the cause and effect. A numerical example that demonstrates the outcome (e.g., "$1,000 growing to $15,000 over 40 years") counts as a valid explanation of why something works, as long as it clearly shows the relationship. Simply stating a conclusion without any supporting reasoning or example does NOT count.

Learning objectives:
${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Transcript:
${transcript}

Return ONLY a JSON boolean array with one value per objective. true = teacher explicitly and clearly explained this in their own words. false = not yet met. No markdown, no explanation, just the array. Example: [true, false, true]`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const results = JSON.parse(text);
    if (Array.isArray(results) && results.length === objectives.length) {
      return Response.json({ results });
    }
    return Response.json({ results: objectives.map(() => false) });
  } catch {
    return Response.json({ results: objectives.map(() => false) });
  }
}
