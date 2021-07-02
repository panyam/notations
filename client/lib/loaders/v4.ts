/**
 * V4 of our parser builds on V3 and has the following improvements:
 *
 * 1. Embedding Headings to demarcate sections so users dont have to use
 *    explicit MD for headings.
 * 2. Parseable by LR parser.
 */
const grammar = `
  /*
   * Tokens:
   *  STRING := "[^"]*" | '[^']*'
   *  NUMBER := Digit +
   *  FRACTION := NUMBER "/" NUMBER
   *  IDENT := IdentChar (IdentChar|Digit)*
   *
   *  SINGLE_LINE_RAW_STRING := "^>.*$"
   *
   *  // "<" followed by n "#" kicks of a multiline embedding for custom blocks 
   *  // to be in.
   *  // Everythign between this and SAME NUMBER of "#" followed by  ">" is treated 
   *  // as embedded content.  Advantage is we can have multiple
   *  // such embeddings within this and each embedding can be taken care of by 
   *  // its own parser.  Allowing a variable length opening and closing tag means
   *  // the author can decide this based on what is inside it.
   *  // Eg:
   *  // <####
   *  // This is a bit of Markdown we are using.
   *  // This set of << and >> are skipped.
   *  // ####>
   *  // 
   *  // How should we treat the following cases:
   *  // 1. Ending in multiple end blocks ###>###> - this owuld happen if the
   *  //    author tried to have nested blocks of equal length. We could allow 
   *  //    recursive blocks by having "equal" size ones as repeate.  Eg:
   *  //    <# <# this is a RS within an RS #> #>
   *  //
   *  //    So is this since the second one automatically matches by virtue of
   *  //    of the second "#" in the <## being skipped by the outer "<#"
   *  //    <# <## this is a RS within an RS ##> #>
   *  //
   *  // 2. False positives?
   *  //
   *  //  <# here is some javascript code: x = "<#"; #>
   *  //
   *  // If we allowed recursion then this would fail to match.  We can already 
   *  //
   *  // Best to not allow recursion as the author can already select the length
   *  // of the "#"s based on the content they expect to see in the body.  Also
   *  // using a start indicator (say "<<#{n}" to indicate "allow" recursions wont
   *  // work if the same start block was again embedded.
   *  RAW_STRING := <#{n}.*#{n}>
   */
  Snippet -> ( Command | RoleSelector | Atoms | Embedding | COMMENT ) * ;
  Command -> SLASH_IDENT CommandParams ? ;
  CommandParams  -> OPEN_PAREN ParamList ? CLOSE_PAREN ;
  ParamList -> Param |  ParamList COMMA Param ;
  Param -> ParamKey [ EQUALS ParamValue ] ;
  ParamKey  -> STRING | Fraction | IDENT ;
  ParamValue -> STRING | Fraction | IDENT ;
  Fraction -> NUMBER [ "/" NUMBER ] ;

  Embedding -> SINGLE_LINE_RAW_STRING | RAW_STRING ;

  Atoms := Atom * ;

  Atom := Duration ? ( SpaceAtom | Literal | Group )
  Duration := NUMBER | Fraction ;

  SpaceAtom := "," | ";" | "_" ;
  Group := OPEN_SQ Atom * CLOSE_SQ ;
  Literal := DOTS_IDENT | IDENT | IDENT_DOTS | STRING ;
`;
