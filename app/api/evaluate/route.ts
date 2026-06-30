import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const { objectives, messages } = (await request.json()) as {
    objectives: string[];
    messages: Message[];
  };

  if (!objectives?.length || !messages?.length) {
    return Response.json({ results: [...(objectives ?? []).map(() => false), false] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ results: [...objectives.map(() => false), false] });
  }

  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Cora" : "Teacher"}: ${m.content}`)
    .join("\n\n");

  const prompt = `You are evaluating a teaching conversation. Based on the transcript below, determine which learning objectives have been clearly addressed by the teacher, and whether the AI student asked at least one deeper follow-up question that goes beyond the stated objectives (e.g. asking for a real-world example, exploring consequences, or connecting concepts).

Learning objectives:
${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Transcript:
${transcript}

Return ONLY a JSON array. The first ${objectives.length} values are booleans (true/false) for each objective in order. The last value is a boolean for whether at least one "going deeper" question was asked (a question that meaningfully extends beyond just covering the listed objectives). No markdown, no explanation, just the array. Example for ${objectives.length} objectives: [true, false, true, false]`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const results = JSON.parse(text);
    if (Array.isArray(results) && results.length === objectives.length + 1) {
      return Response.json({ results });
    }
    // Fallback: if we got exactly objectives.length booleans, append false for goingDeeper
    if (Array.isArray(results) && results.length === objectives.length) {
      return Response.json({ results: [...results, false] });
    }
    return Response.json({ results: [...objectives.map(() => false), false] });
  } catch {
    return Response.json({ results: [...objectives.map(() => false), false] });
  }
}
