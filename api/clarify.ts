import OpenAI from "openai";
import { existsSync, readFileSync } from "node:fs";

if (!process.env.OPENAI_API_KEY && existsSync(".env.local")) {
  const env = readFileSync(".env.local", "utf8");
  const match = env.match(/^OPENAI_API_KEY=(.+)$/m);
  if (match) process.env.OPENAI_API_KEY = match[1].trim();
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function fallbackQuestions(medium: "photo" | "video") {
  if (medium === "video") {
    return [
      {
        id: "motion",
        label: "Action",
        question: "What should move?",
        options: ["Subtle natural gesture", "Camera follows the subject", "Background activity", "Product / object reveal"],
      },
      {
        id: "camera",
        label: "Camera",
        question: "How should it feel filmed?",
        options: ["Raw phone video", "Smooth cinematic", "Webcam / screen recording", "Security / fixed camera"],
      },
      {
        id: "ending",
        label: "Ending",
        question: "Where should the clip land?",
        options: ["Natural held moment", "Funny reaction", "Clean reveal", "Loopable final frame"],
      },
    ];
  }

  return [
    {
      id: "look",
      label: "Look",
      question: "What should the image feel like?",
      options: ["Raw phone photo", "Polished commercial", "Candid social post", "Editorial poster"],
    },
    {
      id: "focus",
      label: "Focus",
      question: "What matters most?",
      options: ["Character identity", "Full environment", "The object/product", "Exact text / UI"],
    },
    {
      id: "mood",
      label: "Mood",
      question: "What vibe should lead?",
      options: ["Intimate and real", "Funny and chaotic", "Premium and clean", "Dark and dramatic"],
    },
  ];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const medium = body.medium === "video" ? "video" : "photo";

  if (!process.env.OPENAI_API_KEY) {
    res.status(200).json({ questions: fallbackQuestions(medium) });
    return;
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_REWRITE_MODEL || "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content:
            "Create 3 tiny clarification questions for improving an image/video generation prompt. Keep it simple. Each question must have 4 short predefined answers. Questions must be different for photo vs video. For video, ask about motion, camera feel, and ending/continuity. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            rawPrompt: body.rawPrompt || "",
            medium,
            avatar: body.avatar || {},
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "clarifying_questions",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              questions: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    question: { type: "string" },
                    options: {
                      type: "array",
                      minItems: 4,
                      maxItems: 4,
                      items: { type: "string" },
                    },
                  },
                  required: ["id", "label", "question", "options"],
                },
              },
            },
            required: ["questions"],
          },
        },
      },
    });

    res.status(200).json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    res.status(200).json({ questions: fallbackQuestions(medium) });
  }
}
