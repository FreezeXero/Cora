import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const { model, systemPrompt, messages } = (await request.json()) as {
    model: "claude" | "gemini";
    systemPrompt: string;
    messages: Message[];
  };

  if (!messages?.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  // __start__ is a client-side trigger to get the AI's opening message.
  // Replace it with a neutral prompt so the system prompt's opening line fires naturally.
  const normalizedMessages = messages.map((m) =>
    m.content === "__start__" ? { ...m, content: "Please introduce yourself and begin." } : m
  );

  try {
    if (model === "claude") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
      }
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: normalizedMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      const content =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      return Response.json({ content });
    }

    if (model === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
      });

      // Gemini requires history to start with a user message — drop any leading assistant turns.
      const historyRaw = normalizedMessages.slice(0, -1);
      const firstUserIdx = historyRaw.findIndex((m) => m.role === "user");
      const history = (firstUserIdx === -1 ? [] : historyRaw.slice(firstUserIdx)).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chat = geminiModel.startChat({ history });
      const lastMessage = normalizedMessages[normalizedMessages.length - 1].content;
      const result = await chat.sendMessage(lastMessage);
      const content = result.response.text();
      return Response.json({ content });
    }

    return Response.json({ error: "Unknown model" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
