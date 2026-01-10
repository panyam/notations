import { Group, Note, Space, Role, Line, ZERO, ONE, Atom } from "../core";
import { Block } from "../block";
import {
  AtomChangeType,
  RoleChangeType,
  GroupObserver,
  RoleObserver,
  LineObserver,
  BlockObserver,
} from "../events";

describe("Model Change Events - Observer Pattern", () => {
  describe("Group events", () => {
    test("addAtoms notifies observer with onAtomsAdded", () => {
      const group = new Group();
      group.enableEvents();

      const addedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsAdded: (g, atoms, index) => {
          addedCalls.push({ atoms, index });
        },
      };
      group.addObserver(observer);

      const note1 = new Note("S");
      const note2 = new Note("R");
      group.addAtoms(false, note1, note2);

      expect(addedCalls.length).toBe(1);
      expect(addedCalls[0].atoms).toEqual([note1, note2]);
      expect(addedCalls[0].index).toBe(0);
    });

    test("insertAtomsAt notifies observer with onAtomsInserted", () => {
      const group = new Group();
      group.enableEvents();

      // Add initial atoms
      const note1 = new Note("S");
      const note3 = new Note("M");
      group.addAtoms(false, note1, note3);

      const insertedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsInserted: (g, atoms, index) => {
          insertedCalls.push({ atoms, index });
        },
      };
      group.addObserver(observer);

      // Insert between existing atoms
      const note2 = new Note("R");
      group.insertAtomsAt(note3, false, note2);

      expect(insertedCalls.length).toBe(1);
      expect(insertedCalls[0].atoms).toEqual([note2]);
      expect(insertedCalls[0].index).toBe(1);
    });

    test("removeAtoms notifies observer with onAtomsRemoved", () => {
      const group = new Group();
      group.enableEvents();

      const note1 = new Note("S");
      const note2 = new Note("R");
      group.addAtoms(false, note1, note2);

      const removedCalls: { atoms: Atom[] }[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsRemoved: (g, atoms) => {
          removedCalls.push({ atoms });
        },
      };
      group.addObserver(observer);

      group.removeAtoms(false, note1);

      expect(removedCalls.length).toBe(1);
      expect(removedCalls[0].atoms).toEqual([note1]);
    });

    test("no notification when events not enabled", () => {
      const group = new Group();
      // Events NOT enabled

      const addedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsAdded: (g, atoms, index) => {
          addedCalls.push({ atoms, index });
        },
      };
      group.addObserver(observer);

      const note1 = new Note("S");
      group.addAtoms(false, note1);

      expect(addedCalls.length).toBe(0);
    });

    test("removeObserver stops receiving notifications", () => {
      const group = new Group();
      group.enableEvents();

      const addedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsAdded: (g, atoms, index) => {
          addedCalls.push({ atoms, index });
        },
      };
      const unsubscribe = group.addObserver(observer);

      const note1 = new Note("S");
      group.addAtoms(false, note1);
      expect(addedCalls.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      const note2 = new Note("R");
      group.addAtoms(false, note2);
      expect(addedCalls.length).toBe(1); // Still 1, no new notification
    });
  });

  describe("Role events", () => {
    test("addAtoms notifies observer with onAtomsAdded", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const addedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: RoleObserver<Atom, Role> = {
        onAtomsAdded: (r, atoms, index) => {
          addedCalls.push({ atoms, index });
        },
      };
      role.addObserver(observer);

      const note1 = new Note("S");
      const note2 = new Note("R");
      role.addAtoms(note1, note2);

      expect(addedCalls.length).toBe(1);
      expect(addedCalls[0].atoms).toEqual([note1, note2]);
    });

    test("insertAtomsAt notifies observer with onAtomsInserted", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const note1 = new Note("S");
      const note3 = new Note("M");
      role.addAtoms(note1, note3);

      const insertedCalls: { atoms: Atom[]; index: number }[] = [];
      const observer: RoleObserver<Atom, Role> = {
        onAtomsInserted: (r, atoms, index) => {
          insertedCalls.push({ atoms, index });
        },
      };
      role.addObserver(observer);

      const note2 = new Note("R");
      role.insertAtomsAt(1, note2);

      expect(insertedCalls.length).toBe(1);
      expect(insertedCalls[0].atoms).toEqual([note2]);
      expect(insertedCalls[0].index).toBe(1);
    });

    test("removeAtoms notifies observer with onAtomsRemoved", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const note1 = new Note("S");
      const note2 = new Note("R");
      role.addAtoms(note1, note2);

      const removedCalls: { atoms: Atom[] }[] = [];
      const observer: RoleObserver<Atom, Role> = {
        onAtomsRemoved: (r, atoms) => {
          removedCalls.push({ atoms });
        },
      };
      role.addObserver(observer);

      role.removeAtoms(note1);

      expect(removedCalls.length).toBe(1);
      expect(removedCalls[0].atoms).toEqual([note1]);
    });
  });

  describe("Line events", () => {
    test("ensureRole notifies observer with onRoleAdded when new role created", () => {
      const line = new Line();
      line.enableEvents();

      const addedCalls: { roleName: string; role: Role }[] = [];
      const observer: LineObserver<Role, Line> = {
        onRoleAdded: (l, roleName, role) => {
          addedCalls.push({ roleName, role });
        },
      };
      line.addObserver(observer);

      const role = line.ensureRole("swaras", true);

      expect(addedCalls.length).toBe(1);
      expect(addedCalls[0].roleName).toBe("swaras");
      expect(addedCalls[0].role).toBe(role);
    });

    test("ensureRole does not notify for existing role", () => {
      const line = new Line();
      line.enableEvents();

      // Create role first
      line.ensureRole("swaras", true);

      const addedCalls: { roleName: string }[] = [];
      const observer: LineObserver<Role, Line> = {
        onRoleAdded: (l, roleName) => {
          addedCalls.push({ roleName });
        },
      };
      line.addObserver(observer);

      // Try to ensure same role again
      line.ensureRole("swaras", true);

      expect(addedCalls.length).toBe(0); // No new notification
    });

    test("removeRole notifies observer with onRoleRemoved", () => {
      const line = new Line();
      line.enableEvents();

      line.ensureRole("swaras", true);

      const removedCalls: { roleName: string }[] = [];
      const observer: LineObserver<Role, Line> = {
        onRoleRemoved: (l, roleName) => {
          removedCalls.push({ roleName });
        },
      };
      line.addObserver(observer);

      const removed = line.removeRole("swaras");

      expect(removed).toBe(true);
      expect(removedCalls.length).toBe(1);
      expect(removedCalls[0].roleName).toBe("swaras");
    });

    test("removeRole returns false for non-existent role", () => {
      const line = new Line();
      line.enableEvents();

      const removedCalls: { roleName: string }[] = [];
      const observer: LineObserver<Role, Line> = {
        onRoleRemoved: (l, roleName) => {
          removedCalls.push({ roleName });
        },
      };
      line.addObserver(observer);

      const removed = line.removeRole("nonexistent");

      expect(removed).toBe(false);
      expect(removedCalls.length).toBe(0);
    });
  });

  describe("Block events", () => {
    test("addBlockItem notifies observer with onItemAdded", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const addedCalls: { item: any; index: number }[] = [];
      const observer: BlockObserver = {
        onItemAdded: (b, item, index) => {
          addedCalls.push({ item, index });
        },
      };
      block.addObserver(observer);

      const line = new Line();
      block.addBlockItem(line);

      expect(addedCalls.length).toBe(1);
      expect(addedCalls[0].item).toBe(line);
      expect(addedCalls[0].index).toBe(0);
    });

    test("removeBlockItem notifies observer with onItemRemoved", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const line = new Line();
      block.addBlockItem(line);

      const removedCalls: { item: any; index: number }[] = [];
      const observer: BlockObserver = {
        onItemRemoved: (b, item, index) => {
          removedCalls.push({ item, index });
        },
      };
      block.addObserver(observer);

      const index = block.removeBlockItem(line);

      expect(index).toBe(0);
      expect(removedCalls.length).toBe(1);
      expect(removedCalls[0].item).toBe(line);
      expect(removedCalls[0].index).toBe(0);
    });

    test("removeBlockItem returns -1 for non-existent item", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const removedCalls: { item: any; index: number }[] = [];
      const observer: BlockObserver = {
        onItemRemoved: (b, item, index) => {
          removedCalls.push({ item, index });
        },
      };
      block.addObserver(observer);

      const line = new Line();
      const index = block.removeBlockItem(line);

      expect(index).toBe(-1);
      expect(removedCalls.length).toBe(0);
    });

    test("multiple items track correct indices", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const addedCalls: { item: any; index: number }[] = [];
      const observer: BlockObserver = {
        onItemAdded: (b, item, index) => {
          addedCalls.push({ item, index });
        },
      };
      block.addObserver(observer);

      const line1 = new Line();
      const line2 = new Line();
      const line3 = new Line();

      block.addBlockItem(line1);
      block.addBlockItem(line2);
      block.addBlockItem(line3);

      expect(addedCalls.length).toBe(3);
      expect(addedCalls[0].index).toBe(0);
      expect(addedCalls[1].index).toBe(1);
      expect(addedCalls[2].index).toBe(2);
    });
  });

  describe("Observer pattern benefits", () => {
    test("observer receives typed parameters", () => {
      const group = new Group();
      group.enableEvents();

      // The observer can access strongly-typed parameters
      const observer: GroupObserver<Atom, Group> = {
        onAtomsAdded: (group: Group, atoms: Atom[], index: number) => {
          // Type-safe access to group methods
          expect(group.TYPE).toBe("Group");
          // Type-safe access to atoms
          expect(atoms.every((a) => a.duration !== undefined)).toBe(true);
          // Type-safe index
          expect(typeof index).toBe("number");
        },
      };
      group.addObserver(observer);

      group.addAtoms(false, new Note("S"));
    });

    test("multiple observers receive notifications", () => {
      const group = new Group();
      group.enableEvents();

      let observer1Called = false;
      let observer2Called = false;

      const observer1: GroupObserver<Atom, Group> = {
        onAtomsAdded: () => {
          observer1Called = true;
        },
      };

      const observer2: GroupObserver<Atom, Group> = {
        onAtomsAdded: () => {
          observer2Called = true;
        },
      };

      group.addObserver(observer1);
      group.addObserver(observer2);

      group.addAtoms(false, new Note("S"));

      expect(observer1Called).toBe(true);
      expect(observer2Called).toBe(true);
    });

    test("observer can implement subset of methods", () => {
      const group = new Group();
      group.enableEvents();

      // Observer only implements onAtomsAdded, not onAtomsRemoved
      const addedCalls: number[] = [];
      const observer: GroupObserver<Atom, Group> = {
        onAtomsAdded: (g, atoms, index) => {
          addedCalls.push(index);
        },
        // onAtomsRemoved not implemented - should not cause error
      };
      group.addObserver(observer);

      const note = new Note("S");
      group.addAtoms(false, note);
      group.removeAtoms(false, note); // Should not throw

      expect(addedCalls.length).toBe(1);
    });
  });
});
