/**
 * Tests for patterns used in the docs playgrounds.
 * These tests validate that the code snippets in the playgrounds work correctly.
 */
import { Parser, Note, Space, Group, Atom, Literal } from "../../src";

describe("Playground Patterns", () => {
  describe("Model Events Playground - parseNotation pattern", () => {
    /**
     * This is the pattern used in the model-events playground to parse
     * notation input and extract atoms from AddAtoms commands.
     */
    function parseNotation(input: string): Atom[] {
      if (!input.trim()) return [];

      const parser = new Parser();
      parser.parse(input);

      // Extract atoms from AddAtoms commands in parser.commands
      const atoms: Atom[] = [];
      parser.commands.forEach((cmd: any) => {
        // AddAtoms commands have an atoms array
        if (cmd.atoms && Array.isArray(cmd.atoms)) {
          cmd.atoms.forEach((atom: Atom) => {
            atoms.push(atom);
          });
        }
      });

      return atoms;
    }

    // Helper to get atom value (works for Note, Literal, etc.)
    function getAtomValue(atom: Atom): string {
      if (atom instanceof Literal || atom instanceof Note) {
        return atom.value;
      }
      return "";
    }

    it("should parse simple notes (as Literals without role context)", () => {
      const atoms = parseNotation("S R G M");
      expect(atoms).toHaveLength(4);
      // Without role context, these are Literals, not Notes
      expect(atoms[0]).toBeInstanceOf(Literal);
      expect(getAtomValue(atoms[0])).toBe("S");
      expect(getAtomValue(atoms[1])).toBe("R");
      expect(getAtomValue(atoms[2])).toBe("G");
      expect(getAtomValue(atoms[3])).toBe("M");
    });

    it("should parse notes with spaces", () => {
      const atoms = parseNotation("S , R");
      expect(atoms).toHaveLength(3);
      expect(atoms[0]).toBeInstanceOf(Literal);
      expect(atoms[1]).toBeInstanceOf(Space);
      expect(atoms[2]).toBeInstanceOf(Literal);
    });

    it("should parse groups", () => {
      const atoms = parseNotation("S [ R G ] M");
      expect(atoms).toHaveLength(3);
      expect(atoms[0]).toBeInstanceOf(Literal);
      expect(atoms[1]).toBeInstanceOf(Group);
      expect(atoms[2]).toBeInstanceOf(Literal);

      const group = atoms[1] as Group;
      let groupAtoms: Atom[] = [];
      group.atoms.forEach((a) => {
        groupAtoms.push(a);
        return true;
      });
      expect(groupAtoms).toHaveLength(2);
    });

    it("should parse octave markers", () => {
      const atoms = parseNotation("S. .R");
      expect(atoms).toHaveLength(2);
      // S. and .R are parsed as Notes with octave info
      expect((atoms[0] as Note).octave).toBe(1); // S. = upper octave
      expect((atoms[1] as Note).octave).toBe(-1); // .R = lower octave
    });

    it("should parse duration prefixes", () => {
      const atoms = parseNotation("2 S R");
      expect(atoms).toHaveLength(2);
      // First atom has duration 2
      expect((atoms[0] as Literal).duration.num).toBe(2);
      // Second atom has default duration 1
      expect((atoms[1] as Literal).duration.num).toBe(1);
    });

    it("should return empty array for empty input", () => {
      expect(parseNotation("")).toEqual([]);
      expect(parseNotation("   ")).toEqual([]);
    });

    it("should parse nested groups", () => {
      const atoms = parseNotation("[ S [ R G ] ]");
      expect(atoms).toHaveLength(1);
      expect(atoms[0]).toBeInstanceOf(Group);

      const outerGroup = atoms[0] as Group;
      let outerAtoms: Atom[] = [];
      outerGroup.atoms.forEach((a) => {
        outerAtoms.push(a);
        return true;
      });
      expect(outerAtoms).toHaveLength(2);
      expect(outerAtoms[0]).toBeInstanceOf(Literal);
      expect(outerAtoms[1]).toBeInstanceOf(Group);
    });

    it("should handle multiple spaces (karvai)", () => {
      const atoms = parseNotation("S , , R");
      expect(atoms).toHaveLength(4);
      expect(atoms[0]).toBeInstanceOf(Literal);
      expect(atoms[1]).toBeInstanceOf(Space);
      expect(atoms[2]).toBeInstanceOf(Space);
      expect(atoms[3]).toBeInstanceOf(Literal);
    });

    it("should parse complex notation", () => {
      const atoms = parseNotation("S R [ G M P ] , D N S.");
      expect(atoms).toHaveLength(7);
      expect(atoms[0]).toBeInstanceOf(Literal);
      expect(atoms[1]).toBeInstanceOf(Literal);
      expect(atoms[2]).toBeInstanceOf(Group);
      expect(atoms[3]).toBeInstanceOf(Space);
      expect(atoms[4]).toBeInstanceOf(Literal);
      expect(atoms[5]).toBeInstanceOf(Literal);
      // S. is parsed as Note with octave 1
      expect(atoms[6]).toBeInstanceOf(Note);
      expect((atoms[6] as Note).octave).toBe(1);
    });
  });

  describe("Parser.commands structure", () => {
    it("should populate commands array after parsing", () => {
      const parser = new Parser();
      parser.parse("S R G");
      expect(parser.commands.length).toBeGreaterThan(0);
    });

    it("should have AddAtoms commands with atoms property", () => {
      const parser = new Parser();
      parser.parse("S R G");

      const addAtomsCmd = parser.commands.find((cmd: any) => cmd.atoms) as any;
      expect(addAtomsCmd).toBeDefined();
      expect(Array.isArray(addAtomsCmd!.atoms)).toBe(true);
      expect(addAtomsCmd!.atoms.length).toBe(3);
    });

    it("should throw on invalid commands", () => {
      const parser = new Parser();
      // Invalid commands throw an error
      expect(() => {
        parser.parse("S R G \\invalidCommand");
      }).toThrow("Invalid command");
    });
  });
});
