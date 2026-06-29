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

  const prompt = `You are evaluating a teaching conversation. Based on the transcript below, determine which learning objectives have been clearly addressed by the teacher.

Learning objectives:
${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Transcript:
${transcript}

Return ONLY a JSON boolean array with one value per objective, true if the objective has been clearly covered, false if not. No markdown, no explanation, just the array. Example: [true, false, true]`;

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
