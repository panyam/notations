import * as TSU from "@panyam/tsutils";

/**
 * A common Entity base class with support for unique IDs, copying, children and
 * debug info.
 */
export class Entity {
  readonly TYPE: string = "Entity";

  // readonly TYPE:string = "Entity";
  private static counter = 0;
  readonly uuid = Entity.counter++;
  // private metadata: TSU.StringMap<any>;
  // parent: TSU.Nullable<Entity> = null;

  constructor(config: any = null) {
    config = config || {};
    if (config.metadata) throw new Error("See where metadata is being passed");
    // this.metadata = config.metadata || {};
  }

  /**
   * debugValue returns information about this entity to be printed during a debug.
   * Usually overridden by children to add more debug info.
   */
  debugValue(): any {
    // if (Object.keys(this.metadata).length > 0) return { metadata: this.metadata, type: this.type };
    return { type: this.TYPE };
  }

  /**
   * Children of this entity.
   */
  children(): Entity[] {
    return [];
  }

  /**
   * Property returning the count of child entities.
   */
  get childCount(): number {
    return this.children().length;
  }

  /**
   * Adds a child entity at a given index.
   * @param child   Child entity to be aded.
   * @param index   Index where the child is to be inserted.  -1 to append at the end.
   */
  addChild(child: Entity, index = -1): this {
    if (index < 0) {
      this.children().push(child);
    } else {
      this.children().splice(index, 0, child);
    }
    return this;
  }

  /**
   * Returns the child at a given index.
   */
  childAt(index: number): Entity {
    return this.children()[index];
  }

  /**
   * Returns the index of a given child entity.
   *
   * @return the index where child exists otherwise -1.
   */
  indexOfChild(entity: Entity): number {
    let i = 0;
    for (const child of this.children()) {
      if (child == entity) return i;
      i++;
    }
    return -1;
  }

  removeChildAt(index: number): Entity {
    const children = this.children();
    const out = children[index];
    children.splice(index, 1);
    return out;
  }

  setChildAt(index: number, entity: Entity): this {
    this.children()[index] = entity;
    return this;
  }

  /*
  setMetadata(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  getMetadata(key: string, recurse = true): any {
    if (key in this.metadata) {
      return this.metadata[key];
    }
    if (recurse && this.parent) {
      return this.parent.getMetadata(key);
    }
    return null;
  }
  */

  /**
   * Simple string representation of this Entity.
   */
  toString(): string {
    return `Entity(id = ${this.uuid})`;
  }

  equals(another: this, expect = false): boolean {
    if (this.TYPE != another.TYPE) return false;
    // check metadata too
    return true;
  }

  /**
   * All entities allow cloning in a way that is specific to the entity.
   * This allows application level "copy/pasting" of entities.  Cloning
   * is a two part process:
   *
   * * Creation of a new instance of the same type via this.newInstance()
   * * Copying of data into the new instance.
   *
   * Both of these can be overridden.
   */
  clone(): this {
    const out = this.newInstance();
    this.copyTo(out);
    return out;
  }

  /**
   * Copies information about this instance into another instance of the same type.
   */
  copyTo(another: this): void {
    // another.metadata = { ...this.metadata };
  }

  /**
   * First part of the cloning process where the instance is created.
   */
  protected newInstance(): this {
    return new (this.constructor as any)();
  }
}

/**
 * Music is all about timing!   TimedEntities are base of all entities that
 * have a duration.
 */
export abstract class TimedEntity extends Entity {
  readonly TYPE: string = "TimedEntity";

  /**
   * Duration of this entity in beats.
   * By default entities durations are readonly
   */
  abstract get duration(): TSU.Num.Fraction;

  equals(another: this): boolean {
    return super.equals(another) && this.duration.equals(another.duration);
  }
}
