/**
 * grid.ts - The beat grid the model fills in, and how it becomes Notations DSL.
 *
 * Asking a model to write DSL directly leaves all the counting to it, and counting is exactly
 * what goes wrong on real pages: many authors never write the karvais (commas) and rely on
 * visual spacing, or line the sahitya up under the swaras by column instead of padding it.
 * So the model does not write DSL. It reads the page into a grid:
 *
 *   section -> line -> role (Sw, Sh, ...) -> beat -> slots
 *
 * where every beat must hold exactly `beatDuration` slots. Unwritten units have to be placed
 * somewhere, and the model marks each one it supplied with a leading `*` ("*,"), so the
 * proofreader can see what was read and what was inferred.
 *
 * This module then does everything that can be done mechanically:
 *
 * - validateTranscription() checks the counts and reports each problem with its location
 *   ("Pallavi, line 2, Sw, beat 6 has 3 slots, needs 4"), which is what the repair loop
 *   sends back to the model;
 * - toNotation() writes the DSL, deriving the | and || bars from the tala, so alignment
 *   between roles and avartanams holds by construction.
 */

export interface MetadataEntry {
  key: string;
  value: string;
}

export interface GridRole {
  role: string;
  /** One string per beat, slots separated by spaces, e.g. "s *, r g". */
  beats: string[];
}

export interface GridLine {
  label: string;
  /** True when the line is deliberately not a whole number of avartanams (an ending, an eduppu). */
  partial: boolean;
  roles: GridRole[];
  /** What a proofreader should check on this line; empty when nothing. */
  uncertain: string;
}

export interface GridSection {
  heading: string;
  text: string;
  /** Tala for this section, e.g. "|4|2|2|"; empty to keep the document's. */
  cycle: string;
  beatDuration: number;
  lines: GridLine[];
}

export interface Transcription {
  metadata: MetadataEntry[];
  cycle: string;
  /** How the model worked out the tala and units per beat. Shown to the user. */
  timing: string;
  sections: GridSection[];
  /** Page-level notes for the proofreader. */
  notes: string[];
}

const str = (description: string) => ({ type: "string", description });

/**
 * JSON schema for structured outputs. Strict mode needs every property required and
 * additionalProperties false; "empty string" stands in for "absent".
 */
export const TRANSCRIPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metadata", "cycle", "timing", "sections", "notes"],
  properties: {
    metadata: {
      type: "array",
      description: "Printed metadata: title, composer, ragam, talam, arohanam, avarohanam, language, source...",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "value"],
        properties: { key: str("lower case, e.g. ragam"), value: str("as printed") },
      },
    },
    cycle: str('Tala as beats per anga, e.g. "|4|2|2|" for Adi'),
    timing: str("One or two sentences: how you determined the tala and the units per beat from the page"),
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "text", "cycle", "beatDuration", "lines"],
        properties: {
          heading: str('Section name as printed, e.g. "Pallavi"; empty if none'),
          text: str("Prose printed with the section (instructions, footnotes); empty if none"),
          cycle: str("This section's tala if it differs from the document's; else empty"),
          beatDuration: { type: "integer", description: "Slots per beat in this section" },
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "partial", "roles", "uncertain"],
              properties: {
                label: str("Margin label printed for this line; usually empty"),
                partial: {
                  type: "boolean",
                  description: "True only if the printed line really is not a whole number of avartanams",
                },
                roles: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["role", "beats"],
                    properties: {
                      role: str('"Sw" for swaras, "Sh" for sahitya, or another short name'),
                      beats: {
                        type: "array",
                        description: "One string per beat: exactly beatDuration slots separated by spaces",
                        items: { type: "string" },
                      },
                    },
                  },
                },
                uncertain: str("What the proofreader should check on this line; empty if nothing"),
              },
            },
          },
        },
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Notes for the proofreader" },
  },
} as const;

// ---- Slots ----------------------------------------------------------------------------------

/** Characters a DSL literal may contain; mirrors IdentChar in src/parser.ts. */
const IDENT_CHAR = /[^%!@$#&^|[\]={}()<>+\-,;~: \t\f\r\n\v\\.'"]/u;
const LITERAL = new RegExp(`^\\.*${IDENT_CHAR.source}+\\.*$`, "u");

export interface ParsedSlot {
  /** DSL text for the slot, with any inference marker removed. */
  text: string;
  /** The model supplied this slot; it was not printed. */
  inferred: boolean;
}

export interface ParsedBeat {
  slots: ParsedSlot[];
  /** Why the beat could not be read, or null. */
  error: string | null;
}

/** Splits a beat string into tokens, keeping [ ... ] groups whole. */
function tokenize(beat: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of beat.replace(/\|+/g, " ")) {
    if (ch === "[") depth++;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function checkAtom(atom: string): string | null {
  if (atom === "," || atom === "_" || atom === "-") return null;
  if (atom === ";") return '";" is two units; write two "," slots instead';
  if (atom.startsWith("~")) return null; // embellishment, attaches to the next atom
  if (atom.startsWith("[")) {
    if (!atom.endsWith("]")) return `unclosed group "${atom}"`;
    const inner = tokenize(atom.slice(1, -1));
    if (inner.length === 0) return "empty group []";
    for (const a of inner) {
      const e = checkAtom(a);
      if (e) return e;
    }
    return null;
  }
  if (!LITERAL.test(atom)) {
    return `"${atom}" is not a valid note or syllable (drop punctuation such as ' - : ( ) and keep octave dots only at the start or end)`;
  }
  return null;
}

/** Parses one beat into slots. Embellishments join the slot they decorate; "-" takes no slot. */
export function parseBeat(beat: string): ParsedBeat {
  const slots: ParsedSlot[] = [];
  let pending = ""; // zero-width prefixes: embellishments and "-"
  for (let tok of tokenize(beat)) {
    let inferred = false;
    if (tok.startsWith("*")) {
      inferred = true;
      tok = tok.slice(1);
      if (!tok) continue;
    }
    const err = checkAtom(tok);
    if (err) return { slots, error: err };
    if (tok.startsWith("~") || tok === "-") {
      pending += tok + " ";
      continue;
    }
    slots.push({ text: pending + tok, inferred });
    pending = "";
  }
  if (pending.trim()) {
    if (pending.trim() === "-" && slots.length > 0) {
      slots[slots.length - 1].text += " -";
    } else {
      return { slots, error: `"${pending.trim()}" at the end of the beat decorates nothing` };
    }
  }
  return { slots, error: null };
}

// ---- Cycles ---------------------------------------------------------------------------------

/** Parses "|4|2|2|" into [4, 2, 2]; null when malformed. */
export function parseCycle(cycle: string): number[] | null {
  const m = /^\s*\|((?:\s*\d+\s*\|)+)\s*$/.exec(cycle || "");
  if (!m) return null;
  const angas = m[1]
    .split("|")
    .filter((s) => s.trim() !== "")
    .map((s) => parseInt(s, 10));
  return angas.length > 0 && angas.every((n) => n > 0) ? angas : null;
}

// ---- Validation -----------------------------------------------------------------------------

/** Normalises role names: sw -> Sw, SH -> Sh, strips anything the DSL cannot use. */
export function normalizeRole(role: string): string {
  const clean = (role || "").replace(/[^A-Za-z0-9]/g, "");
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (lower === "sw" || lower === "swaram" || lower === "swara") return "Sw";
  if (lower === "sh" || lower === "sahityam" || lower === "sahitya" || lower === "lyrics") return "Sh";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export interface GridReport {
  /** Problems that need another round with the model. */
  errors: string[];
  /** Slots the model supplied because the page did not print them. */
  inferredSlots: number;
  /** Proofreading items: line location plus what to check. */
  checks: string[];
}

function sectionName(section: GridSection, index: number): string {
  return section.heading?.trim() ? `"${section.heading.trim()}"` : `section ${index + 1}`;
}

export function validateTranscription(t: Transcription): GridReport {
  const errors: string[] = [];
  const checks: string[] = [];
  let inferredSlots = 0;

  const docCycle = parseCycle(t.cycle);
  if (!docCycle) errors.push(`Document cycle "${t.cycle}" is not of the form "|4|2|2|".`);
  if (!t.sections || t.sections.length === 0) errors.push("No sections: the page was not transcribed.");

  (t.sections || []).forEach((section, si) => {
    const where = sectionName(section, si);
    const cycle = section.cycle?.trim() ? parseCycle(section.cycle) : docCycle;
    if (!cycle) {
      if (section.cycle?.trim()) errors.push(`${where}: cycle "${section.cycle}" is not of the form "|4|2|2|".`);
      return;
    }
    const cycleBeats = cycle.reduce((a, b) => a + b, 0);
    const bd = section.beatDuration;
    if (!Number.isInteger(bd) || bd < 1 || bd > 32) {
      errors.push(`${where}: beatDuration ${bd} must be a whole number from 1 to 32.`);
      return;
    }

    section.lines.forEach((line, li) => {
      const lwhere = `${where}, line ${li + 1}`;
      if (line.uncertain?.trim()) checks.push(`${lwhere}: ${line.uncertain.trim()}`);
      if (line.roles.length === 0) {
        errors.push(`${lwhere} has no roles.`);
        return;
      }
      const seen = new Set<string>();
      for (const role of line.roles) {
        const name = normalizeRole(role.role);
        if (!name) errors.push(`${lwhere}: role "${role.role}" needs a name made of letters.`);
        if (seen.has(name)) errors.push(`${lwhere}: role ${name} appears twice; put the second row in its own line.`);
        seen.add(name);
        role.beats.forEach((beat, bi) => {
          const parsed = parseBeat(beat);
          if (parsed.error) {
            errors.push(`${lwhere}, ${name}, beat ${bi + 1} ("${beat}"): ${parsed.error}.`);
            return;
          }
          inferredSlots += parsed.slots.filter((s) => s.inferred).length;
          if (parsed.slots.length !== bd) {
            errors.push(
              `${lwhere}, ${name}, beat ${bi + 1} ("${beat}") has ${parsed.slots.length} slot(s); ` +
                `beatDuration is ${bd}, so it needs exactly ${bd}.`,
            );
          }
        });
      }

      const counts = line.roles.map((r) => r.beats.length);
      if (new Set(counts).size > 1) {
        const desc = line.roles.map((r) => `${normalizeRole(r.role)} ${r.beats.length}`).join(", ");
        errors.push(`${lwhere}: roles have different numbers of beats (${desc}); they must line up beat for beat.`);
      }
      const beats = Math.max(...counts);
      if (beats % cycleBeats !== 0) {
        if (line.partial) {
          checks.push(`${lwhere}: marked partial (${beats} beats, avartanam is ${cycleBeats}).`);
        } else {
          errors.push(
            `${lwhere} has ${beats} beats, not a multiple of the ${cycleBeats}-beat avartanam. ` +
              `Re-read it; set partial only if the printed line really is shorter or longer.`,
          );
        }
      }
    });
  });
  return { errors, inferredSlots, checks };
}

// ---- Output ---------------------------------------------------------------------------------

function yamlLine(key: string, value: string): string | null {
  const k = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!k || !value?.trim()) return null;
  return `${k}: ${JSON.stringify(value.trim())}`; // a JSON string is a valid YAML scalar
}

/** "1, 2, 4-6" from [1, 2, 4, 5, 6]. */
function ranges(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i + 1 ? `${nums[i]}-${nums[j]}` : j === i + 1 ? `${nums[i]}, ${nums[j]}` : `${nums[i]}`);
    i = j;
  }
  return out.join(", ");
}

/** Says which beats had units filled in, e.g. "beats 1, 2, 4-6 (Sw, Sh)". */
function describeFilled(filled: Map<number, string[]>): string {
  const beats = [...filled.keys()].sort((a, b) => a - b);
  const roleSets = new Set(beats.map((b) => filled.get(b)!.join(", ")));
  if (roleSets.size === 1) {
    return `${beats.length === 1 ? "beat" : "beats"} ${ranges(beats)} (${[...roleSets][0]})`;
  }
  return beats
    .map((b) => `${b} (${filled.get(b)!.join(", ")})`)
    .join(", ")
    .replace(/^/, "beats ");
}

function comment(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Writes the DSL for a transcription. Call validateTranscription first; this does not check
 * counts, it only lays out what it is given.
 */
export function toNotation(t: Transcription): string {
  const out: string[] = [];
  const meta = (t.metadata || []).map((m) => yamlLine(m.key, m.value)).filter((l): l is string => l != null);
  if (meta.length > 0) out.push("---", ...meta, "---");

  const docCycle = parseCycle(t.cycle) || [4, 2, 2];
  const cycleText = (angas: number[]) => `\\cycle("|${angas.join("|")}|")`;
  out.push(cycleText(docCycle));
  let curCycle = docCycle.join(",");
  let curBd = -1;

  const declared = new Set(["Sw", "Sh"]);
  for (const section of t.sections || []) {
    const angas = (section.cycle?.trim() && parseCycle(section.cycle)) || docCycle;
    out.push("");
    if (section.heading?.trim()) out.push(`> #### ${section.heading.trim()}`, "");
    for (const para of (section.text || "").split("\n").filter((p) => p.trim())) out.push(`> ${para.trim()}`);
    if (angas.join(",") !== curCycle) {
      out.push(cycleText(angas));
      curCycle = angas.join(",");
    }
    if (section.beatDuration !== curBd) {
      out.push(`\\beatDuration(${section.beatDuration})`);
      curBd = section.beatDuration;
    }

    // Bar after beat i: "||" at the end of an avartanam, "|" at the end of an anga.
    const barAfter: string[] = [];
    angas.forEach((n) => {
      for (let i = 1; i < n; i++) barAfter.push("");
      barAfter.push("|");
    });
    barAfter[barAfter.length - 1] = "||";

    for (const line of section.lines) {
      out.push("");
      const filled = new Map<number, string[]>();
      const rows: string[] = [];
      for (const role of line.roles) {
        const name = normalizeRole(role.role);
        if (!declared.has(name)) {
          out.push(`\\role("${name}", notes=false)`);
          declared.add(name);
        }
        const parts: string[] = [];
        role.beats.forEach((beat, bi) => {
          const { slots } = parseBeat(beat);
          const inferred = slots.filter((s) => s.inferred).length;
          if (inferred > 0) filled.set(bi + 1, [...(filled.get(bi + 1) || []), name]);
          parts.push(slots.map((s) => s.text).join(" "));
          const bar = barAfter[bi % barAfter.length];
          if (bar) parts.push(bar);
        });
        rows.push(`${name}: ${parts.join(" ")}`);
      }
      if (line.label?.trim()) out.push(`\\line(${JSON.stringify(line.label.trim())})`);
      if (line.uncertain?.trim()) out.push(`// check: ${comment(line.uncertain)}`);
      if (filled.size > 0) out.push(`// unwritten units filled in at ${describeFilled(filled)}`);
      out.push(...rows);
    }
  }
  return out.join("\n") + "\n";
}
