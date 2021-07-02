import * as TSU from "@panyam/tsutils";
import * as TLEX from "tlex";

export enum TokenType {
  COMMA = "COMMA",
  SEMI_COLON = ";",
  COLON = ":",
  PLUS = "+",
  MINUS = "-",
  EQUALS = "EQUALS",
  STRING = "STRING",
  RAW_STRING = "RAW_STR",
  COMMENT = "COMMENT",
  NUMBER = "NUMBER",
  SPACES = "SPACES",
  IDENT = "IDENT",
  DOTTED_IDENT = "DOTTED_IDENT",
  DOTS = "...",
  OPEN_SQ = "OPEN_SQ",
  CLOSE_SQ = "CLOSE_SQ",
  OPEN_PAREN = "OPEN_PAREN",
  CLOSE_PAREN = "CLOSE_PAREN",
  OPEN_BRACE = "{",
  CLOSE_BRACE = "}",
  SLASH = "/",
  BSLASH = "\\",
  BSLASH_IDENT = "BSLASH_IDENT",
  BSLASH_NUMBER = "BSLASH_NUMBER",
}

const ReservedChars = {
  "#": true,
  "&": true,
  "%": true,
  "@": true,
  ":": true,
  "!": true,
  "*": true,
  "~": true,
  "`": true,
  "'": true,
  '"': true,
  ".": true,
  "^": true,
  "|": true,
  "?": true,
  "<": true,
  ">": true,
  $: true,
} as TSU.StringMap<boolean>;

export const SingleChTokens = {
  "[": TokenType.OPEN_SQ,
  "]": TokenType.CLOSE_SQ,
  "=": TokenType.EQUALS,
  "(": TokenType.OPEN_PAREN,
  ")": TokenType.CLOSE_PAREN,
  "{": TokenType.OPEN_BRACE,
  "}": TokenType.CLOSE_BRACE,
  "\\": TokenType.BSLASH,
  "/": TokenType.SLASH,
  "+": TokenType.PLUS,
  "-": TokenType.MINUS,
  ",": TokenType.COMMA,
  ";": TokenType.SEMI_COLON,
  ":": TokenType.COLON,
} as TSU.StringMap<TokenType>;

export const isSpace = (ch: string): boolean => ch.trim() === "";
export const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9";
export function isIdentChar(ch: string): boolean {
  if (ch in SingleChTokens) return false;
  if (ch in ReservedChars) return false;
  if (isSpace(ch)) return false;
  if (isDigit(ch)) return false;
  return true;
}

/*
export function rawStringMatcher(tape: tlex.Tape, offset: number): TSU.Nullable<TLEX.Token> {
  // see if are beginning with a raw string starter:
  // <###....
  if (!tape.matches("<#")) {
    return null;
  }
  // start with "#" since we already matched one above in "<#"
  let out = "#";
  while (tape.hasMore && tape.currCh == "#") {
    out += tape.nextCh();
  }
  const newPos = tape.advanceAfter(out + ">");
  if (newPos < 0) {
    // Unexpected EOF
    throw new ltb.UnexpectedTokenError(null);
  }
  const value = tape.substring(offset, tape.index);
  return new ltb.Token(TokenType.RAW_STRING, { value: value });
}
*/
