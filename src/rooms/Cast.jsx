import React, { useState } from "react";
import { Lock, Copy, AlertTriangle } from "lucide-react";
import {
  C, BODY, DISPLAY, MONO, Mono, Big, Card, Section, Pill, Field, Note,
  Problem, Chips,
} from "../lib/ui.jsx";

/* ============================================================
   src/rooms/Cast.jsx

   Story in, shooting prompt out.

   The CHARACTER block is assembled from a constant and never
   retyped. The first Murt video already drifted — "a forward-facing
   quiff" became "forward facing quiff" — and generative models
   drift on paraphrase. A constant cannot forget; a person can.

   Kapwing has no public API, so the prompt is copied across by
   hand. That is the honest end of this pipeline.
   ============================================================ */

/* LOCKED. Never edit. Never paraphrase. From vspot-correspondents.md. */
const CHARACTER = {
  murt: "An average looking 45 year old Irish male. Was once athletic but more of an armchair sports fan now. Thinning hair with a forward-facing quiff, salt and pepper colour mix, blue eyes, glowing skin, and a once-athletic figure.",
  reagan: "A 32 year old American woman. Shoulder-length dark blonde hair, usually tied back, with strands escaping. Sharp cheekbones, tired but bright hazel eyes, faint freckles, minimal makeup applied quickly. Athletic build kept up rather than trained for. Small silver hoop earrings, always the same pair.",
  jimmy: "A 30 year old American man with the clean-cut look of a television presenter. Dark brown neatly-cut hair, strong jaw, warm brown eyes, tall and broad-shouldered from an athletic past. Naturally photogenic in a way he seems unaware of. Open, earnest facial expressions.",
};

const CAST = {
  murt: {
    name: "Murt Moriarty",
    angle: "The absurd. Founder discourse, funding announcements, anything involving a gilet.",
    voice: "Alan Partridge. Socially awkward, over-shares, leaves silences he cannot fill. Never says \"content\". Refers to LinkedIn as \"the LinkedIn\".",
    tint: C.sand,
    formats: [
      { id: "gym", label: "The gym vlog", secs: "30–45s", beats: 8,
        wardrobe: "fitted blue sleeveless workout top, high-waisted black shorts, white socks, white sneakers, white towel loosely around his neck",
        setting: "A modern boutique gym late in the evening. Dumbbell racks, kettlebells, medicine balls, mirrors, benches, stretching mats, a gym bag, shaker bottle, warm overhead lighting. Almost empty, one or two people blurred in the distance." },
      { id: "kitchen", label: "The kitchen verdict", secs: "20–30s", beats: 5,
        wardrobe: "creased polo, one size too big",
        setting: "A domestic kitchen in the evening. Kettle, mugs, a delivery box half opened on the counter. Overhead light only." },
      { id: "event", label: "The event floor", secs: "20–35s", beats: 6,
        wardrobe: "lanyard worn too high, blazer over polo",
        setting: "A trade show floor between sessions. Booth graphics out of focus behind him, carpet tiles, a coffee cup he is not drinking." },
      { id: "lobby", label: "The hotel lobby", secs: "20–30s", beats: 5,
        wardrobe: "blazer over polo, lanyard still on from earlier",
        setting: "A conference hotel lobby, late. Low armchairs, a bar in the far background, no other delegates." },
    ],
  },
  reagan: {
    name: "Reagan Doyle",
    angle: "The optimisation, with exactly one clue per video that she is winging it.",
    voice: "Fast, declarative, over-confident on camera. Slower and quieter when the clue lands. She talks to the audience the way you talk to someone you are trying to convince of something you have stopped believing.",
    tint: C.apricot,
    formats: [
      { id: "morning", label: "Morning routine", secs: "20–30s", beats: 6,
        wardrobe: "matching neutral athleisure set, expensive, slightly too new",
        setting: "A bright apartment before six. An unexplained trophy on the shelf behind her, never mentioned." },
      { id: "desk", label: "The desk take", secs: "20–30s", beats: 5,
        wardrobe: "oversized crew neck, hair up",
        setting: "A tidy desk, second monitor off. A framed photo she never refers to." },
      { id: "event", label: "The event floor", secs: "20–35s", beats: 6,
        wardrobe: "blazer over a t-shirt, lanyard, coffee in both hands",
        setting: "A conference concourse mid-morning, people moving behind her." },
      { id: "weekend", label: "Weekend", secs: "15–25s", beats: 4,
        wardrobe: "band t-shirt, the one authentic garment she owns",
        setting: "A sofa, Saturday. A beer visible in shot despite a stated dry quarter." },
    ],
  },
  jimmy: {
    name: "Jimmy Vance",
    angle: "The mechanism, explained via something in the natural world.",
    voice: "Measured. Genuinely curious. Frequently pauses mid-sentence to reconsider. Never sarcastic, which in this cast makes him the strangest person in it.",
    tint: C.sky,
    formats: [
      { id: "thread", label: "The sincere thread", secs: "under 30s", beats: 5,
        wardrobe: "crisp white shirt, sleeves rolled, no tie",
        setting: "A plain room, natural light from one side. Nothing on the walls." },
      { id: "outdoors", label: "Outdoors", secs: "30–45s", beats: 7,
        wardrobe: "technical fleece, walking boots, small backpack",
        setting: "A hillside path in flat afternoon light. Wind on the microphone." },
      { id: "presenting", label: "Presenting", secs: "20–30s", beats: 5,
        wardrobe: "crisp white shirt, sleeves rolled, no tie",
        setting: "A studio corner with a plant and a lamp, deliberately unglamorous." },
      { id: "travel", label: "Travel", secs: "20–30s", beats: 5,
        wardrobe: "linen shirt, sunglasses pushed up",
        setting: "A European street in the early evening, shopfronts behind." },
    ],
  },
};

const CAMERA = `Handheld DV 16mm daily vlog footage. Opens in selfie mode at arm's length, speaking directly to the lens. Keep subtle handheld shake, drifting composition, autofocus hunting, rushed reframing, uneven zooms, exposure breathing, brief accidental face cropping, and imperfect framing throughout. The camera itself is never visible.`;

const LOOK = `Warm analog tape texture with gentle film grain, slightly softened sharpness, subtle halation around lights, realistic skin tones, low contrast, tiny exposure shifts, and natural motion blur. It should feel authentic and completely unstaged.`;

const SILENCE = `He speaks in short, natural sentences with frequent pauses. Never rush dialogue. Leave quiet moments between lines.`;

export default function Cast() {
  const [who, setWho] = useState("murt");
  const [fmt, setFmt] = useState(0);
  const [story, setStory] = useState("");
  const [copied, setCopied] = useState(false);
  const c = CAST[who];
  const f = c.formats[fmt];

  const pronoun = who === "reagan" ? "She" : "He";
  const silence = SILENCE.replace("He speaks", `${pronoun} speaks`);

  const prompt = `CAMERA: ${CAMERA}

LOOK: ${LOOK}

STYLE: ${c.voice} ${silence}

CHARACTER: ${CHARACTER[who]} ${pronoun === "She" ? "She wears" : "He wears"} ${f.wardrobe}.

SETTING: ${f.setting}

SCENES:
[${f.beats} beats maximum for a ${f.secs} cut. Write behaviour, not lines — "he laughs quietly and adjusts the towel" produces better output than a line of dialogue on its own.]

The story being reacted to:
${story || "[paste the story]"}`;

  return (
    <div>
      <Note>
        Story in, shooting prompt out. The character block is pasted from a constant and never retyped —
        paraphrase is how a face drifts between videos.
      </Note>

      <Chips items={Object.entries(CAST).map(([k, v]) => [k, v.name.split(" ")[0]])} value={who}
        onChange={(k) => { setWho(k); setFmt(0); }} />
      <div style={{ height: 14 }} />

      <Card tint={c.tint} style={{ marginBottom: 14 }}>
        <Big s={22}>{c.name.toUpperCase()}</Big>
        <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>{c.angle}</p>

        <div className="sc flex gap-2" style={{ overflowX: "auto", marginTop: 14 }}>
          {c.formats.map((x, i) => (
            <button key={x.id} onClick={() => setFmt(i)} className="tap"
              style={{
                flexShrink: 0, padding: "8px 13px", borderRadius: 999, cursor: "pointer",
                fontFamily: BODY, fontSize: 12, fontWeight: fmt === i ? 600 : 500,
                background: fmt === i ? C.ink : "rgba(255,255,255,.65)",
                color: fmt === i ? "#fff" : C.ink2, border: "none",
              }}>
              {x.label} · {x.secs}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <Field tint="rgba(255,255,255,.7)" value={story} onChange={setStory} rows={4}
            placeholder="Paste the story, the LinkedIn post, or the essay they're reacting to." />
        </div>
      </Card>

      <Card tint={C.blush} pad={16} style={{ marginBottom: 14 }}>
        <div className="flex items-start gap-2.5">
          <Lock size={16} strokeWidth={2.3} color={C.red} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>
              Character locked · wardrobe by format · silence instruction injected
            </div>
            <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>
              Beat count capped at {f.beats} for a {f.secs} cut. The first gym vlog ran eleven beats and
              a paraphrased character block. Both are handled here.
            </p>
          </div>
        </div>
      </Card>

      <Section label="The shooting prompt" right={
        <Pill sm icon={Copy} onClick={() => { navigator.clipboard?.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
          {copied ? "Copied" : "Copy"}
        </Pill>
      }>
        <Card pad={16}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6, color: C.ink }}>
            {prompt}
          </pre>
        </Card>
      </Section>

      <Card tint={C.sand} pad={16}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} strokeWidth={2.3} color={C.ink2} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
            Kapwing has no public API for programmatic editing, so this is where the pipeline hands over
            to you. Generate in Runway or Veo with the same seed per character, then assemble and caption
            in Kapwing. Do not mix generators mid-campaign — a character made in two models is two people.
          </p>
        </div>
      </Card>
    </div>
  );
}
