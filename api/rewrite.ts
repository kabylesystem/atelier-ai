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

const MAX_PROMPT_CHARS = 3000;

function enforcePromptLimit(prompt: string, max = MAX_PROMPT_CHARS): string {
  if (prompt.length <= max) return prompt;

  const suffix = `\n\n[Trimmed to stay under ${max} chars.]`;
  const hardLimit = max - suffix.length;
  const trimmed = prompt.slice(0, hardLimit);
  const cleanBreak = Math.max(
    trimmed.lastIndexOf("\n\n"),
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("; "),
  );
  const safeText = cleanBreak > 1600 ? trimmed.slice(0, cleanBreak + 1) : trimmed;
  return `${safeText.trim()}${suffix}`;
}

const systemPrompt = `
You are an expert image/video prompt compiler.
Rewrite messy user ideas into premium, copy-paste-ready prompts for the selected output medium.
Do not generate the image or video. Only write the prompt.

Rules:
- controls.medium is critical. If controls.medium is "photo", write a still-image prompt. If controls.medium is "video", write a video prompt with motion, timing, frame continuity, and camera movement.
- Use clarificationAnswers as the user's explicit creative direction. Work them into the finalPrompt naturally and prioritize them over generic defaults.
- The finalPrompt MUST be under 3000 characters. Prefer dense, specific language over long essays.
- Preserve the selected character identity memory.
- Expand vague scenes into concrete visual scenes with objects, camera, light, physical details, and constraints.
- Make the prompt feel like a professional creative brief, not keyword stuffing.
- If the user asks for realism, optimize for raw phone-photo believability.
- Use concise labeled sections separated by blank lines (NOT JSON). For photo: Image settings, Core scene, Reference image, Character continuity, Environment & background detail, Camera, Lighting, Realism rules, Negative. For video: Video settings, Core action, Reference image, Character continuity, Motion & timing, Environment & background action, Camera movement, Lighting continuity, Realism rules, Negative.
- ALWAYS include a "Reference image" section. If avatar.images has N>0 items, state that N reference photo(s) of the character are attached to this generation and the model must use them as the strict source of truth for face, identity, age, body proportions, and skin tone — no redesign, no beautification, same person across outputs. The first image is the canonical face. If avatar.images is empty, still include the section and instruct the model to treat the identity description as canonical face memory.
- ALWAYS include an "Environment & background detail" section that treats the background as equally important as the subject. Describe three depth layers (foreground / midground / background), name 4–6 concrete secondary props plausible for the location (e.g. recording studio → mixing console knobs, monitor speakers, cable spaghetti, acoustic foam panels, framed records, candle, RGB ambient strip), name visible practical light sources, and include real-world imperfections (dust, scuffs, scratches). The output prompt MUST explicitly forbid flat / empty / blurred / studio-backdrop backgrounds unless the user asked for shallow depth-of-field.
- For video, also include action beats: opening frame, main movement, ending frame, subject micro-expression, hand/body movement, background motion, camera move, and temporal continuity. Turn even a stupid/simple raw idea into a strong video prompt.
- For video, explicitly forbid face morphing, identity drift, warped hands, melting objects, sudden outfit changes, random scene cuts, looping glitches, and unstable text.
- If the user provided a precise device camera spec in controls.shot (focal length, aperture, sensor traits), preserve those numeric details verbatim in the Camera section — do not generalize them.
- DEVICE COHERENCE IS CRITICAL: detect the camera type from controls.shot. If it mentions CCTV / security camera, GoPro, webcam / FaceTime, or budget Android, the entire prompt MUST reflect that camera's signature consistently. Do NOT add any "candid smartphone" / "raw iPhone" / "selfie" / "social-media phone capture" language anywhere. Core scene, Reference image, Character continuity, Environment, Camera, Lighting, and Realism rules must all describe the same camera. Never mix smartphone realism with non-smartphone devices — pick one and stay consistent.
- For CCTV: top-down or fixed wall-mount perspective, the subject is captured incidentally (not a posed selfie), no outstretched arm, no phone in hand unless requested.
- For webcam/FaceTime: subject faces the laptop screen, frontal flat lighting, no selfie arm.
- For GoPro: handheld or chest-mounted, wide fisheye, action context.
- The finalPrompt should be detailed enough to materially improve the user's raw prompt, while staying under 3000 characters.
- Add concrete environmental details inferred from the scene: materials, background objects, social context, imperfections, real-world mess, and plausible lighting sources.
- For scenes with multiple people, explicitly describe relationship energy, separate faces, posture, and natural interaction.
- Avoid policy-unsafe or sexualized content. Keep characters adult only when implied by the avatar profile; otherwise stay neutral.
- Return strict JSON only (the wrapper response is JSON; the finalPrompt string itself must be plain natural-language sections with linebreaks, NOT a JSON object).
`;

function fallbackPrompt(body: any) {
  return {
    finalPrompt: enforcePromptLimit(body?.localDraft?.finalPrompt || "Could not rewrite prompt."),
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
    const avatar = body.avatar || {};
    const referenceImageCount = typeof body.referenceImageCount === "number" ? body.referenceImageCount : 0;
    const payload = {
      rawPrompt: body.rawPrompt,
      avatar: {
        name: avatar.name,
        role: avatar.role,
        identity: avatar.identity,
        visualMemory: avatar.visualMemory,
        promptRules: avatar.promptRules,
      },
      referenceImageCount,
      controls: body.controls,
      clarificationAnswers: body.clarificationAnswers || [],
      localDraft: body.localDraft,
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_REWRITE_MODEL || "gpt-5.4-mini",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Rewrite this messy prompt for the selected medium. Return JSON with finalPrompt, structuredPrompt, score, suggestions. finalPrompt must be under 3000 characters.\n\n" +
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
    parsed.finalPrompt = enforcePromptLimit(String(parsed.finalPrompt || ""));
    res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    res.status(200).json(fallbackPrompt(req.body));
  }
}
