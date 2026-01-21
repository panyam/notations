import * as TSU from "@panyam/tsutils";

/**
 * Parameter type for commands and markers.
 * Used by both Command and Marker classes.
 */
export type CmdParam = { key: TSU.Nullable<string>; value: any };

/**
 * Interface for entities that have parameters.
 */
export interface HasParams {
  params: CmdParam[];
}

/**
 * Mixin that adds parameter handling to a class.
 * Provides getParam and getParamAt methods.
 * Works with both concrete and abstract base classes.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ParamsMixin<T extends abstract new (...args: any[]) => object>(Base: T) {
  abstract class Mixed extends Base implements HasParams {
    params: CmdParam[] = [];

    /**
     * Gets a parameter value by key.
     * @param key The parameter key to look for
     * @returns The parameter value, or null if not found
     */
    getParam(key: string): any {
      return this.params.find((p) => p.key === key)?.value ?? null;
    }

    /**
     * Gets a parameter value by index (for positional params).
     * @param index The parameter index
     * @returns The parameter value, or null if not found
     */
    getParamAt(index: number): any {
      return this.params[index]?.value ?? null;
    }
  }
  return Mixed;
}

/**
 * A common Entity base class with support for unique IDs, parent references,
 * copying, and debug info. This serves as the foundation for all entities
 * in the notation system.
 *
 * Note: Child management is intentionally NOT included here. Each container type
 * (BlockContainer, Line, Group, etc.) defines its own child management with
 * appropriate types.
 *
 * Observer Pattern:
 * Each observable entity subclass (Group, Role, Line, Block) manages its own
 * typed observer list. This provides type safety and clear contracts between
 * observables and observers.
 */
export class Entity {
  readonly TYPE: string = "Entity";

  private static counter = 0;
  /** Unique identifier for this entity */
  readonly uuid = Entity.counter++;
  /** Parent entity in the tree hierarchy */
  protected _parent: TSU.Nullable<Entity> = null;

  /**
   * Whether events/observer notifications are enabled for this entity.
   * Subclasses check this flag before notifying observers.
   */
  protected _eventsEnabled = false;

  /**
   * Creates a new Entity.
   * @param config Optional configuration object
   */
  constructor(config: any = null) {
    config = config || {};
    if (config.metadata) throw new Error("See where metadata is being passed");
  }

  /**
   * Enables observer notifications for this entity.
   * Call this to activate change notifications on entities that support them.
   * @returns This entity for method chaining
   */
  enableEvents(): this {
    this._eventsEnabled = true;
    return this;
  }

  /**
   * Disables observer notifications for this entity.
   * @returns This entity for method chaining
   */
  disableEvents(): this {
    this._eventsEnabled = false;
    return this;
  }

  /**
   * Checks if events/observer notifications are enabled.
   */
  get eventsEnabled(): boolean {
    return this._eventsEnabled;
  }

  /**
   * Gets the parent entity.
   */
  get parent(): TSU.Nullable<Entity> {
    return this._parent;
  }

  /**
   * Sets the parent entity.
   * @param parent The parent entity to set
   */
  setParent(parent: TSU.Nullable<Entity>): void {
    this._parent = parent;
  }

  /**
   * Returns a debug-friendly representation of this entity.
   * Usually overridden by children to add more debug info.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { type: this.TYPE };
  }

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
    // Subclasses override to copy their specific properties
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
