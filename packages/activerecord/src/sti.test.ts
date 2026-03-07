import { describe, it, expect, beforeEach } from "vitest";
import { Base, MemoryAdapter, enableSti, registerSubclass, registerModel } from "./index.js";

/**
 * Single Table Inheritance tests.
 *
 * Mirrors: activerecord/test/cases/inheritance_test.rb (InheritanceTest)
 */
describe("InheritanceTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  // -------------------------------------------------------------------------
  // subclasses / descendants
  // -------------------------------------------------------------------------

  it("subclasses", () => {
    class Shape extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("type", "string");
        this.adapter = adapter;
        enableSti(Shape);
      }
    }
    class Circle extends Shape {
      static { registerSubclass(Circle); }
    }
    class Rectangle extends Shape {
      static { registerSubclass(Rectangle); }
    }

    expect(Shape.subclasses).toContain(Circle);
    expect(Shape.subclasses).toContain(Rectangle);
    expect(Shape.subclasses).not.toContain(Shape);
  });

  it("descendants", () => {
    class Animal extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("type", "string");
        this.adapter = adapter;
        enableSti(Animal);
      }
    }
    class Mammal extends Animal {
      static { registerSubclass(Mammal); }
    }
    class Dog extends Mammal {
      static { registerSubclass(Dog); }
    }
    class Cat extends Mammal {
      static { registerSubclass(Cat); }
    }

    const desc = Animal.descendants;
    expect(desc).toContain(Mammal);
    expect(desc).toContain(Dog);
    expect(desc).toContain(Cat);
    expect(desc).not.toContain(Animal);

    // Mammal's descendants don't include Animal
    expect(Mammal.descendants).toContain(Dog);
    expect(Mammal.descendants).toContain(Cat);
    expect(Mammal.descendants).not.toContain(Animal);
  });

  // -------------------------------------------------------------------------
  // table name inheritance / base class
  // -------------------------------------------------------------------------

  it("inheritance base class", () => {
    class Post extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("type", "string");
        this._tableName = "posts";
        this.adapter = adapter;
        enableSti(Post);
      }
    }
    class SpecialPost extends Post {
      static { registerSubclass(SpecialPost); }
    }
    class StiPost extends Post {
      static { registerSubclass(StiPost); }
    }

    expect(Post.baseClass).toBe(Post);
    expect(SpecialPost.baseClass).toBe(Post);
    expect(StiPost.baseClass).toBe(Post);
  });

  // -------------------------------------------------------------------------
  // STI base class query returns all types
  // -------------------------------------------------------------------------

  it("inheritance find all", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    await Firm.create({ name: "37signals" });
    await Client.create({ name: "Summit" });

    const all = await Company.all().toArray();
    expect(all).toHaveLength(2);
    const types = all.map((r: any) => r.constructor.name);
    expect(types).toContain("Firm");
    expect(types).toContain("Client");
  });

  it("alt inheritance find all", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cucumber extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cucumber);
        registerSubclass(Cucumber);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    await Cucumber.create({ name: "my cucumber" });
    await Cabbage.create({ name: "his cabbage" });

    const all = await Vegetable.all().toArray();
    const types = all.map((r: any) => r.constructor.name);
    expect(types).toContain("Cucumber");
    expect(types).toContain("Cabbage");
  });

  // -------------------------------------------------------------------------
  // STI subclass query scopes by type
  // -------------------------------------------------------------------------

  it("inheritance condition", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    await Firm.create({ name: "Alpha" });
    await Firm.create({ name: "Beta" });
    await Firm.create({ name: "Gamma" });
    await Client.create({ name: "Delta" });
    await Client.create({ name: "Epsilon" });

    const allCount = await Company.all().count();
    const firmCount = await Firm.all().count();
    const clientCount = await Client.all().count();

    expect(allCount).toBe(5);
    expect(firmCount).toBe(3);
    expect(clientCount).toBe(2);
  });

  it("alt inheritance condition", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cucumber extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cucumber);
        registerSubclass(Cucumber);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    await Cucumber.create({ name: "my cucumber" });
    await Cabbage.create({ name: "his cabbage" });
    await Cabbage.create({ name: "her cabbage" });
    await Cabbage.create({ name: "red cabbage" });

    expect(await Vegetable.all().count()).toBe(4);
    expect(await Cucumber.all().count()).toBe(1);
    expect(await Cabbage.all().count()).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Creating a subclass record sets type column
  // -------------------------------------------------------------------------

  it("inheritance save", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }

    const firm = new Firm({ name: "Next Angle" });
    await firm.save();

    const found = await Company.find(firm.id as number);
    expect(found).toBeInstanceOf(Firm);
  });

  it("alt inheritance save", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    const cabbage = new Cabbage({ name: "Savoy" });
    await cabbage.save();

    const savoy = await Vegetable.find(cabbage.id as number);
    expect(savoy).toBeInstanceOf(Cabbage);
  });

  // -------------------------------------------------------------------------
  // Loading a record with type column instantiates correct subclass
  // -------------------------------------------------------------------------

  it("inheritance find", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    const firmRecord = await Firm.create({ name: "37signals" });
    const clientRecord = await Client.create({ name: "Summit" });

    const firm = await Company.find(firmRecord.id as number);
    expect(firm).toBeInstanceOf(Firm);

    const client = await Company.find(clientRecord.id as number);
    expect(client).toBeInstanceOf(Client);
  });

  it("alt inheritance find", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cucumber extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cucumber);
        registerSubclass(Cucumber);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    const cucumberRecord = await Cucumber.create({ name: "my cucumber" });
    const cabbageRecord = await Cabbage.create({ name: "his cabbage" });

    const cucumber = await Vegetable.find(cucumberRecord.id as number);
    expect(cucumber).toBeInstanceOf(Cucumber);

    const cabbage = await Vegetable.find(cabbageRecord.id as number);
    expect(cabbage).toBeInstanceOf(Cabbage);
  });

  // -------------------------------------------------------------------------
  // becomes() returns instance of new class with same attributes
  // -------------------------------------------------------------------------

  it("alt becomes works with sti", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    const vegetableRecord = await Vegetable.create({ name: "my cucumber" });
    const vegetable = await Vegetable.find(vegetableRecord.id as number);
    expect(vegetable).toBeInstanceOf(Vegetable);

    const cabbage = vegetable.becomes(Cabbage);
    expect(cabbage).toBeInstanceOf(Cabbage);
  });

  // -------------------------------------------------------------------------
  // tableName is shared between base and subclasses
  // -------------------------------------------------------------------------

  it("subclasses use same table as base", () => {
    class Vehicle extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("type", "string");
        this._tableName = "vehicles";
        this.adapter = adapter;
        enableSti(Vehicle);
      }
    }
    class Car extends Vehicle {
      static { registerSubclass(Car); }
    }
    class Truck extends Vehicle {
      static { registerSubclass(Truck); }
    }

    expect(Car.tableName).toBe("vehicles");
    expect(Truck.tableName).toBe("vehicles");
  });

  // -------------------------------------------------------------------------
  // inheritance new with default class
  // -------------------------------------------------------------------------

  it("inheritance new with default class", () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }

    const company = new Company();
    expect(company).toBeInstanceOf(Company);
  });

  // -------------------------------------------------------------------------
  // find first within inheritance
  // -------------------------------------------------------------------------

  it("find first within inheritance", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    await Firm.create({ name: "37signals" });
    await Client.create({ name: "Summit" });

    const firm = await Company.where({ name: "37signals" }).first();
    expect(firm).toBeInstanceOf(Firm);

    const fromFirm = await Firm.where({ name: "37signals" }).first();
    expect(fromFirm).toBeInstanceOf(Firm);

    const notFound = await Client.where({ name: "37signals" }).first();
    expect(notFound).toBeNull();
  });

  it("alt find first within inheritance", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cucumber extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cucumber);
        registerSubclass(Cucumber);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    await Cucumber.create({ name: "my cucumber" });
    await Cabbage.create({ name: "his cabbage" });

    const cabbage = await Vegetable.where({ name: "his cabbage" }).first();
    expect(cabbage).toBeInstanceOf(Cabbage);

    const fromCabbage = await Cabbage.where({ name: "his cabbage" }).first();
    expect(fromCabbage).toBeInstanceOf(Cabbage);

    const notFound = await Cucumber.where({ name: "his cabbage" }).first();
    expect(notFound).toBeNull();
  });

  // -------------------------------------------------------------------------
  // finding incorrect type data
  // -------------------------------------------------------------------------

  it("finding incorrect type data", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    await Firm.create({ name: "37signals" });
    const client = await Client.create({ name: "Summit" });

    // Firm.find(clientId) should throw RecordNotFound since it scopes to type=Firm
    await expect(Firm.find(client.id as number)).rejects.toThrow();
    // Firm.find(firmId) should work
    const firm = await Firm.create({ name: "Another" });
    await expect(Firm.find(firm.id as number)).resolves.toBeInstanceOf(Firm);
  });

  it("alt finding incorrect type data", async () => {
    class Vegetable extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "vegetables";
        this.adapter = adapter;
        enableSti(Vegetable);
      }
    }
    class Cucumber extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cucumber);
        registerSubclass(Cucumber);
      }
    }
    class Cabbage extends Vegetable {
      static {
        this.adapter = adapter;
        registerModel(Cabbage);
        registerSubclass(Cabbage);
      }
    }

    const cabbage = await Cabbage.create({ name: "his cabbage" });
    const cucumber = await Cucumber.create({ name: "my cucumber" });

    // Cucumber.find(cabbageId) should throw RecordNotFound since it scopes to type=Cucumber
    await expect(Cucumber.find(cabbage.id as number)).rejects.toThrow();
    await expect(Cucumber.find(cucumber.id as number)).resolves.toBeInstanceOf(Cucumber);
  });

  // -------------------------------------------------------------------------
  // destroy all within inheritance
  // -------------------------------------------------------------------------

  it("destroy all within inheritance", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Firm extends Company {
      static {
        this.adapter = adapter;
        registerModel(Firm);
        registerSubclass(Firm);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }

    await Firm.create({ name: "Alpha" });
    await Firm.create({ name: "Beta" });
    await Firm.create({ name: "Gamma" });
    await Client.create({ name: "Delta" });
    await Client.create({ name: "Epsilon" });

    await Client.destroyAll();
    expect(await Client.all().count()).toBe(0);
    expect(await Firm.all().count()).toBe(3);
  });

  // -------------------------------------------------------------------------
  // complex inheritance
  // -------------------------------------------------------------------------

  it("complex inheritance", async () => {
    class Company extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("type", "string");
        this._tableName = "companies";
        this.adapter = adapter;
        enableSti(Company);
      }
    }
    class Client extends Company {
      static {
        this.adapter = adapter;
        registerModel(Client);
        registerSubclass(Client);
      }
    }
    class VerySpecialClient extends Client {
      static {
        this.adapter = adapter;
        registerModel(VerySpecialClient);
        registerSubclass(VerySpecialClient);
      }
    }

    const vsc = await VerySpecialClient.create({ name: "veryspecial" });

    // VerySpecialClient query should find it
    const found1 = await VerySpecialClient.where({ name: "veryspecial" }).first();
    expect(found1).toBeInstanceOf(VerySpecialClient);

    // Company base class should also find it
    const found2 = await Company.where({ name: "veryspecial" }).first();
    expect(found2).toBeInstanceOf(VerySpecialClient);

    // find by id on Company should return VerySpecialClient instance
    const found3 = await Company.find(vsc.id as number);
    expect(found3).toBeInstanceOf(VerySpecialClient);
  });

  // -------------------------------------------------------------------------
  // abstract class
  // -------------------------------------------------------------------------

  it("abstract class", () => {
    class LoosePerson extends Base {
      static {
        this.attribute("id", "integer");
        this.abstractClass = true;
        this.adapter = adapter;
      }
    }
    class LooseDescendant extends LoosePerson {
      static { registerSubclass(LooseDescendant); }
    }

    expect(Base.abstractClass).toBe(false);
    expect(LoosePerson.abstractClass).toBe(true);
    expect(LooseDescendant.abstractClass).toBe(false);
  });

  // -------------------------------------------------------------------------
  // inherits custom primary key
  // -------------------------------------------------------------------------

  it("inherits custom primary key", () => {
    class Subscriber extends Base {
      static {
        this.attribute("nick", "string");
        this.attribute("type", "string");
        this.primaryKey = "nick";
        this._tableName = "subscribers";
        this.adapter = adapter;
        enableSti(Subscriber);
      }
    }
    class SpecialSubscriber extends Subscriber {
      static { registerSubclass(SpecialSubscriber); }
    }

    expect(SpecialSubscriber.primaryKey).toBe("nick");
  });
});
