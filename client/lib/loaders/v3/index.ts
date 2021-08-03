import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import * as TLEX from "tlex";
import { AtomType, Note, Atom, Space, Syllable, Group } from "../../models/index";
import { Snippet, CmdParam } from "../../models/notebook";
import { AddAtoms, SetProperty, ActivateRole, CreateRole, CreateLine } from "./commands";

const ONE = TSU.Num.Fraction.ONE;

/**
 * V3 of our parser builds on V2 and has the following improvements:
 *
 * 1. No restrictions on line by line parsing.
 * 2. Explicit command syntax removes ambiguity on line specific rules on what
 *    constitute entities etc
 */
const [parser, itemGraph] = G.newParser(
  String.raw`
    %define IdentChar     /[^\[\]={}()+\-,;: \t\f\r\n\v\\\.]/

    %token  BSLASH        "\\"
    %token  OPEN_SQ       "["
    %token  CLOSE_SQ      "]"
    %token  EQUALS        "="
    %token  OPEN_PAREN    "("
    %token  CLOSE_PAREN   ")"
    %token  OPEN_BRACE    "{"
    %token  CLOSE_BRACE   "}"
    %token  SLASH         "/"
    %token  PLUS          "+"
    %token  MINUS         "-"
    %token  COMMA         ","
    %token  SEMI_COLON    ";"
    %token  COLON         ":"

    %token  NUMBER        /\d+/                     { toNumber }
    %token  BOOLEAN       /true|false/              { toBoolean }
    %token  STRING        /"([^"\\\n]|\\.|\\\n)*"/  { toString }
    %token  STRING        /'([^'\\\n]|\\.|\\\n)*'/  { toString }
    %token  DOTS_IDENT    /(\.+)({IdentChar}+)/     { toOctavedNote   }
    %token  IDENT_DOTS    /({IdentChar}+)(\.+)/     { toOctavedNote   }
    %token  IDENT_COLON   /{IdentChar}+:/           { toRoleSelector  }
    %token  IDENT         /{IdentChar}+/
    %token  BSLASH_IDENT  /\\{IDENT}/               { toCommandName   }
    %token  BSLASH_NUMBER /\\{NUMBER}/
    %skip                 /[ \t\n\f\r]+/
    %skip_flex            "//.*$"
    %skip                 /\/\*.*?\*\//
    %skip                 "-"

    Elements -> Elements Command Atoms { appendCommand } 
              | Elements RoleSelector Atoms { appendRoleSelector } 
              | Atoms { appendAtoms }
              ;

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

    Leaf -> Space | Lit | Group ;

    Space -> COMMA { newSpace } 
          | SEMI_COLON { newDoubleSpace } 
          | UNDER_SCORE { newSilentSpace } 
          ;

    Lit -> DOTS_IDENT { litToAtom } 
        | IDENT { litToAtom } 
        | IDENT_DOTS { litToAtom } 
        | STRING  { litToAtom }
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
      toCommandName: (token: TLEX.Token, tape: TLEX.Tape) => {
        token.value = token.value.substring(1);
        return token;
      },
      toBoolean: (token: TLEX.Token, tape: TLEX.Tape) => {
        token.value = token.value == "true";
        return token;
      },
      toNumber: (token: TLEX.Token, tape: TLEX.Tape) => {
        token.value = parseInt(token.value);
        return token;
      },
      toString: (token: TLEX.Token, tape: TLEX.Tape) => {
        token.value = token.value.substring(1, token.value.length - 1);
        return token;
      },
      toOctavedNote: (token: TLEX.Token, tape: TLEX.Tape) => {
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
      toRoleSelector: (token: TLEX.Token, tape: TLEX.Tape) => {
        token.value = token.value.substring(0, token.value.length - 1);
        return token;
      },
    },
  },
);

export class Command {
  name = "_";
  params: CmdParam[] = [];
}

/**
 * A notation doc is a list of lines that are found in a single document.
 *
 * Since our document (md or html etc) can contain multiple snippets
 * all these snippets are related
 */
export class V3Parser {
  readonly snippet: Snippet;
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
    litToAtom: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const role = this.snippet.currRole;
      const lit = children[0];
      if (lit.sym.label == "DOTS_IDENT" || lit.sym.label == "IDENT_DOTS") {
        return lit.value;
      } else if (lit.sym.label == "IDENT") {
        return role.notesOnly ? new Note(lit.value) : new Syllable(lit.value);
      } else if (lit.sym.label == "STRING") {
        if (role.notesOnly) throw new Error("Strings cannot appear in notes only mode");
        return new Syllable(lit.value);
      } else {
        throw new Error("Invalid lit: " + lit);
      }
    },
    newSpace: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      return new Space();
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
      const cmd = new Command();
      cmd.name = children[0].value;
      cmd.params = children[1].value;
      return cmd;
    },
    appendAtoms: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const atoms = children[0].value as Atom[];
      if (atoms.length > 0) {
        const cmd = new AddAtoms(...atoms);
        this.snippet.add(cmd);
      }
      return null;
    },
    appendCommand: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      const command = children[1].value as Command;
      this.addCommand(command.name, command.params);

      const atoms = children[2].value as Atom[];
      if (atoms.length > 0) {
        this.snippet.add(new AddAtoms(...atoms));
      }
      return null;
    },
    appendRoleSelector: (rule: G.Rule, parent: G.PTNode, ...children: G.PTNode[]) => {
      this.activateRole(children[1].value);

      const atoms = children[2].value as Atom[];
      if (atoms.length > 0) {
        this.snippet.add(new AddAtoms(...atoms));
      }
      return null;
    },
  };

  constructor(snippet: Snippet, config?: any) {
    config = config || {};
    this.snippet = snippet;
  }

  addCommand(name: string, params: CmdParam[]): void {
    const lName = name.trim().toLowerCase();
    if (lName == "line") {
      this.snippet.add(new CreateLine(params));
    } else if (lName == "role") {
      this.snippet.add(new CreateRole(params));
    } else if (lName == "set") {
      this.snippet.add(new SetProperty(params));
    } else {
      // Try to set this as the current role
      throw new Error("Invalid command: " + lName);
    }
  }

  parse(input: string): any {
    const ptree = parser.parse(input, {
      ruleHandlers: this.ruleHandlers,
    });
    return ptree;
  }

  activateRole(roleName: string): void {
    const lName = roleName.toLowerCase().trim();
    if (this.snippet.getRole(lName) != null) {
      this.snippet.add(new ActivateRole([{ key: null, value: lName }]));
    } else {
      throw new Error("Invalid role or entity type: " + name);
    }
  }
}
