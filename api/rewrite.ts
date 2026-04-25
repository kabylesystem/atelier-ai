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

const systemPrompt = `
You are an expert GPT Image 2 prompt compiler.
Rewrite messy user image ideas into premium, copy-paste-ready prompts for GPT Image 2.
Do not generate the image. Only write the prompt.

Rules:
- Preserve the selected character identity memory.
- Expand vague scenes into concrete visual scenes with objects, camera, light, physical details, and constraints.
- Make the prompt feel like a professional creative brief, not keyword stuffing.
- If the user asks for realism, optimize for raw phone-photo believability.
- Use concise sections: Image settings, Core scene, Character continuity, Camera, Lighting, Realism rules, Negative.
- The finalPrompt should be detailed enough to materially improve the user's raw prompt, usually 220-420 words.
- Add concrete environmental details inferred from the scene: materials, background objects, social context, imperfections, real-world mess, and plausible lighting sources.
- For scenes with multiple people, explicitly describe relationship energy, separate faces, posture, and natural interaction.
- Avoid policy-unsafe or sexualized content. Keep characters adult only when implied by the avatar profile; otherwise stay neutral.
- Return strict JSON only.
`;

function fallbackPrompt(body: any) {
  return {
    finalPrompt: body?.localDraft?.finalPrompt || "Could not rewrite prompt.",
    structuredPrompt: body?.localDraft?.structuredPrompt || "{}",
    score: body?.localDraft?.score || 70,
    suggestions: ["Smart rewrite unavailable; local compiler fallback used."],
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  try {
    const body = req.body || {};
    const payload = {
      rawPrompt: body.rawPrompt,
      avatar: body.avatar,
      controls: body.controls,
      localDraft: body.localDraft,
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_REWRITE_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Rewrite this messy prompt into a GPT Image 2 prompt. Return JSON with finalPrompt, structuredPrompt, score, suggestions.\n\n" +
            JSON.stringify(payload, null, 2),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "compiled_image_prompt",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              finalPrompt: { type: "string" },
              structuredPrompt: { type: "string" },
              score: { type: "number" },
              suggestions: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["finalPrompt", "structuredPrompt", "score", "suggestions"],
          },
        },
      },
    });

    const raw = response.output_text;
    const parsed = JSON.parse(raw);
    res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    res.status(200).json(fallbackPrompt(req.body));
  }
}
