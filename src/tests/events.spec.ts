import { Group, Note, Space, Role, Line, ZERO, ONE } from "../core";
import { Block } from "../block";
import {
  ModelEvents,
  AtomChangeType,
  AtomChangeEvent,
  RoleChangeType,
  RoleChangeEvent,
  BlockItemChangeType,
  BlockItemChangeEvent,
} from "../events";
import * as TSU from "@panyam/tsutils";

describe("Model Change Events", () => {
  describe("Group events", () => {
    test("addAtoms emits ATOMS_CHANGED event with ADD type", () => {
      const group = new Group();
      group.enableEvents();

      const events: AtomChangeEvent[] = [];
      group.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      const note1 = new Note("S");
      const note2 = new Note("R");
      group.addAtoms(false, note1, note2);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.ADD);
      expect(events[0].atoms).toEqual([note1, note2]);
      expect(events[0].index).toBe(0);
    });

    test("insertAtomsAt emits ATOMS_CHANGED event with INSERT type", () => {
      const group = new Group();
      group.enableEvents();

      // Add initial atoms
      const note1 = new Note("S");
      const note3 = new Note("M");
      group.addAtoms(false, note1, note3);

      const events: AtomChangeEvent[] = [];
      group.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      // Insert between existing atoms
      const note2 = new Note("R");
      group.insertAtomsAt(note3, false, note2);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.INSERT);
      expect(events[0].atoms).toEqual([note2]);
      expect(events[0].index).toBe(1);
    });

    test("removeAtoms emits ATOMS_CHANGED event with REMOVE type", () => {
      const group = new Group();
      group.enableEvents();

      const note1 = new Note("S");
      const note2 = new Note("R");
      group.addAtoms(false, note1, note2);

      const events: AtomChangeEvent[] = [];
      group.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      group.removeAtoms(false, note1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.REMOVE);
      expect(events[0].atoms).toEqual([note1]);
    });

    test("no event emitted when events not enabled", () => {
      const group = new Group();
      // Events NOT enabled

      const events: AtomChangeEvent[] = [];
      const unsubscribe = group.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      expect(unsubscribe).toBeUndefined();

      const note1 = new Note("S");
      group.addAtoms(false, note1);

      expect(events.length).toBe(0);
    });

    test("unsubscribe stops receiving events", () => {
      const group = new Group();
      group.enableEvents();

      const events: AtomChangeEvent[] = [];
      const unsubscribe = group.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      const note1 = new Note("S");
      group.addAtoms(false, note1);
      expect(events.length).toBe(1);

      // Unsubscribe
      unsubscribe!();

      const note2 = new Note("R");
      group.addAtoms(false, note2);
      expect(events.length).toBe(1); // Still 1, no new event
    });
  });

  describe("Role events", () => {
    test("addAtoms emits ATOMS_CHANGED event", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const events: AtomChangeEvent[] = [];
      role.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      const note1 = new Note("S");
      const note2 = new Note("R");
      role.addAtoms(note1, note2);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.ADD);
      expect(events[0].atoms).toEqual([note1, note2]);
    });

    test("insertAtomsAt emits ATOMS_CHANGED event with INSERT type", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const note1 = new Note("S");
      const note3 = new Note("M");
      role.addAtoms(note1, note3);

      const events: AtomChangeEvent[] = [];
      role.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      const note2 = new Note("R");
      role.insertAtomsAt(1, note2);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.INSERT);
      expect(events[0].atoms).toEqual([note2]);
      expect(events[0].index).toBe(1);
    });

    test("removeAtoms emits ATOMS_CHANGED event", () => {
      const line = new Line();
      const role = new Role(line, "swaras");
      role.enableEvents();

      const note1 = new Note("S");
      const note2 = new Note("R");
      role.addAtoms(note1, note2);

      const events: AtomChangeEvent[] = [];
      role.on(ModelEvents.ATOMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as AtomChangeEvent);
      });

      role.removeAtoms(note1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(AtomChangeType.REMOVE);
      expect(events[0].atoms).toEqual([note1]);
    });
  });

  describe("Line events", () => {
    test("ensureRole emits ROLES_CHANGED event when new role created", () => {
      const line = new Line();
      line.enableEvents();

      const events: RoleChangeEvent[] = [];
      line.on(ModelEvents.ROLES_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as RoleChangeEvent);
      });

      const role = line.ensureRole("swaras", true);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(RoleChangeType.ADD);
      expect(events[0].roleName).toBe("swaras");
    });

    test("ensureRole does not emit event for existing role", () => {
      const line = new Line();
      line.enableEvents();

      // Create role first
      line.ensureRole("swaras", true);

      const events: RoleChangeEvent[] = [];
      line.on(ModelEvents.ROLES_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as RoleChangeEvent);
      });

      // Try to ensure same role again
      line.ensureRole("swaras", true);

      expect(events.length).toBe(0); // No new event
    });

    test("removeRole emits ROLES_CHANGED event", () => {
      const line = new Line();
      line.enableEvents();

      line.ensureRole("swaras", true);

      const events: RoleChangeEvent[] = [];
      line.on(ModelEvents.ROLES_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as RoleChangeEvent);
      });

      const removed = line.removeRole("swaras");

      expect(removed).toBe(true);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(RoleChangeType.REMOVE);
      expect(events[0].roleName).toBe("swaras");
    });

    test("removeRole returns false for non-existent role", () => {
      const line = new Line();
      line.enableEvents();

      const events: RoleChangeEvent[] = [];
      line.on(ModelEvents.ROLES_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as RoleChangeEvent);
      });

      const removed = line.removeRole("nonexistent");

      expect(removed).toBe(false);
      expect(events.length).toBe(0);
    });
  });

  describe("Block events", () => {
    test("addBlockItem emits ITEMS_CHANGED event", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const events: BlockItemChangeEvent[] = [];
      block.on(ModelEvents.ITEMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as BlockItemChangeEvent);
      });

      const line = new Line();
      block.addBlockItem(line);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(BlockItemChangeType.ADD);
      expect(events[0].item).toBe(line);
      expect(events[0].index).toBe(0);
    });

    test("removeBlockItem emits ITEMS_CHANGED event", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const line = new Line();
      block.addBlockItem(line);

      const events: BlockItemChangeEvent[] = [];
      block.on(ModelEvents.ITEMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as BlockItemChangeEvent);
      });

      const index = block.removeBlockItem(line);

      expect(index).toBe(0);
      expect(events.length).toBe(1);
      expect(events[0].type).toBe(BlockItemChangeType.REMOVE);
      expect(events[0].item).toBe(line);
      expect(events[0].index).toBe(0);
    });

    test("removeBlockItem returns -1 for non-existent item", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const events: BlockItemChangeEvent[] = [];
      block.on(ModelEvents.ITEMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as BlockItemChangeEvent);
      });

      const line = new Line();
      const index = block.removeBlockItem(line);

      expect(index).toBe(-1);
      expect(events.length).toBe(0);
    });

    test("multiple items track correct indices", () => {
      const block = new Block("test", null);
      block.enableEvents();

      const events: BlockItemChangeEvent[] = [];
      block.on(ModelEvents.ITEMS_CHANGED, (e: TSU.Events.TEvent) => {
        events.push(e.payload as BlockItemChangeEvent);
      });

      const line1 = new Line();
      const line2 = new Line();
      const line3 = new Line();

      block.addBlockItem(line1);
      block.addBlockItem(line2);
      block.addBlockItem(line3);

      expect(events.length).toBe(3);
      expect(events[0].index).toBe(0);
      expect(events[1].index).toBe(1);
      expect(events[2].index).toBe(2);
    });
  });
});
