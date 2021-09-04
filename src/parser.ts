import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import * as TLEX from "tlex";
import { Literal, AtomType, Note, Atom, Rest, Space, Syllable, Group } from "./core";
import { Command, CmdParam } from "./notation";
import {
  RawEmbedding,
  ApplyLayout,
  AddAtoms,
  SetCycle,
  SetAPB,
  SetBreaks,
  ActivateRole,
  CreateRole,
  CreateLine,
  MetaData,
} from "./commands";

// TODO - Make this plugable from the client instead of hard coded
import * as carnatic from "./carnatic";

const ONE = TSU.Num.Fraction.ONE;

/**
 * V4 of our parser builds on V3 and has the following improvements:
 *
 * 1. Embedding Headings to demarcate sections so users dont have to use
 *    explicit MD for headings.
 * 2. Unlike V3 here users break out *of* song instead instead break out "into"
 * song.  So users spend more time writing notation and less worrying about
 * other things like headings etc.
 */
const [parser, itemGraph] = G.newParser(
  String.raw`
    %define IdentChar     /[^|\[\]={}()+\-,;~: \t\f\r\n\v\\\.]/

    %token  BSLASH        "\\"
    %token  OPEN_SQ       "["
    %token  CLOSE_SQ      "]"
    %token  EQUALS        "="
    %token  OPEN_PAREN    "("
    %token  CLOSE_PAREN   ")"
    %token  OPEN_BRACE    "{"
    %token  CLOSE_BRACE   "}"
    %token  SLASH         "/"
    // %skip "-"
    %token  COMMA         ","
    %token  SEMI_COLON    ";"
    %token  COLON         ":"

    %token  SINGLE_LINE_RAW_STRING       />(.*)$/m    { toSingleLineRawString }
    %token  MULTI_LINE_RAW_STRING        /r(#{0,})"/  { toMultiLineRawString }

    %token  EMBELISHMENT  /~[^\s]*/                 { toEmbelishment }
    %token  NUMBER        /-?\d+/                   { toNumber }
    %token  BOOLEAN       /true|false/              { toBoolean }
    %token  STRING        /"([^"\\\n]|\\.|\\\n)*"/  { toString }
    %token  STRING        /'([^'\\\n]|\\.|\\\n)*'/  { toString }
    %token  DOTS_IDENT    /(\.+)({IdentChar}+)/     { toOctavedNote   }
    %token  IDENT_DOTS    /({IdentChar}+)(\.+)/     { toOctavedNote   }
    %token  IDENT_COLON   /{IdentChar}+:/           { toRoleSelector  }
    %token  IDENT         /{IdentChar}+/
    %token  BSLASH_IDENT  /\\{IDENT}/               { toCommandName   }
    %token  BSLASH_NUMBER /\\{NUMBER}/
    %token  HYPHEN        /-/
    %skip                 /[ \t\n\f\r]+/
    %skip_flex            "//.*$"
    %skip                 /\/\*.*?\*\//

    Elements -> Elements Command Atoms { appendCommand } 
              | Elements RoleSelector Atoms { appendRoleSelector } 
              | Elements Embedding  Atoms { insertEmbedding }
              | Atoms { appendAtoms }
              ;

    Embedding -> SINGLE_LINE_RAW_STRING | MULTI_LINE_RAW_STRING ;

    Command -> BSLASH_IDENT CommandParams ? { newCommand } ;
    CommandParams -> OPEN_PAREN ParamList ? CLOSE_PAREN { $2 } ;

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
    Atom -> Duration  Leaf { applyDuration } ;
    Leaf -> Space | Lit | Group | Rest ;
    Rest -> HYPHEN { newRest };

    Space -> COMMA { newSpace } 
          | SEMI_COLON { newDoubleSpace } 
          | UNDER_SCORE { newSilentSpace } 
          ;

    Lit -> DOTS_IDENT { litToAtom } 
        | IDENT { litToAtom } 
        | IDENT_DOTS { litToAtom } 
        | STRING  { litToAtom }
        | PRE_EMB Lit { litWithPreEmb }
        // | Lit POST_EMB { litWithPostEmb }
        ;

    Group -> OPEN_SQ Atoms CLOSE_SQ { newGroup };

    Duration -> Fraction | NUMBER;
    Fraction -> NUMBER SLASH NUMBER { newFraction } ;
    `,
  {
    allowLeftRecursion: true,
    debug: "",
    type: "lalr",
    tokenHandlers: {
      toEmbelishment: (token: TLEX.Token, tape: TLEX.Tape, owner: Parser) => {
        const emb = owner.parseEmbelishment(token.value);
        if (emb == null) {
          console.log("Skipping Embelishment: ", token.value);
          return null;
        }
        token.value = emb;
        token.tag = "PRE_EMB";
        return token;
      },
      toCommandName: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = token.value.substring(1);
        return token;
      },
      toBoolean: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = token.value == "true";
        return token;
      },
      toNumber: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = parseInt(token.value);
        return token;
      },
      toString: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = token.value.substring(1, token.value.length - 1);
        return token;
      },
      toOctavedNote: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
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
      toRoleSelector: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        token.value = token.value.substring(0, token.value.length - 1);
        return token;
      },
      toSingleLineRawString: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
        // skip the initial ">"
        token.value = token.value.substring(1);
        return token;
      },
      toMultiLineRawString: (token: TLEX.Token, tape: TLEX.Tape, owner: any) => {
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
    },
  },
);

/**
 * A notation doc is a list of lines that are found in a single document.
 *
 * Since our document (md or html etc) can contain multiple snippets
 * all these snippets are related
 */
export class Parser {
  readonly commands: Command[] = [];
  // readonly notation: Notation = new Notation();
  private runCommandFound = false;
  // readonly parseTree = new PTNodeList("Snippet", null);

  protected ruleHandlers = {
    newFraction: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      if (children.length == 1) {
        return new TSU.Num.Fraction(children[0].value);
      } else {
        return new TSU.Num.Fraction(children[0].value, children[2].value);
      }
    },
    newGroup: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Group(ONE, ...children[1].value);
    },
    litWithPreEmb: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const emb = children[0];
      const lit = children[1].value as Literal;
      lit.embelishmentsBefore.splice(0, 0, emb.value);
      return lit;
    },
    litWithPostEmb: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const lit = children[0].value as Literal;
      const emb = children[1];
      lit.embelishmentsAfter.push(emb);
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
    newSpace: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Space();
    },
    newRest: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Rest();
    },
    newDoubleSpace: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Space(ONE.timesNum(2));
    },
    newSilentSpace: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Space(ONE, true);
    },
    applyDuration: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      let dur = children[0].value as TSU.Num.Fraction | number;
      const leaf = children[1].value as Atom;
      if (typeof dur === "number") {
        dur = ONE.timesNum(dur);
      }
      leaf.duration = dur;
      if (leaf.type == AtomType.GROUP) {
        (leaf as Group).durationIsMultiplier = true;
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
    newCommand: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return this.createCommand(children[0].value, children[1].value);
    },
    appendAtoms: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const atoms = children[0].value as Atom[];
      if (atoms.length > 0) {
        this.addCommand(new AddAtoms(...atoms));
      }
      return null;
    },
    appendCommand: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const command = children[1].value as Command;
      this.addCommand(command);

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

  constructor(config?: any) {
    config = config || {};
  }

  createCommand(name: string, params: CmdParam[]): Command {
    const lName = name.trim().toLowerCase();
    params = params || [];
    if (lName == "line") {
      return new CreateLine(params);
    } else if (lName == "meta") {
      return new MetaData(params);
    } else if (lName == "role") {
      return new CreateRole(params);
    } else if (lName == "layout") {
      return new ApplyLayout(params);
    } else if (lName == "aksharasperbeat") {
      return new SetAPB(params);
    } else if (lName == "breaks") {
      return new SetBreaks(params);
    } else if (lName == "cycle") {
      return new SetCycle(params);
    } else {
      // Try to set this as the current role
      throw new Error("Invalid command: " + lName);
    }
  }

  addCommand(cmd: Command): void {
    cmd.index = this.commands.length;
    this.commands.push(cmd);
  }

  parse(input: string): any {
    const ptree = parser.parse(input, {
      tokenizerContext: this,
      ruleHandlers: this.ruleHandlers,
    });
    return ptree;
  }

  parseEmbelishment(value: string): any {
    return carnatic.parseEmbelishment(value);
  }
}
