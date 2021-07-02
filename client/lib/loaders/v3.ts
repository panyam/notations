import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { Note, Atom, Space, Syllable, Group } from "../models/index";
import { Snippet, CmdParam } from "../notebook";
import { AddAtoms, SetProperty, ActivateRole, CreateRole, CreateLine, RunCommand } from "./commands";

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
    %define IdentChar     /[^\[\]={}()\\+\-,;: \t\f\r\n\v]/
    %token  OPEN_SQ       "["
    %token  CLOSE_SQ      "]"
    %token  EQUALS        "="
    %token  OPEN_PAREN    "("
    %token  CLOSE_PAREN   ")"
    %token  OPEN_BRACE    "{"
    %token  CLOSE_BRACE   "}"
    %token  BSLASH        "\\"
    %token  SLASH         "/"
    %token  PLUS          "+"
    %token  MINUS         "-"
    %token  COMMA         ","
    %token  SEMI_COLON    ";"
    %token  COLON         ":"
    %token  NUMBER        /\\d+/
    %token  STRING        /".*?(?<!\\\\)"/
    %token  DOTS_IDENT    /\\.+{IdentChar}+/
    %token  IDENT_DOTS    /{IdentChar}+\\.+/
    %token  IDENT         /{IdentChar}+/
    %token  BLASH_IDENT   /\\{IDENT}/
    %token  BLASH_NUMBER  /\\{NUMBER}/
    %skip                 /[ \\t\\n\\f\\r]+/
    %skip                 /\/\/.*$/
    %skip                 /\/\*.*?\*\//
    %skip                 /\-/

    Elements -> Elements Seperator Atoms;
    Elements -> Atoms ;

    Seperator -> Command | RoleSelector ;

    Command -> BSLASH_IDENT ;
    Command -> BSLASH_IDENT CommandParams ;
    CommandParams  -> OPEN_PAREN  CLOSE_PAREN ;
    CommandParams -> OPEN_PAREN ParamList CLOSE_PAREN ;

    ParamList -> ParamList COMMA Param ;
    ParamList -> Param ;
    Param -> ParamKey ;
    Param -> ParamKey EQUALS ParamValue ;
    ParamKey  -> STRING | Fraction | IDENT ;
    ParamValue -> STRING | Fraction | IDENT ;

    RoleSelector -> IDENT_COLON ;

    Atoms -> Atoms Atom ;
    Atoms -> ;

    Atom -> Duration Leaf ;
    Atom -> Leaf ;

    Leaf -> Space | Lit | Group ;

    Space -> COMMA | SEMI_COLON | UNDER_SCORE ;
    Lit -> DOT_IDENT | IDENT | IDENT_DOT | STRING ;
    Group -> OPEN_SQ Atoms CLOSE_SQ ;

    Duration -> Fraction ;
    Fraction -> NUMBER ;
    Fraction -> NUMBER SLASH NUMBER ;
  `,
  { allowLeftRecursion: true, debug: "all" },
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
    } else if (lName == "run") {
      this.snippet.add(new RunCommand(params));
      this.runCommandFound = true;
    } else {
      // Try to set this as the current role
      throw new Error("Invalid command: " + lName);
    }
  }

  parse(input: string): void {
    /*
    this.tokenizer.tape.push(input);
    let token = this.tokenizer.peek();
    while (token != null) {
      if (token.tag == TokenType.BSLASH) {
        // set tokenizer state to command reading
        const cmd = this.parseCommand();
        this.addCommand(cmd.name, cmd.params);
      } else if (token.tag == TokenType.MINUS) {
        // Hyphens on their own are innocuous - for now -
        // we migth want to conver them into "visual breaks"
        this.tokenizer.next();
      } else {
        const atom = this.parseAtom();
        this.snippet.add(new AddAtoms(atom));
      }
      token = this.tokenizer.peek();
    }
   */
  }

  /*
  parseCommand(): Command {
    const out = new Command();
    let token = this.tokenizer.expectToken(TokenType.BSLASH);
    token = this.tokenizer.expectToken(TokenType.IDENT);
    out.name = token.value;
    if (this.tokenizer.nextMatches(TokenType.OPEN_PAREN)) {
      this.parseCommandParams(out);
    }
    return out;
  }

  parseCommandParams(cmd: Command) {
    this.tokenizer.expectToken(TokenType.OPEN_PAREN);
    let done = false;
    while (!done) {
      let token = this.tokenizer.expectToken(
        TokenType.STRING,
        TokenType.NUMBER,
        TokenType.IDENT,
        TokenType.CLOSE_PAREN,
      );
      let key: any = null;
      let value: any = null;
      if (token.tag == TokenType.STRING) {
        key = token.value;
      } else if (token.tag == TokenType.NUMBER) {
        key = token.value;
        if (this.tokenizer.consumeIf(TokenType.SLASH) != null) {
          const den = this.tokenizer.expectToken(TokenType.NUMBER);
          key = TSU.Num.Frac(value, den.value);
        }
      } else if (token.tag == TokenType.IDENT) {
        key = token.value;
        while (
          this.tokenizer.match(
            (t) => t.tag === TokenType.IDENT,
            false,
            true,
            (token) => (key += token.value),
          ) != null
        );
      } else {
        // CLOSE_PAREN so break out
        break;
      }

      // "=" or "," or "CLOSE"
      token = this.tokenizer.expectToken(TokenType.EQUALS, TokenType.COMMA, TokenType.CLOSE_PAREN);
      if (token.tag == TokenType.EQUALS) {
        token = this.tokenizer.expectToken(TokenType.STRING, TokenType.NUMBER, TokenType.IDENT);
        if (token.tag == TokenType.STRING) {
          value = token.value;
        } else if (token.tag == TokenType.NUMBER) {
          value = token.value;
          if (this.tokenizer.consumeIf(TokenType.SLASH) != null) {
            const den = this.tokenizer.expectToken(TokenType.NUMBER);
            value = TSU.Num.Frac(value, den.value);
          }
        } else if (token.tag == TokenType.IDENT) {
          value = token.value;
          while (
            this.tokenizer.match(
              (t) => t.tag === TokenType.IDENT,
              false,
              true,
              (token) => (value += token.value),
            ) != null
          );
        }
        // next *must* be a COMMA or a CLOSE_P
        token = this.tokenizer.expectToken(TokenType.COMMA, TokenType.CLOSE_PAREN);
        done = token.tag == TokenType.CLOSE_PAREN;
      } else if (token.tag == TokenType.CLOSE_PAREN) {
        done = true;
      } else {
        // COMMA
        // nothing - go ahead to next kv pair
        const a = 0;
      }
      if (value == null) {
        cmd.params.push({ key: null, value: key });
      } else {
        cmd.params.push({ key: key, value: value });
      }
    }
  }

  parseAtom(): Atom {
    // Extract duration if found
    const duration = this.parseDuration();

    let token = this.tokenizer.next();
    if (token == null) {
      throw new G.ParseError(-1, "Unexpected end of input after duration");
    }

    if (token.tag == TokenType.COMMA) {
      return new Space(duration || ONE);
    }

    if (token.value == "_") {
      return new Space(duration || ONE, true);
    }

    if (token.tag == TokenType.SEMI_COLON) {
      return new Space((duration || ONE).timesNum(2));
    }

    if (token.tag == TokenType.OPEN_SQ) {
      token = this.tokenizer.peek();
      const children: Atom[] = [];
      while (token != null && token.tag != TokenType.CLOSE_SQ) {
        const atom = this.parseAtom();
        if (atom == null) break;
        children.push(atom);
        token = this.tokenizer.peek();
      }
      this.tokenizer.expectToken(TokenType.CLOSE_SQ);
      return new Group(duration || ONE, ...children);
    }

    // Here we MUST be a syllable or a note
    // Both will be Identifiers at this point

    const role = this.snippet.currRole;
    if (token.tag == TokenType.IDENT) {
      // see if the next token is a ":" - indicating a role change
      // TODO - Should this become a top level production instead of at
      // the atom level? - Would need custom look ahead
      if (!duration) {
        const t2 = this.tokenizer.peek();
        if (t2?.tag == TokenType.COLON) {
          // Ensure this follows immediately after the ident
          // kicking off a role change
          if (t2.immediatelyFollows(token)) {
            // consume it
            this.tokenizer.next();
            this.activateRole(token.value);
            return this.parseAtom();
          }
        }
      }
      if (role.notesOnly) {
        return new Note(token.value, duration || ONE);
      } else {
        return new Syllable(token.value, duration || ONE);
      }
    } else if (token.tag == TokenType.STRING) {
      if (role.notesOnly) {
        throw new G.ParseError(token.offset, "Strings cannot appear when writing notes");
      } else {
        return new Syllable(token.value, duration || ONE);
      }
    } else if (token.tag == TokenType.DOTTED_IDENT) {
      const [value, octave] = token.value;
      if (role.notesOnly) {
        return new Note(value, duration || ONE, octave);
      } else {
        return new Syllable(value, duration || ONE);
      }
    }

    throw new G.UnexpectedTokenError(token);
  }

  parseDuration(): TSU.Nullable<TSU.Num.Fraction> {
    let token = this.tokenizer.consumeIf(TokenType.NUMBER);
    if (token == null) return null;

    // then parse a number or fraction for duration
    const num = token.value;

    if (this.tokenizer.consumeIf(TokenType.SLASH) == null) {
      return TSU.Num.Frac(num);
    }

    // we have a slash so expect a number now
    token = this.tokenizer.expectToken(TokenType.NUMBER);
    const den = token.value;
    return TSU.Num.Frac(num, den);
  }
 */

  activateRole(roleName: string): void {
    const lName = roleName.toLowerCase().trim();
    if (this.snippet.getRole(lName) != null) {
      this.snippet.add(new ActivateRole([{ key: null, value: lName }]));
    } else {
      throw new Error("Invalid role or entity type: " + name);
    }
  }
}
