import * as TSU from "@panyam/tsutils";

export class KeyedEnv {
  parent: TSU.Nullable<KeyedEnv>;
  refs: TSU.StringMap<any> = {};
  constructor(parent: TSU.Nullable<KeyedEnv> = null, values?: any) {
    this.parent = parent;
    for (const key in values) {
      this.refs[key] = { value: values[key] };
    }
  }

  clear(): void {
    this.refs = {};
  }

  getref(key: string): any {
    if (key in this.refs) {
      return this.refs[key];
    } else if (this.parent != null) {
      return this.parent.getref(key);
    }
    return null;
  }

  get(key: string): any {
    const ref = this.getref(key);
    if (ref == null) {
      return null;
    }
    return ref.value;
  }

  replace(key: string, value: any): this {
    const ref = this.getref(key);
    if (ref != null) ref.value = value;
    else TSU.assert(false);
    return this;
  }

  setone(key: string, value: any): this {
    this.refs[key] = { value: value };
    return this;
  }

  /**
   * Create a new environment by extending this one with new variable bindings.
   */
  push(): KeyedEnv {
    return new KeyedEnv(this);
  }

  /**
   * Create a new environment by extending this one with new variable bindings.
   */
  extend(items: TSU.StringMap<any>): KeyedEnv {
    return this.push().set(items);
  }

  /**
   * Sets items in this context.
   */
  set(items: TSU.StringMap<any>): this {
    for (const key in items) {
      this.setone(key, items[key]);
    }
    return this;
  }
}

export class OrderedEnv<OrderKeyType> {
  refs: [KeyType, string, any][] = [];
  parent: TSU.Nullable<OrderedEnv<OrderKeyType>> = null;
  constructor(parent: TSU.Nullable<OrderedEnv<OrderKeyType>> = null) {
    this.parent = parent;
  }
}
