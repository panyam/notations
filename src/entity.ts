import * as TSU from "@panyam/tsutils";

/**
 * A common Entity base class with support for unique IDs, copying, children and
 * debug info. This serves as the foundation for all entities in the notation system.
 */
export class Entity {
  readonly TYPE: string = "Entity";

  // readonly TYPE:string = "Entity";
  private static counter = 0;
  /** Unique identifier for this entity */
  readonly uuid = Entity.counter++;
  // private metadata: TSU.StringMap<any>;
  // parent: TSU.Nullable<Entity> = null;

  /**
   * Creates a new Entity.
   * @param config Optional configuration object
   */
  constructor(config: any = null) {
    config = config || {};
    if (config.metadata) throw new Error("See where metadata is being passed");
    // this.metadata = config.metadata || {};
  }

  /**
   * Returns a debug-friendly representation of this entity.
   * Usually overridden by children to add more debug info.
   * @returns An object containing debug information
   */
  debugValue(): any {
    // if (Object.keys(this.metadata).length > 0) return { metadata: this.metadata, type: this.type };
    return { type: this.TYPE };
  }

  /**
   * Gets all child entities of this entity.
   * @returns An array of child entities
   */
  children(): Entity[] {
    return [];
  }

  /**
   * Gets the count of child entities.
   */
  get childCount(): number {
    return this.children().length;
  }

  /**
   * Adds a child entity at a given index.
   * @param child Child entity to be added
   * @param index Index where the child is to be inserted, -1 to append at the end
   * @returns This entity instance for method chaining
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
   * @param index The index of the child to retrieve
   * @returns The child entity at the specified index
   */
  childAt(index: number): Entity {
    return this.children()[index];
  }

  /**
   * Returns the index of a given child entity.
   * @param entity The child entity to find
   * @returns The index where the child exists, or -1 if not found
   */
  indexOfChild(entity: Entity): number {
    let i = 0;
    for (const child of this.children()) {
      if (child == entity) return i;
      i++;
    }
    return -1;
  }

  /**
   * Removes and returns the child entity at the specified index.
   * @param index The index of the child to remove
   * @returns The removed child entity
   */
  removeChildAt(index: number): Entity {
    const children = this.children();
    const out = children[index];
    children.splice(index, 1);
    return out;
  }

  /**
   * Sets a child entity at the specified index.
   * @param index The index where to set the child
   * @param entity The entity to set at the index
   * @returns This entity instance for method chaining
   */
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
   * Returns a simple string representation of this Entity.
   * @returns A string representation
   */
  toString(): string {
    return `Entity(id = ${this.uuid})`;
  }

  /**
   * Checks if this Entity is equal to another Entity.
   * @param another The Entity to compare with
   * @param expect Optional parameter
   * @returns True if the Entities are equal, false otherwise
   */
  equals(another: this, expect = false): boolean {
    if (this.TYPE != another.TYPE) return false;
    // check metadata too
    return true;
  }

  /**
   * Creates a clone of this entity.
   * Cloning is a two-part process:
   * 1. Creation of a new instance via this.newInstance()
   * 2. Copying of data into the new instance via this.copyTo()
   *
   * @returns A new instance of the same type with the same properties
   */
  clone(): this {
    const out = this.newInstance();
    this.copyTo(out);
    return out;
  }

  /**
   * Copies information about this instance into another instance of the same type.
   * @param another The target instance to copy properties to
   */
  copyTo(another: this): void {
    // another.metadata = { ...this.metadata };
  }

  /**
   * First part of the cloning process where the instance is created.
   * @returns A new instance of the same type
   */
  protected newInstance(): this {
    return new (this.constructor as any)();
  }
}

/**
 * Music is all about timing! TimedEntities are base of all entities that
 * have a duration. This is an abstract class that all timed entities inherit from.
 */
export abstract class TimedEntity extends Entity {
  readonly TYPE: string = "TimedEntity";

  /**
   * Gets the duration of this entity in terms of beats.
   * By default, entity durations are readonly.
   */
  abstract get duration(): TSU.Num.Fraction;

  /**
   * Checks if this TimedEntity is equal to another TimedEntity.
   * @param another The TimedEntity to compare with
   * @returns True if the TimedEntities are equal, false otherwise
   */
  equals(another: this): boolean {
    return super.equals(another) && this.duration.equals(another.duration);
  }
}
