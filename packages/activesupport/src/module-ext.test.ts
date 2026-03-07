import { describe, it, expect } from "vitest";
import {
  delegate,
  mattrAccessor,
  cattrAccessor,
  attrInternal,
  isAnonymous,
  moduleParentName,
} from "./module-ext.js";

describe("ModuleTest", () => {
  it("delegate — creates method that forwards to target property", () => {
    class Place {
      street = "Paulina";
      city = "Chicago";
    }
    class Person {
      place: Place;
      constructor(place: Place) {
        this.place = place;
      }
    }
    delegate(Person.prototype, "street", "city", { to: "place" });
    const p = new Person(new Place()) as Person & { street: string; city: string };
    expect(p.street).toBe("Paulina");
    expect(p.city).toBe("Chicago");
  });

  it("delegate with prefix true — prepends target name", () => {
    class Client {
      label = "David";
    }
    class Invoice {
      client: Client;
      constructor(client: Client) {
        this.client = client;
      }
    }
    delegate(Invoice.prototype, "label", { to: "client", prefix: true });
    const inv = new Invoice(new Client()) as Invoice & { client_label: string };
    expect(inv.client_label).toBe("David");
  });

  it("delegate with custom prefix — prepends custom prefix", () => {
    class Client {
      label = "David";
    }
    class Invoice {
      client: Client;
      constructor(client: Client) {
        this.client = client;
      }
    }
    delegate(Invoice.prototype, "label", { to: "client", prefix: "customer" });
    const inv = new Invoice(new Client()) as Invoice & { customer_label: string };
    expect(inv.customer_label).toBe("David");
  });

  it("delegate with allowNil true — returns undefined when target is nil", () => {
    class Project {
      person: null | { title: string } = null;
    }
    delegate(Project.prototype, "title", { to: "person", allowNil: true });
    const proj = new Project() as Project & { title: string | undefined };
    expect(proj.title).toBeUndefined();
  });

  it("delegate without allowNil — throws when target is nil", () => {
    class Someone {
      place: null | { street: string } = null;
    }
    delegate(Someone.prototype, "street", { to: "place" });
    const s = new Someone() as Someone & { street: string };
    expect(() => s.street).toThrow();
  });

  it("delegate returns generated method names", () => {
    class Foo {}
    const names = delegate(Foo.prototype, "bar", "baz", { to: "qux" });
    expect(names).toEqual(["bar", "baz"]);
  });

  it("delegate with prefix returns prefixed method names", () => {
    class Foo {}
    const names = delegate(Foo.prototype, "bar", { to: "qux", prefix: "the" });
    expect(names).toEqual(["the_bar"]);
  });

  it("mattr_accessor — defines class-level getter/setter", () => {
    class MyClass {}
    mattrAccessor(MyClass as unknown as { new(): unknown } & Record<string, unknown>, "setting");
    const klass = MyClass as unknown as Record<string, unknown>;
    klass["setting"] = 42;
    expect(klass["setting"]).toBe(42);
    klass["setting"] = "hello";
    expect(klass["setting"]).toBe("hello");
  });

  it("cattr_accessor — alias for mattrAccessor", () => {
    class Config {}
    cattrAccessor(Config as unknown as { new(): unknown } & Record<string, unknown>, "value");
    const klass = Config as unknown as Record<string, unknown>;
    klass["value"] = 99;
    expect(klass["value"]).toBe(99);
  });

  it("attr_internal reader and writer — underscore-prefixed storage", () => {
    class Widget {}
    attrInternal(Widget.prototype, "color");
    const w = new Widget() as Widget & { color: unknown };
    w.color = "red";
    expect(w.color).toBe("red");
    // Stored in _color_
    expect((w as Record<string, unknown>)["_color_"]).toBe("red");
  });

  it("attr_internal writer method — sets value via assignment method", () => {
    class Widget {}
    attrInternal(Widget.prototype, "size");
    const w = new Widget() as Widget & { size: unknown; "size=": (v: unknown) => void };
    w["size="]("large");
    expect(w.size).toBe("large");
  });

  it("isAnonymous — returns true for unnamed class", () => {
    const anon = (() => class {})();
    expect(isAnonymous(anon)).toBe(true);
  });

  it("isAnonymous — returns false for named class", () => {
    class Named {}
    expect(isAnonymous(Named)).toBe(false);
  });

  it("moduleParentName — returns null for top-level class", () => {
    class TopLevel {}
    expect(moduleParentName(TopLevel)).toBeNull();
  });

  it("moduleParentName — returns parent namespace for namespaced class", () => {
    // We simulate a namespaced class by naming it "Outer::Inner"
    const Inner = { name: "Outer::Inner" } as unknown as Function;
    expect(moduleParentName(Inner)).toBe("Outer");
  });
});
