import {
  Brain,
  Check,
  ChevronRight,
  Clipboard,
  FileJson,
  History,
  Plus,
  Save,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Users,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

type Intent =
  | "photoreal"
  | "screen"
  | "avatar"
  | "poster"
  | "product"
  | "edit";

type Avatar = {
  id: string;
  name: string;
  role: string;
  identity: string;
  visualMemory: string;
  promptRules: string;
  imageUrl?: string;
  accent?: string;
};

type Controls = {
  intent: Intent;
  aspectRatio: string;
  realism: "raw" | "polished" | "stylized";
  shot: string;
  lighting: string;
  preserveIdentity: boolean;
  exactText: string;
  negative: string[];
};

type HistoryItem = {
  id: string;
  avatarId: string;
  createdAt: string;
  rawPrompt: string;
  finalPrompt: string;
  structuredPrompt: string;
  score: number;
};

type CompiledPrompt = {
  finalPrompt: string;
  structuredPrompt: string;
  score: number;
  suggestions: string[];
};

type StoredState = {
  avatars: Avatar[];
  activeAvatarId: string;
  history: HistoryItem[];
};

type Page = "characters" | "prompt" | "direction" | "output" | "history";

const STORAGE_KEY = "prompt-compiler-local-state-v1";
const studioImages = {
  nightDesk: "/desk-night.jpg",
  cleanDesk: "/desk-clean.jpg",
};

const defaultAvatars: Avatar[] = [
  {
    id: "jane",
    name: "Jane",
    role: "AI avatar, candid UGC creator",
    identity:
      "Keep Jane recognizable across generations: same face proportions, natural expression, relaxed presence, no beautifying or face redesign.",
    visualMemory:
      "Candid smartphone realism, intimate bedroom or apartment scenes, believable screen glow, natural skin texture, casual fitted tops, minimal makeup.",
    promptRules:
      "Prioritize raw realism, identity lock, imperfect physical details, and non-studio lighting. Avoid influencer polish unless asked.",
    imageUrl: "",
    accent: "#ff5d8f",
  },
  {
    id: "new-avatar",
    name: "New Avatar",
    role: "Flexible reusable character",
    identity:
      "Preserve the same facial proportions, age range, body shape, expression language, and styling logic across prompts.",
    visualMemory:
      "Define this avatar's stable wardrobe, environment, camera language, and emotional range here.",
    promptRules:
      "Restate identity constraints every time and keep edits surgical unless the raw prompt asks for a redesign.",
    imageUrl: "",
    accent: "#6c5ce7",
  },
];

const intentLabels: Record<Intent, string> = {
  photoreal: "Photoreal",
  screen: "Screen / UI",
  avatar: "Avatar",
  poster: "Poster",
  product: "Product",
  edit: "Edit",
};

const negativeOptions = [
  "AI look",
  "beauty filter",
  "studio lighting",
  "plastic skin",
  "watermark",
  "extra fingers",
  "blurry face",
  "wrong text",
  "flat screenshot",
  "random logos",
];

const defaultControls: Controls = {
  intent: "photoreal",
  aspectRatio: "3:4 vertical",
  realism: "raw",
  shot: "high-angle candid smartphone photo",
  lighting: "low-light mixed screen glow and warm ambient light",
  preserveIdentity: true,
  exactText: "",
  negative: ["AI look", "beauty filter", "studio lighting", "watermark"],
};

const shotTemplates = [
  "raw iPhone mirror selfie, slightly tilted, close distance",
  "high-angle candid smartphone photo, subject framed off-center",
  "vertical iPhone selfie, close social distance, imperfect crop",
  "MacBook screen photographed from above, keyboard barely visible",
  "over-the-shoulder phone shot, casual framing, real-world perspective",
  "front-facing webcam preview photographed from a phone",
];

const lightingTemplates = [
  "low-light screen glow with warm ambient bedroom light",
  "late-night fast-food shop lighting, mixed fluorescent and warm grill glow",
  "cool laptop glow on face, dark room, soft shadows",
  "golden hour window light, warm skin tones, natural contrast",
  "direct flash smartphone photo, harsh shadow, raw party-photo realism",
  "overcast daylight through window, soft shadows, realistic muted colors",
];

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { avatars: defaultAvatars, activeAvatarId: "jane", history: [] };
    }
    const parsed = JSON.parse(raw) as StoredState;
    return {
      avatars: parsed.avatars?.length ? parsed.avatars : defaultAvatars,
      activeAvatarId: parsed.activeAvatarId || "jane",
      history: parsed.history || [],
    };
  } catch {
    return { avatars: defaultAvatars, activeAvatarId: "jane", history: [] };
  }
}

function saveStoredState(state: StoredState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function inferRawDetails(rawPrompt: string): string {
  const cleaned = rawPrompt.trim();
  if (!cleaned) {
    return "No raw idea provided yet. Ask for the subject, scene, mood, and any required text before final generation.";
  }
  return cleaned
    .replace(/\s+/g, " ")
    .replace(/^make\s+/i, "Create ")
    .replace(/^fait\s+/i, "Create ");
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function enhanceCoreRequest(rawPrompt: string, avatar: Avatar, controls: Controls): string {
  const idea = inferRawDetails(rawPrompt);
  const lower = idea.toLowerCase();
  if (!rawPrompt.trim()) return idea;

  const subjectName = avatar.name || "the selected character";
  const details: string[] = [`Create a ${controls.aspectRatio} image based on this idea: ${idea}.`];

  if (includesAny(lower, ["kebab", "shawarma", "tacos", "fast food", "snack", "restaurant"])) {
    details.push(
      `${subjectName} is inside a real late-night kebab shop with her friend, close together in a casual candid moment, as if one of them just pulled out a phone to take a quick photo.`,
      "Include believable kebab-shop details: stainless steel counter, vertical meat rotisserie, sauce bottles, wrapped sandwiches, tiled wall, printed menu boards, napkins, plastic trays, and a few background customers softly out of focus.",
      "The mood should feel social, spontaneous, slightly chaotic, and ordinary, not staged or influencer-polished.",
    );
  }

  if (includesAny(lower, ["copine", "friend", "bff", "amie"])) {
    details.push(
      "The friend should look like a real separate person with her own face, posture, outfit, and expression. They should feel comfortable together, laughing or leaning naturally into the frame.",
    );
  }

  if (includesAny(lower, ["macbook", "spotify", "photobooth", "screen", "laptop"])) {
    details.push(
      "Make it a photo of a physical laptop screen rather than a clean screenshot, with reflections, pixel texture, screen glare, dust, and imperfect phone-camera exposure.",
    );
  }

  if (includesAny(lower, ["iphone", "selfie", "mirror", "photo", "ugc", "snap"])) {
    details.push(
      "Use raw smartphone-photo language: imperfect framing, slight motion softness, natural skin texture, tiny exposure flaws, and a casual social-media capture feeling.",
    );
  }

  if (includesAny(lower, ["nuit", "night", "soir", "dark", "late"])) {
    details.push(
      "Set the lighting at night with mixed practical light, warm indoor spill, cooler phone-screen highlights, and believable low-light noise.",
    );
  }

  if (controls.intent === "photoreal") {
    details.push("Do not make it look like a fashion shoot; it should feel like a real memory caught on a phone.");
  }

  if (controls.intent === "avatar" || controls.preserveIdentity) {
    details.push(`Keep ${subjectName}'s identity consistent while adapting clothing, pose, and environment to the scene.`);
  }

  return details.join(" ");
}

function buildIntentBlock(intent: Intent): string {
  if (intent === "screen") {
    return [
      "Create a realistic photograph of a physical screen, not a flat screenshot.",
      "Show believable device glass, RGB pixel grid, slight moire, dust, fingerprints, reflections, and imperfect exposure.",
      "The UI must feel like a shipped product with clear hierarchy, realistic spacing, readable labels, and no fake placeholder clutter.",
    ].join(" ");
  }

  if (intent === "avatar") {
    return [
      "Create a continuity-safe avatar image for a recurring AI character.",
      "The image should preserve identity, proportions, styling logic, and emotional tone across future generations.",
      "Avoid redesigning the character unless explicitly requested.",
    ].join(" ");
  }

  if (intent === "poster") {
    return [
      "Create a finished editorial poster or campaign visual with deliberate layout hierarchy.",
      "Typography, spacing, margins, and visual rhythm must feel print-ready and intentional.",
      "Use exact text only where specified and avoid duplicate or invented copy.",
    ].join(" ");
  }

  if (intent === "product") {
    return [
      "Create a production-quality product visual with accurate materials, believable reflections, and clear commercial composition.",
      "Preserve product geometry and label logic. Use controlled lighting and clean visual hierarchy.",
    ].join(" ");
  }

  if (intent === "edit") {
    return [
      "Treat this as a surgical image edit or compositing brief.",
      "Change only the requested elements and preserve identity, camera angle, layout, lighting, proportions, and surrounding context.",
    ].join(" ");
  }

  return [
    "Create a photorealistic image that feels captured in the real world.",
    "Prioritize believable physics, natural lighting, real camera imperfections, and ordinary lived-in details.",
  ].join(" ");
}

function buildRealismRules(realism: Controls["realism"], intent: Intent): string {
  if (realism === "stylized") {
    return "Stylization rules: coherent art direction, controlled palette, intentional texture, no generic AI fantasy polish, no random decorative clutter.";
  }

  if (realism === "polished") {
    return "Production rules: high-end but believable finish, clean composition, precise materials, refined lighting, professional color management, no over-sharpened CGI look.";
  }

  const screenDetail =
    intent === "screen"
      ? " visible pixel grid, subtle moire, imperfect glass, screen glare,"
      : "";

  return `Realism rules: raw smartphone photo look,${screenDetail} natural sensor noise, imperfect focus falloff, believable shadows, real surface texture, no studio polish, no AI look.`;
}

function compilePrompt(rawPrompt: string, avatar: Avatar, controls: Controls): CompiledPrompt {
  const idea = enhanceCoreRequest(rawPrompt, avatar, controls);
  const exactText = controls.exactText.trim();
  const negative = controls.negative.join(", ");
  const identityLock = controls.preserveIdentity
    ? avatar.identity
    : "Identity can vary if the prompt requires it, but keep the subject coherent and physically believable.";

  const sections = {
    image_settings: {
      aspect_ratio: controls.aspectRatio,
      intent: intentLabels[controls.intent],
      realism_mode: controls.realism,
    },
    subject_brief: idea,
    avatar_memory: {
      selected_avatar: avatar.name,
      role: avatar.role,
      visual_memory: avatar.visualMemory,
      prompt_rules: avatar.promptRules,
    },
    scene_direction: buildIntentBlock(controls.intent),
    camera_and_light: {
      shot: controls.shot,
      lighting: controls.lighting,
      composition:
        "Make the first read obvious, then support it with secondary details. Keep every important object physically grounded.",
    },
    identity_lock: identityLock,
    text_rules: exactText
      ? `Render this exact text verbatim: "${exactText}". No extra words, no duplicate text, no misspellings.`
      : "Do not add text unless the raw prompt explicitly asks for it.",
    realism_rules: buildRealismRules(controls.realism, controls.intent),
    negative_prompt: negative,
  };

  const finalPrompt = [
    `Image settings: ${controls.aspectRatio}. Intent: ${intentLabels[controls.intent]}.`,
    "",
    `Core request: ${idea}`,
    "",
    `Selected character: ${avatar.name} — ${avatar.role}.`,
    `Avatar memory: ${avatar.visualMemory}`,
    "",
    `Scene direction: ${sections.scene_direction}`,
    "",
    `Camera and composition: ${controls.shot}. ${controls.lighting}. Make the image feel composed but not artificial. Keep the first read obvious and all important objects physically grounded.`,
    "",
    `Identity lock: ${identityLock}`,
    "",
    `Text rules: ${sections.text_rules}`,
    "",
    sections.realism_rules,
    "",
    `Negative: ${negative}.`,
  ].join("\n");

  const structuredPrompt = JSON.stringify(sections, null, 2);
  const score = scorePrompt(rawPrompt, controls, avatar);
  const suggestions = getSuggestions(rawPrompt, controls);

  return { finalPrompt, structuredPrompt, score, suggestions };
}

function scorePrompt(rawPrompt: string, controls: Controls, avatar: Avatar): number {
  let score = 35;
  if (rawPrompt.trim().length > 20) score += 15;
  if (controls.shot.trim()) score += 10;
  if (controls.lighting.trim()) score += 10;
  if (controls.preserveIdentity && avatar.identity.trim().length > 30) score += 10;
  if (controls.negative.length >= 4) score += 10;
  if (controls.intent === "poster" || controls.intent === "screen") {
    score += controls.exactText.trim() ? 10 : 0;
  } else {
    score += 5;
  }
  return Math.min(score, 100);
}

function getSuggestions(rawPrompt: string, controls: Controls): string[] {
  const suggestions: string[] = [];
  if (rawPrompt.trim().length < 20) suggestions.push("Ajoute le sujet principal et le contexte.");
  if (!controls.shot.trim()) suggestions.push("Choisis un cadrage ou un point de vue.");
  if (!controls.lighting.trim()) suggestions.push("Décris la lumière, c'est souvent le levier le plus fort.");
  if ((controls.intent === "poster" || controls.intent === "screen") && !controls.exactText.trim()) {
    suggestions.push("Ajoute le texte exact si l'image doit afficher des mots.");
  }
  if (controls.negative.length < 4) suggestions.push("Ajoute plus de contraintes négatives.");
  return suggestions.length ? suggestions : ["Prompt prêt à tester. Sauvegarde-le pour créer l'effet compound."];
}

function nowLabel(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function App() {
  const initial = useMemo(loadStoredState, []);
  const [avatars, setAvatars] = useState<Avatar[]>(initial.avatars);
  const [activeAvatarId, setActiveAvatarId] = useState(initial.activeAvatarId);
  const [history, setHistory] = useState<HistoryItem[]>(initial.history);
  const [rawPrompt, setRawPrompt] = useState("");
  const [controls, setControls] = useState<Controls>(defaultControls);
  const [copied, setCopied] = useState<"final" | "json" | null>(null);
  const [page, setPage] = useState<Page>("characters");
  const [smartCompiled, setSmartCompiled] = useState<CompiledPrompt | null>(null);
  const [rewriteStatus, setRewriteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [rewriteError, setRewriteError] = useState("");

  const activeAvatar = avatars.find((avatar) => avatar.id === activeAvatarId) || avatars[0];
  const compiled = compilePrompt(rawPrompt, activeAvatar, controls);
  const output = smartCompiled || compiled;
  const avatarHistory = history.filter((item) => item.avatarId === activeAvatar.id);
  const pages: Array<{ id: Page; label: string; icon: typeof Sparkles }> = [
    { id: "characters", label: "Character", icon: Users },
    { id: "prompt", label: "Prompt", icon: Sparkles },
    { id: "direction", label: "Direction", icon: SlidersHorizontal },
    { id: "output", label: "Output", icon: Clipboard },
    { id: "history", label: "History", icon: History },
  ];
  const currentPageIndex = pages.findIndex((item) => item.id === page);
  const nextPage = pages[Math.min(currentPageIndex + 1, pages.length - 1)].id;

  function persist(nextAvatars = avatars, nextHistory = history, nextActive = activeAvatarId) {
    saveStoredState({ avatars: nextAvatars, history: nextHistory, activeAvatarId: nextActive });
  }

  function updateAvatar(field: keyof Avatar, value: string) {
    const next = avatars.map((avatar) =>
      avatar.id === activeAvatar.id ? { ...avatar, [field]: value } : avatar,
    );
    setAvatars(next);
    persist(next);
  }

  function addAvatar() {
    const id = `avatar-${Date.now()}`;
    const nextAvatar: Avatar = {
      id,
      name: "Untitled Avatar",
      role: "Recurring AI character",
      identity: "Define stable facial proportions, body shape, age range, expression language, and non-negotiable identity details.",
      visualMemory: "Define wardrobe, recurring environments, camera style, lighting taste, and vibe.",
      promptRules: "Define what every prompt should preserve and what should be avoided.",
      imageUrl: "",
      accent: "#00b894",
    };
    const next = [...avatars, nextAvatar];
    setAvatars(next);
    setActiveAvatarId(id);
    persist(next, history, id);
  }

  function saveCurrentPrompt() {
    const item: HistoryItem = {
      id: `history-${Date.now()}`,
      avatarId: activeAvatar.id,
      createdAt: nowLabel(),
      rawPrompt,
      finalPrompt: output.finalPrompt,
      structuredPrompt: output.structuredPrompt,
      score: output.score,
    };
    const next = [item, ...history].slice(0, 80);
    setHistory(next);
    persist(avatars, next);
  }

  function removeHistoryItem(id: string) {
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    persist(avatars, next);
  }

  async function copyText(text: string, kind: "final" | "json") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function runSmartRewrite() {
    setRewriteStatus("loading");
    setRewriteError("");
    try {
      const response = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt,
          avatar: activeAvatar,
          controls,
          localDraft: compiled,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Smart rewrite failed");
      }
      const data = (await response.json()) as CompiledPrompt;
      setSmartCompiled(data);
      setPage("output");
      saveStoredState({ avatars, history, activeAvatarId });
      setRewriteStatus("idle");
    } catch (error) {
      setRewriteStatus("error");
      setRewriteError(error instanceof Error ? error.message : "Smart rewrite failed");
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <button className="brand" type="button" onClick={() => setPage("prompt")}>
          <div className="brand-mark">
            <span>PC</span>
          </div>
          <div>
            <p>Smart Prompter</p>
          </div>
        </button>

        <nav className="page-nav" aria-label="Prompt workflow">
          {pages.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={page === item.id ? "nav-item active" : "nav-item"}
                type="button"
                onClick={() => setPage(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="save-button" type="button" onClick={saveCurrentPrompt}>
          <Save size={18} />
          <span>Save</span>
        </button>
      </header>

      <section className="stage">
        <div className="stage-heading">
          <p>{activeAvatar.name}</p>
          <h1>
            {page === "characters" && "Choose a character."}
            {page === "prompt" && "Drop the messy idea."}
            {page === "direction" && "Answer the smart bits."}
            {page === "output" && "Paste into GPT Image 2."}
            {page === "history" && "Reuse what worked."}
          </h1>
        </div>

        {page === "characters" ? (
          <div className="character-page">
            <section className="avatar-rail" aria-label="Characters">
              <div className="rail-title">
                <span>Characters</span>
                <button className="icon-button" type="button" onClick={addAvatar} aria-label="Add avatar">
                  <Plus size={17} />
                </button>
              </div>
              <div className="avatar-list">
                {avatars.map((avatar) => (
                  <button
                    className={avatar.id === activeAvatar.id ? "avatar-item active" : "avatar-item"}
                    key={avatar.id}
                    type="button"
                  onClick={() => {
                    setActiveAvatarId(avatar.id);
                    persist(avatars, history, avatar.id);
                    setPage("prompt");
                  }}
                >
                    <span className="avatar-face" style={{ "--accent": avatar.accent || "#2266d2" } as React.CSSProperties}>
                      {avatar.imageUrl ? <img src={avatar.imageUrl} alt="" /> : avatar.name.slice(0, 2).toUpperCase()}
                    </span>
                    <strong>{avatar.name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="memory-editor">
              <label>
                Name
                <input value={activeAvatar.name} onChange={(event) => updateAvatar("name", event.target.value)} />
              </label>
              <label>
                Role
                <input value={activeAvatar.role} onChange={(event) => updateAvatar("role", event.target.value)} />
              </label>
              <label>
                Face image URL
                <input
                  value={activeAvatar.imageUrl || ""}
                  onChange={(event) => updateAvatar("imageUrl", event.target.value)}
                  placeholder="Paste first generated face/image URL here"
                />
              </label>
              <label>
                Accent color
                <input
                  value={activeAvatar.accent || "#ff5d8f"}
                  onChange={(event) => updateAvatar("accent", event.target.value)}
                  placeholder="#ff5d8f"
                />
              </label>
              <label>
                Identity lock
                <textarea
                  rows={5}
                  value={activeAvatar.identity}
                  onChange={(event) => updateAvatar("identity", event.target.value)}
                />
              </label>
              <label>
                Visual memory
                <textarea
                  rows={5}
                  value={activeAvatar.visualMemory}
                  onChange={(event) => updateAvatar("visualMemory", event.target.value)}
                />
              </label>
              <label>
                Prompt rules
                <textarea
                  rows={4}
                  value={activeAvatar.promptRules}
                  onChange={(event) => updateAvatar("promptRules", event.target.value)}
                />
              </label>
            </section>
          </div>
        ) : null}

        {page === "prompt" ? (
          <div className="prompt-page">
            <section className="prompt-canvas">
              <div className="page-kicker">
                <Sparkles size={18} />
                <span>Raw idea</span>
              </div>
              <textarea
                value={rawPrompt}
                onChange={(event) => setRawPrompt(event.target.value)}
                placeholder="Jane dans un kebab avec sa copine, photo iPhone, nuit, brut..."
              />
              <div className="prompt-actions">
                <button className="next-button" type="button" onClick={() => setPage("direction")}>
                  Direction
                  <ChevronRight size={18} />
                </button>
              </div>
            </section>

            <aside className="quiet-panel">
              <div className="image-card">
                <img
                  src={studioImages.nightDesk}
                  alt="Dim creative desk with laptop and monitor"
                />
                <div>
                  <strong>Raw. Specific. Physical.</strong>
                </div>
              </div>
              <div className="memory-summary">
                <Brain size={20} />
                <div>
                  <strong>{activeAvatar.name}</strong>
                </div>
              </div>
              <p>{activeAvatar.visualMemory}</p>
              <button className="text-button" type="button" onClick={() => setPage("characters")}>
                Edit character
              </button>
            </aside>
          </div>
        ) : null}

        {page === "direction" ? (
          <div className="direction-page">
            <section className="mood-strip" aria-label="Visual references">
              <img src={studioImages.cleanDesk} alt="Minimal creative workspace with laptop" />
              <div>
                <strong>Camera. Light. Material.</strong>
              </div>
            </section>

            <section className="direction-section">
              <div className="page-kicker">
                <SlidersHorizontal size={18} />
                <span>Mode</span>
              </div>
              <div className="intent-grid">
                {(Object.keys(intentLabels) as Intent[]).map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    className={controls.intent === intent ? "intent-card active" : "intent-card"}
                    onClick={() => setControls({ ...controls, intent })}
                  >
                    <strong>{intentLabels[intent]}</strong>
                    <span>{buildIntentBlock(intent).split(".")[0]}.</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="direction-section">
              <div className="page-kicker">
                <UserRound size={18} />
                <span>Details</span>
              </div>
              <div className="field-grid">
                <label>
                  Aspect
                  <select
                    value={controls.aspectRatio}
                    onChange={(event) => setControls({ ...controls, aspectRatio: event.target.value })}
                  >
                    <option>3:4 vertical</option>
                    <option>9:16 vertical</option>
                    <option>1:1 square</option>
                    <option>4:5 portrait</option>
                    <option>16:9 landscape</option>
                    <option>4:3 landscape</option>
                  </select>
                </label>
                <label>
                  Realism
                  <select
                    value={controls.realism}
                    onChange={(event) =>
                      setControls({ ...controls, realism: event.target.value as Controls["realism"] })
                    }
                  >
                    <option value="raw">Raw realistic</option>
                    <option value="polished">Polished commercial</option>
                    <option value="stylized">Stylized</option>
                  </select>
                </label>
                <label>
                  Camera / shot
                  <input
                    value={controls.shot}
                    onChange={(event) => setControls({ ...controls, shot: event.target.value })}
                  />
                  <div className="template-row">
                    {shotTemplates.map((template) => (
                      <button key={template} type="button" onClick={() => setControls({ ...controls, shot: template })}>
                        {template}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  Lighting
                  <input
                    value={controls.lighting}
                    onChange={(event) => setControls({ ...controls, lighting: event.target.value })}
                  />
                  <div className="template-row">
                    {lightingTemplates.map((template) => (
                      <button key={template} type="button" onClick={() => setControls({ ...controls, lighting: template })}>
                        {template}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={controls.preserveIdentity}
                  onChange={(event) => setControls({ ...controls, preserveIdentity: event.target.checked })}
                />
                Preserve avatar identity
              </label>

              <label>
                Exact text
                <input
                  value={controls.exactText}
                  onChange={(event) => setControls({ ...controls, exactText: event.target.value })}
                  placeholder='Ex: "Liked Songs", "WELCOME TO JANE"'
                />
              </label>
            </section>

            <section className="direction-section">
              <div className="negative-box">
                <div className="page-kicker">
                  <Check size={18} />
                  <span>Negative constraints</span>
                </div>
                <div className="chips">
                  {negativeOptions.map((option) => {
                    const checked = controls.negative.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={checked ? "chip active" : "chip"}
                        onClick={() => {
                          setControls({
                            ...controls,
                            negative: checked
                              ? controls.negative.filter((item) => item !== option)
                              : [...controls.negative, option],
                          });
                        }}
                      >
                        {checked ? <Check size={13} /> : null}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="next-button" type="button" onClick={runSmartRewrite} disabled={rewriteStatus === "loading"}>
                {rewriteStatus === "loading" ? "Rewriting..." : "Smart rewrite"}
                <ChevronRight size={18} />
              </button>
              {rewriteStatus === "error" ? <p className="error-text">{rewriteError}</p> : null}
            </section>
          </div>
        ) : null}

        {page === "output" ? (
          <div className="output-page">
            <section className="readiness-band">
              <div className="score-ring" style={{ "--score": `${output.score}%` } as React.CSSProperties}>
                <span>{output.score}</span>
              </div>
              <div>
                <span>Readiness</span>
                <strong>{smartCompiled ? "Smart rewrite ready. Copy this into GPT Image 2." : output.suggestions.join(" ")}</strong>
              </div>
              <button className="save-button dark" type="button" onClick={saveCurrentPrompt}>
                <Save size={18} />
                Save
              </button>
            </section>

            <section className="output-layout">
              <article className="prompt-output primary-output">
                <div className="output-head">
                  <div>
                    <Clipboard size={18} />
                    <span>Final prompt</span>
                    <span className="output-tag">Send this to GPT Image 2</span>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => copyText(output.finalPrompt, "final")}
                    aria-label="Copy final prompt"
                  >
                    {copied === "final" ? <Check size={17} /> : <Clipboard size={17} />}
                  </button>
                </div>
                <pre>{output.finalPrompt}</pre>
              </article>

              <article className="prompt-output">
                <div className="output-head">
                  <div>
                    <FileJson size={18} />
                    <span>Structured JSON</span>
                    <span className="output-tag muted">Reference / automation</span>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => copyText(output.structuredPrompt, "json")}
                    aria-label="Copy structured JSON"
                  >
                    {copied === "json" ? <Check size={17} /> : <Clipboard size={17} />}
                  </button>
                </div>
                <pre>{output.structuredPrompt}</pre>
              </article>
            </section>
          </div>
        ) : null}

        {page === "history" ? (
          <section className="history-page" aria-label="Prompt history">
            {avatarHistory.length === 0 ? (
              <div className="empty-state">
                <History size={32} />
                <p>No saved prompts for {activeAvatar.name} yet.</p>
              </div>
            ) : (
              <div className="history-list">
                {avatarHistory.map((item) => (
                  <article className="history-item" key={item.id}>
                    <button
                      className="history-main"
                      type="button"
                      onClick={() => {
                        setRawPrompt(item.rawPrompt);
                        setPage("output");
                      }}
                    >
                      <span>{item.createdAt}</span>
                      <strong>{item.rawPrompt || "Untitled prompt"}</strong>
                      <small>Score {item.score}</small>
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Delete history item"
                      onClick={() => removeHistoryItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

      </section>
    </main>
  );
}
