import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import * as TLEX from "tlex";
import { parseFrontMatter } from "./frontmatter";
import { Literal, AtomType, Note, Atom, Rest, Space, Syllable, Group, Marker } from "./core";
import { Notation, MetaData as Meta, Command, CmdParam } from "./notation";
import {
  RawEmbedding,
  ApplyLayout,
  AddAtoms,
  SetCycle,
  SetBeatDuration,
  SetBreaks,
  ActivateRole,
  CreateRole,
  CreateLine,
  Section,
  ScopedGroup,
  Repeat,
} from "./commands";

const ONE = TSU.Num.Fraction.ONE;

/** Front matter keys that set document defaults, lowercased, mapped to the command for each. */
const FRONT_MATTER_COMMANDS: Record<string, string> = {
  cycle: "cycle",
  beatduration: "beatduration",
  breaks: "breaks",
};
const TWO = ONE.timesNum(2);

/**
 * V4 of our parser builds on V3 and has the following improvements:
 *
 * 1. Embedding Headings to demarcate sections so users dont have to use
 *    explicit MD for headings.
 * 2. Unlike V3 here users break out *of* song instead instead break out "into"
 * song.  So users spend more time writing notation and less worrying about
 * other things like headings etc.
 */
const [parser, tokenFunc /*itemGraph*/] = G.newParser(
  String.raw`
    %define IdentChar     /[^%!@$#&\^|\[\]={}()<>+\-,;~: \t\f\r\n\v\\\.\'\"]/

    %token  BSLASH        "\\"
    %token  OPEN_SQ       "["
    %token  CLOSE_SQ      "]"
    %token  EQUALS        "="
    %token  OPEN_PAREN    "("
    %token  CLOSE_PAREN   ")"
    %token  OPEN_BRACE    "{"
    %token  CLOSE_BRACE   "}"
    %token  SLASH         "/"
    %token  STAR          "*"
    %token  CARET         "^"
    // %skip "-"
    %token  COMMA         ","
    %token  SEMI_COLON    ";"
    %token  COLON         ":"

    %token  FRONT_MATTER                 /^---$/m    { toFrontMatter }
    %token  SINGLE_LINE_RAW_STRING       />(.*)$/m    { toSingleLineRawString }
    %token  OLD_PRE_MARKER  /"([^"\\\n]|\\.)*">>/  { toOldMarker }
    %token  OLD_POST_MARKER /<<"([^"\\\n]|\\.)*"/  { toOldMarker }
    %token  MULTI_LINE_RAW_STRING        /r(#{0,})"/  { toMultiLineRawString }

    %token  EMBELISHMENT  /~[^\s]*/                 { toEmbelishment }
    %token  NUMBER        /-?\d+/                   { toNumber }
    %token  BOOLEAN       /true|false/              { toBoolean }
    %token  STRING        /"([^"\\\n]|\\.|\\\n)*"/  { toString }
    %token  STRING        /'([^'\\\n]|\\.|\\\n)*'/  { toString }
    %token  MARKER_NAME   /\\@{IDENT}/              { toMarkerName }
    %token  DOTS_IDENT    /(\.+)({IdentChar}+)/     { toOctavedNote   }
    %token  IDENT_DOTS    /({IdentChar}+)(\.+)/     { toOctavedNote   }
    %token  IDENT_COLON   /{IdentChar}+:/           { toRoleSelector  }
    %token  UNDER_SCORE   /_(?!{IdentChar})/
    %token  IDENT         /{IdentChar}+/
    %token  BSLASH_IDENT  /\\{IDENT}/               { toCommandName   }
    %token  BSLASH_NUMBER /\\{NUMBER}/
    %token  HYPHEN        /-/
    %skip                 /[ \t\n\f\r]+/
    %skip                 /\|\|?/
    %skip                 /\/\/[^\n]*/
    %skip                 /\/\*.*?\*\//

    Document -> Elements
              | FRONT_MATTER Elements { prependFrontMatter }
              ;

    Elements -> Elements Command Atoms { appendCommand } 
              | Elements RoleSelector Atoms { appendRoleSelector } 
              | Elements Embedding  Atoms { insertEmbedding }
              | Atoms { appendAtoms }
              ;

    Embedding -> SINGLE_LINE_RAW_STRING | MULTI_LINE_RAW_STRING ;

    Command -> BSLASH_IDENT CommandParams ? OptBlock { newCommandWithBlock } ;
    CommandParams -> OPEN_PAREN ParamList ? CLOSE_PAREN { $2 } ;
    OptBlock -> Block
             | { nullBlock }
             ;
    Block -> BlockStart Elements CLOSE_BRACE { endBlock } ;
    BlockStart -> OPEN_BRACE { beginBlock } ;

    ParamList -> ParamList COMMA Param { concatParamList } ;
    ParamList -> Param { newParamList };
    Param -> ParamValue { newParam } ;
    Param -> ParamKey EQUALS ParamValue { newParam } ;
    ParamKey  -> IDENT ;
    ParamValue -> ( STRING | Fraction | NUMBER | BOOLEAN ) ;

    RoleSelector -> IDENT_COLON ;

    Atoms -> Atoms Atom { concatAtoms } ;
    Atoms -> { newArray } ;

    Atom -> Leaf ;

    Leaf -> Space | Lit | Group | Rest | Marker ;
    Marker -> MARKER_NAME CommandParams { newMarker } ;
    Leaf -> Duration Leaf { applyDuration } ;
    Rest -> HYPHEN { newRest };
    Space -> COMMA { newSpace } 
          | SEMI_COLON { newDoubleSpace } 
          | UNDER_SCORE { newSilentSpace } 
          ;

    /* - An alternative representation to support both pre and
     *   post embelishment operators.   Here PRE_EMBs have a higher
     *   associativity over POST_EMBs
     */
     Lit -> Lit POST_EMB  { litWithPostEmb }
         | PreEmbLit
         ;

     PreEmbLit -> LitToken 
                | LitToken CARET NUMBER { litWithCaret }
                | LitToken CARET STAR   { litWithCaret }
                | PRE_EMB PreEmbLit     { litWithPreEmb }
                ;
      
     LitToken -> DOTS_IDENT { litToAtom }
              | IDENT { litToAtom }
              | IDENT_DOTS { litToAtom }
              | STRING  { litToAtom }
              ;

    Group -> OPEN_SQ Atoms CLOSE_SQ { newGroup };

    Duration -> Fraction | NUMBER;
    Fraction -> NUMBER SLASH NUMBER { newFraction } ;
    `,
  {
    debug: "",
    type: "lalr",
    leftRecursive: true,
    tokenHandlers: {
      toEmbelishment: (token: TLEX.Token, tape: TLEX.TapeInterface, owner: any) => {
        const [emb, pre] = owner.parseEmbelishment(token.value);
        if (emb == null) {
          const message =
            owner.embellishments == null
              ? `No embellishment parser for ${token.value}: pass embellishments to Parser, or use load() or parse()`
              : `Invalid embelishment: ${token.value}`;
          owner.errors.push(
            new TLEX.TokenizerError(message, token.start, token.end - token.start, "InvalidEmbelishment", token.value),
          );
          return null;
        }
        token.value = emb;
        token.tag = pre ? "PRE_EMB" : "POST_EMB";
        return token;
      },
      toCommandName: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        token.value = token.value.substring(1);
        return token;
      },
      toBoolean: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        token.value = token.value == "true";
        return token;
      },
      toNumber: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        token.value = parseInt(token.value);
        return token;
      },
      toString: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        token.value = token.value.substring(1, token.value.length - 1);
        return token;
      },
      toMarkerName: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        // Extract marker name from \@markerName - skip the \@
        token.value = token.value.substring(2);
        return token;
      },
      toOctavedNote: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        if (token.tag == "DOTS_IDENT") {
          const octave = token.positions[1][1] - token.positions[1][0];
          const note = token.value.substring(octave);
          token.value = new Note(note, ONE, -octave);
        } else if (token.tag == "IDENT_DOTS") {
          const octave = token.positions[2][1] - token.positions[2][0];
          const note = token.value.substring(0, token.value.length - octave);
          token.value = new Note(note, ONE, octave);
        } else {
          throw new Error("Invalid token for converting to note: " + token.tag);
        }
        return token;
      },
      toRoleSelector: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        token.value = token.value.substring(0, token.value.length - 1);
        return token;
      },
      toLineAnnotation: (token: TLEX.Token, _tape: TLEX.TapeInterface, _owner: any) => {
        // skip the initial "!"
        token.value = token.value.substring(1);
        return token;
      },
      // A ">" starts an embed only when nothing but whitespace precedes it on its line.  Anywhere
      // else it would swallow the rest of the line, so report it and resume just after the ">".
      toSingleLineRawString: (token: TLEX.Token, tape: TLEX.TapeInterface, owner: any) => {
        const lineStart = tape.substring(0, token.start).lastIndexOf("\n") + 1;
        if (tape.substring(lineStart, token.start).trim().length > 0) {
          owner.errors.push(
            new TLEX.TokenizerError(
              'Unexpected ">": an embed must start its own line',
              token.start,
              1,
              "MidLineEmbed",
              ">",
            ),
          );
          tape.index = token.start + 1;
          return null;
        }
        token.value = token.value.substring(1);
        return token;
      },
      // The "x">> and <<"x" markers were removed in favour of \@label (#59).  Report them by name
      // and drop the token, so the notes around them still parse.
      toOldMarker: (token: TLEX.Token, _tape: TLEX.TapeInterface, owner: any) => {
        const post = token.value.startsWith("<<");
        const text = post ? token.value.substring(2) : token.value.substring(0, token.value.length - 2);
        const replacement = post ? `\\@label(${text}, position="after")` : `\\@label(${text})`;
        owner.errors.push(
          new TLEX.TokenizerError(
            `Old marker syntax ${token.value}: write ${replacement}`,
            token.start,
            token.end - token.start,
            "OldMarkerSyntax",
            token.value,
          ),
        );
        return null;
      },
      toMultiLineRawString: (token: TLEX.Token, tape: TLEX.TapeInterface, _owner: any) => {
        // consume everything until "#<N times> as start
        const hashes = tape.substring(token.positions[1][0], token.positions[1][1]);
        const endPat = '"' + hashes;
        const startPos = tape.index;
        const endPos = TLEX.TapeHelper.advanceAfter(tape, endPat) - endPat.length;
        if (endPos < 0) {
          throw new Error("EOF expected while finding end of Raw String Literal: '" + endPat + "'");
        }
        token.value = tape.substring(startPos, endPos);
        return token;
      },
      toFrontMatter: (token: TLEX.Token, tape: TLEX.TapeInterface, _owner: any) => {
        // skip the initial ">"
        const endPat = "\n---";
        const startPos = tape.index;
        const endPos = TLEX.TapeHelper.advanceAfter(tape, endPat) - endPat.length;
        if (endPos < 0) {
          throw new Error("EOF expected while finding end of front matter");
        }
        token.value = tape.substring(startPos, endPos);
        // console.log("Found FM: ", token.value);
        return token;
      },
    },
  },
);

/**
 * A notation doc is a list of lines that are found in a single document.
 *
 * Since our document (md or html etc) can contain multiple snippets
 * all these snippets are related
 */
import {
  Block,
  SectionBlock,
  RepeatBlock,
  CycleBlock,
  BeatDurationBlock,
  BreaksBlock,
  RoleBlock,
  GroupBlock,
} from "./block";

/**
 * Wrapper for a command that has a block of child commands.
 * When applied, it creates the appropriate Block subclass and applies child commands to it.
 */
export class BlockCommand extends Command {
  readonly innerCommand: Command;
  readonly blockCommands: Command[];

  constructor(innerCommand: Command, blockCommands: Command[]) {
    super(innerCommand.params);
    this.innerCommand = innerCommand;
    this.blockCommands = blockCommands;
  }

  get name(): string {
    return `Block(${this.innerCommand.name})`;
  }

  /**
   * Creates the appropriate Block subclass based on the inner command type.
   */
  private createBlock(parent: Block): Block {
    const cmd = this.innerCommand;

    if (cmd instanceof Section) {
      return new SectionBlock(cmd.sectionName, parent);
    } else if (cmd instanceof Repeat) {
      return new RepeatBlock(cmd.count, parent);
    } else if (cmd instanceof SetCycle) {
      return new CycleBlock(cmd.cycle, parent);
    } else if (cmd instanceof SetBeatDuration) {
      return new BeatDurationBlock(cmd.beatDuration, parent);
    } else if (cmd instanceof SetBreaks) {
      return new BreaksBlock(cmd.pattern, parent);
    } else if (cmd instanceof CreateRole) {
      const roleName = cmd.getParamAt(0);
      return new RoleBlock(roleName, cmd.notesOnly, parent);
    } else if (cmd instanceof ScopedGroup) {
      return new GroupBlock(cmd.groupName || null, parent);
    } else {
      // Generic block for other commands
      return new Block(cmd.name.toLowerCase(), parent);
    }
  }

  debugValue(): any {
    return {
      name: this.name,
      index: this.index,
      innerCommand: this.innerCommand.debugValue(),
      blockCommands: this.blockCommands.map((cmd) => cmd.debugValue()),
    };
  }

  applyToNotation(notation: Notation): void {
    // Create the appropriate Block subclass
    // Cast notation as Block since Notation will extend Block
    const block = this.createBlock(notation as unknown as Block);

    // Apply all child commands to the block
    for (const cmd of this.blockCommands) {
      cmd.applyToBlock(block);
    }

    // Add the block to the notation
    notation.addBlockItem(block);
  }

  applyToBlock(container: Block): void {
    // Create the appropriate Block subclass
    const block = this.createBlock(container);

    // Apply all child commands to the block
    for (const cmd of this.blockCommands) {
      cmd.applyToBlock(block);
    }

    // Add the block to the container
    container.addBlockItem(block);
  }
}

/**
 * Reads one embellishment token, such as `~/` or `~w`, into the object attached to the next note.
 *
 * The parser knows the `~` syntax but not what any gamaka means, so whoever builds a Parser supplies
 * this. Return `[embellishment, true]` for a prefix embellishment, or `[null, false]` for a token
 * it doesn't recognise, which the parser reports as an error. `carnaticGamakas` in
 * `carnatic/gamakas.ts` is the one this library ships, and `load()` and `parse()` use it.
 */
export type EmbellishmentParser = (token: string) => [unknown, boolean];

/** Options for a Parser. */
export interface ParserOptions {
  /**
   * Reads `~` tokens. Without one, every embellishment in the source is reported as an error that
   * says to pass this or use `load()`.
   */
  embellishments?: EmbellishmentParser;
}

/**
 * Parses the notation DSL into commands that build a Notation.
 *
 * It depends on the runtime model only. Gamakas come in through `options.embellishments`, so the
 * parser carries no musical tradition of its own. `load()` and `parse()` create one with the
 * Carnatic gamakas.
 */
export class Parser {
  errors: (TLEX.TokenizerError | G.ParseError)[] = [];
  /** The embellishment parser this Parser was given, or null. */
  readonly embellishments: EmbellishmentParser | null;
  metadata: any = {};
  readonly commands: Command[] = [];
  // Stack to track command indices when entering blocks
  private blockStartStack: number[] = [];

  protected ruleHandlers = {
    newFraction: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      if (children.length == 1) {
        return new TSU.Num.Fraction(children[0].value);
      } else {
        return new TSU.Num.Fraction(children[0].value, children[2].value);
      }
    },
    newGroup: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const out = new Group(...children[1].value).setDuration(TWO, true);
      return out;
    },
    litWithCaret: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lit = Note.fromLit(children[0].value as Literal);
      const opnode = children[2];
      const shiftValue = opnode.sym.label == "STAR" ? true : opnode.value;
      lit.shift = shiftValue;
      return lit;
    },
    litWithPreEmb: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const emb = children[0];
      const lit = children[1].value as Literal;
      lit.embelishments.splice(0, 0, emb.value);
      return lit;
    },
    litWithPostEmb: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lit = children[0].value as Literal;
      const emb = children[1];
      lit.embelishments.push(emb);
      return lit;
    },
    litToAtom: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lit = children[0];
      if (lit.sym.label == "DOTS_IDENT" || lit.sym.label == "IDENT_DOTS") {
        return lit.value;
      } else if (lit.sym.label == "IDENT") {
        // Mark this as a Literal to be processed later
        return new Literal(lit.value);
        // return role.notesOnly ? new Note(lit.value) : new Syllable(lit.value);
      } else if (lit.sym.label == "STRING") {
        // const role = this.snippet.currRole;
        // if (role.notesOnly) throw new Error("Strings cannot appear in notes only mode");
        return new Syllable(lit.value);
      } else {
        throw new Error("Invalid lit: " + lit);
      }
    },
    newSpace: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      return new Space();
    },
    newRest: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      return new Rest();
    },
    newDoubleSpace: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      return new Space(ONE.timesNum(2));
    },
    newSilentSpace: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      return new Space(ONE, true);
    },
    newMarker: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const name = children[0].value as string;
      const params = children[1].value || [];
      return new Marker(name, params);
    },
    applyDuration: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      let dur = children[0].value as TSU.Num.Fraction | number;
      const leaf = children[1].value as Atom;
      if (typeof dur === "number") {
        dur = ONE.timesNum(dur);
      }
      if (leaf.TYPE == AtomType.GROUP) {
        (leaf as Group).setDuration(dur, true);
      } else {
        leaf.duration = dur;
      }
      return leaf;
    },
    newArray: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      // create an array of values from all the values of child nodes
      return children.map((c) => c.value);
    },
    concatAtoms: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const atoms = children[0].value;
      const atom = children[1].value;
      atoms.push(atom);
      return atoms;
    },
    newParam: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      if (children.length == 1) {
        return { key: null, value: children[0].value };
      } else {
        return { key: children[0].value, value: children[2].value };
      }
    },
    newParamList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return [children[0].value];
    },
    concatParamList: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const params = children[0].value;
      const newParam = children[2].value;
      params.push(newParam);
      return params;
    },
    // Block handling semantic actions
    beginBlock: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      // Push current command count to track where this block's commands start
      this.blockStartStack.push(this.commands.length);
      return null;
    },
    endBlock: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      // Pop the start index and extract commands added since then
      const startIndex = this.blockStartStack.pop()!;
      const blockCommands = this.commands.splice(startIndex);
      return blockCommands;
    },
    nullBlock: (_rule: G.Rule, _parent: G.PTNode, ..._children: G.PTNode[]) => {
      // No block present
      return null;
    },
    newCommandWithBlock: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const name = children[0].value;
      const params = children[1].value;
      const blockCommands = children[2].value as Command[] | null;

      const innerCommand = this.createCommand(name, params);
      // The block's commands were already spliced out of this.commands by endBlock, so an unknown
      // command takes its block down with it rather than leaving those commands at the top level.
      if (innerCommand === null) return null;

      if (blockCommands !== null) {
        // Wrap in BlockCommand
        return new BlockCommand(innerCommand, blockCommands);
      } else {
        // No block, return regular command
        return innerCommand;
      }
    },
    appendAtoms: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const atoms = children[0].value as Atom[];
      if (atoms.length > 0) {
        this.addCommand(new AddAtoms(...atoms));
      }
      return null;
    },
    prependFrontMatter: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const { data, errors } = parseFrontMatter(children[0].value);
      for (const e of errors) {
        this.errors.push(new G.ParseError(`front matter line ${e.line}: ${e.message}`, "FrontMatter", e.line));
      }
      this.metadata = data;
      return children[1].value;
    },
    appendCommand: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const command = children[1].value as Command | null;
      if (command !== null) this.addCommand(command);

      const atoms = children[2].value as Atom[];
      if (atoms.length > 0) {
        this.addCommand(new AddAtoms(...atoms));
      }
      return null;
    },
    appendRoleSelector: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const roleName = children[1].value;
      const lName = roleName.toLowerCase().trim();
      this.addCommand(new ActivateRole([{ key: null, value: lName }]));

      const atoms = children[2].value as Atom[];
      if (atoms.length > 0) {
        this.addCommand(new AddAtoms(...atoms));
      }
      return null;
    },
    insertEmbedding: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      // How to handle embeddings - these are just blocks
      // to escape out of song (most likely for some rendering of html/md etc)
      const rawVal = children[1].value;
      this.addCommand(new RawEmbedding([{ key: null, value: rawVal }]));
      const atoms = children[2].value as Atom[];
      if (atoms.length > 0) {
        this.addCommand(new AddAtoms(...atoms));
      }
      return null;
    },
  };

  constructor(options: ParserOptions = {}) {
    this.embellishments = options.embellishments ?? null;
  }

  /**
   * Builds the command a `\\name(...)` directive names.
   *
   * Returns null, after recording a ParseError on this parser, for a name with no command behind
   * it and for params the command rejects.  The error for bad params names the command, as in
   * `\\cycle: Invalid beat "4x" in bar "4x"`.  Rule handlers run inside galore's parse loop, so a
   * throw would escape `parse` and `load` as an exception while every other parse failure arrives
   * in the errors array.  Callers get one failure shape by being handed a null here and reading
   * `errors`.
   */
  createCommand(name: string, params: CmdParam[]): Command | null {
    try {
      return this.buildCommand(name, params);
    } catch (e: any) {
      const lName = name.trim().toLowerCase();
      this.errors.push(new G.ParseError(`\\${name.trim()}: ${e?.message ?? e}`, "InvalidCommandParams", lName));
      return null;
    }
  }

  private buildCommand(name: string, params: CmdParam[]): Command | null {
    const lName = name.trim().toLowerCase();
    params = params || [];
    if (lName == "line") {
      return new CreateLine(params);
      // } else if (lName == "meta") { return new MetaData(params);
    } else if (lName == "role") {
      return new CreateRole(params);
    } else if (lName == "layout") {
      return new ApplyLayout(params);
    } else if (lName == "beatduration") {
      return new SetBeatDuration(params);
    } else if (lName == "breaks") {
      return new SetBreaks(params);
    } else if (lName == "cycle") {
      return new SetCycle(params);
    } else if (lName == "section") {
      return new Section(params);
    } else if (lName == "group") {
      return new ScopedGroup(params);
    } else if (lName == "repeat") {
      return new Repeat(params);
    } else {
      // Try to set this as the current role
      this.errors.push(new G.ParseError("Invalid command: " + lName, "InvalidCommand", lName));
      return null;
    }
  }

  private _spannedRuleHandlers: any = null;

  /**
   * The rule handlers, each wrapped to record where an atom it returns came from in the source.
   * galore gives each parse tree node its span (galore 1.1.0), so the wrapper reads the span of
   * the children a rule reduced. It widens an atom's range rather than replacing it, so a rule
   * that hands back an inner atom (a note with a gamaka in front) grows the note's range to cover
   * the whole thing (#102).
   */
  private get spannedRuleHandlers(): any {
    if (this._spannedRuleHandlers) return this._spannedRuleHandlers;
    const out: any = {};
    const handlers = this.ruleHandlers as Record<string, (...args: any[]) => any>;
    for (const name of Object.keys(handlers)) {
      const handler = handlers[name];
      out[name] = (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
        const value = handler(rule, parent, ...children);
        if (value instanceof Atom) widenRange(value, children);
        return value;
      };
    }
    return (this._spannedRuleHandlers = out);
  }

  addCommand(cmd: Command): void {
    cmd.index = this.commands.length;
    this.commands.push(cmd);
  }

  parse(input: string): any {
    this.errors = [];
    // The galore parser holds one TokenBuffer for its lifetime and does not drain it when a
    // parse throws, so a token left over from a failed parse would be read back as the first
    // token of the next one.  Handing it the tokenizer again gives us an empty buffer.
    parser.setTokenizer(tokenFunc!);
    try {
      const ptree = parser.parse(input, {
        tokenizerContext: this,
        ruleHandlers: this.spannedRuleHandlers,
        onTokenError: (err: TLEX.TokenizerError) => {
          this.errors.push(err);
          return true;
        },
      });
      return ptree;
    } catch (err) {
      if (err instanceof G.ParseError) {
        this.errors.push(err);
      } else {
        throw err;
      }
    }
    return null;
  }

  parseAndBuild(input: string): [Notation, G.ParseError[]] {
    this.parse(input);
    const notation = new Notation();
    const errors: G.ParseError[] = [];
    errors.push(...this.errors);

    // First add the metadata then we can set it
    for (const key in this.metadata) notation.addMetaData(new Meta(key, this.metadata[key]));
    // Commands validate their params when built, so applying one should not throw.  If one
    // does, report it like any other error so load() still returns.
    for (const cmd of [...this.frontMatterCommands(errors), ...this.commands]) {
      try {
        cmd.applyToNotation(notation);
      } catch (e: any) {
        errors.push(new G.ParseError(`${cmd.name}: ${e?.message ?? e}`, "CommandFailed", cmd.name));
      }
    }
    return [notation, errors];
  }

  /**
   * The document defaults front matter declares, as the commands that set them.
   *
   * `cycle`, `beatDuration` and `breaks` (any case) mean what `\cycle(...)`, `\beatDuration(...)`
   * and `\breaks(...)` mean at the top of the body. They apply first, so a command in the body
   * still overrides them. A value the command rejects becomes a ParseError in `errors`, with
   * the key named, rather than an exception.
   */
  private frontMatterCommands(errors: G.ParseError[]): Command[] {
    const commands: Command[] = [];
    const data = this.metadata;
    if (!data || typeof data !== "object") return commands;
    for (const key of Object.keys(data)) {
      const name = FRONT_MATTER_COMMANDS[key.toLowerCase()];
      if (!name) continue;
      const values = name === "breaks" && Array.isArray(data[key]) ? data[key] : [data[key]];
      const params: CmdParam[] = values.map((value: any) => ({ key: null, value }));
      try {
        // The command's constructor validates the params and throws on a bad value.
        const cmd = this.buildCommand(name, params);
        if (cmd) commands.push(cmd);
      } catch (e: any) {
        errors.push(new Error(`front matter ${key}: ${e?.message ?? e}`) as unknown as G.ParseError);
      }
    }
    return commands;
  }

  /** Reads an embellishment token with the parser from the options, or returns `[null, false]`. */
  parseEmbelishment(value: string): [any, boolean] {
    return this.embellishments ? this.embellishments(value) : [null, false];
  }
}

/** Grows `atom.sourceRange` to cover the input that `children` came from. */
function widenRange(atom: Atom, children: G.PTNode[]): void {
  let start: number | null = null;
  let end: number | null = null;
  for (const c of children) {
    if (c.start != null && (start == null || c.start < start)) start = c.start;
    if (c.end != null && (end == null || c.end > end)) end = c.end;
  }
  if (start == null || end == null) return;
  const r = atom.sourceRange;
  atom.sourceRange = r ? [Math.min(r[0], start), Math.max(r[1], end)] : [start, end];
}
