export class AttributeSet {
  private attributes = new Map<string, unknown>();

  get(name: string): unknown {
    return this.attributes.get(name);
  }

  set(name: string, value: unknown): void {
    this.attributes.set(name, value);
  }
}

export class Builder {
  build(): AttributeSet {
    return new AttributeSet();
  }
}

export class LazyAttributeSet extends AttributeSet {}

export class LazyAttributeHash {
  private data = new Map<string, unknown>();

  get(name: string): unknown {
    return this.data.get(name);
  }
}
