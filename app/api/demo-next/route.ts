import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

type Message = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPTS = {
  chatting:
    "You are helping someone demo a peer-teaching app. They are playing the role of a teacher explaining a topic to an AI student named Cora. Generate the next thing the teacher should say to naturally continue the conversation and help cover any remaining learning objectives. Keep it casual, 1-3 sentences max, sound like a real person talking not a textbook, no em dashes. Only return the message text, nothing else.",
  reflecting:
    "You are helping someone demo a peer-teaching app. They just finished teaching an AI student named Cora and are now in a reflection conversation with a coach. Generate the next thing the person should say as a thoughtful, genuine reflection on their teaching experience. Keep it natural and personal, 1-3 sentences, no em dashes. Only return the message text, nothing else.",
};

export async function POST(request: NextRequest) {
  const { topic, objectives, loStatus, messages, phase = "chatting" } = (await request.json()) as {
    topic: string;
    objectives: string[];
    loStatus: boolean[];
    messages: Message[];
    phase?: "chatting" | "reflecting";
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const assistantLabel = phase === "reflecting" ? "Coach" : "Cora";
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? assistantLabel : "Teacher"}: ${m.content}`)
    .join("\n\n");

  let userMessage: string;
  if (phase === "reflecting") {
    userMessage = [
      `Topic that was taught: ${topic}`,
      `Learning objectives: ${objectives.map((o, i) => `${i + 1}. ${o}`).join("; ")}`,
      "",
      "Reflection conversation so far:",
      transcript || "(Coach just asked their opening question, person hasn't responded yet)",
      "",
      "What should the person say next in the reflection?",
    ].join("\n");
  } else {
    const uncovered = objectives.filter((_, i) => !loStatus[i]);
    userMessage = [
      `Topic: ${topic}`,
      `All objectives: ${objectives.map((o, i) => `${i + 1}. ${o}`).join("; ")}`,
      uncovered.length > 0
        ? `Still needs to be covered: ${uncovered.join("; ")}`
        : "All objectives have been covered.",
      "",
      "Conversation so far:",
      transcript || "(Cora just introduced herself, teacher hasn't spoken yet)",
      "",
      "What should the teacher say next?",
    ].join("\n");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPTS[phase] ?? SYSTEM_PROMPTS.chatting,
    });
    const result = await model.generateContent(userMessage);
    const message = result.response.text().trim();
    return Response.json({ message });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error }, { status: 500 });
  }
}
