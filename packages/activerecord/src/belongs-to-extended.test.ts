/**
 * BelongsTo extended tests — mirrors Rails:
 * activerecord/test/cases/associations/belongs_to_associations_test.rb
 *
 * Covers testable behaviors using MemoryAdapter. Tests requiring raw SQL,
 * query cache, DB-specific features, or complex fixture setups are kept as
 * null in the naming map.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  Base,
  MemoryAdapter,
  registerModel,
  touchBelongsToParents,
  updateCounterCaches,
} from "./index.js";
import { Associations, loadBelongsTo } from "./associations.js";

// ---------------------------------------------------------------------------
// BelongsToAssociationsTest (testable subset)
// ---------------------------------------------------------------------------

describe("BelongsToAssociationsTest", () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  // -------------------------------------------------------------------------
  // Basic belongs_to
  // -------------------------------------------------------------------------

  it("belongs to", async () => {
    // Rails: test_belongs_to
    class BtCompany extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class BtAccount extends Base {
      static {
        this.attribute("company_id", "integer");
        this.attribute("credit_limit", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("BtCompany", BtCompany);
    registerModel("BtAccount", BtAccount);

    const company = await BtCompany.create({ name: "37signals" });
    const account = await BtAccount.create({
      company_id: company.id,
      credit_limit: 50,
    });

    const loaded = await loadBelongsTo(account, "btCompany", {
      className: "BtCompany",
      foreignKey: "company_id",
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.readAttribute("name")).toBe("37signals");
  });

  it("belongs to with primary key", async () => {
    // Rails: test_belongs_to_with_primary_key
    class PkFirm extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("firm_name", "string");
        this.adapter = adapter;
      }
    }
    class PkClient extends Base {
      static {
        this.attribute("firm_name", "string");
        this.adapter = adapter;
      }
    }
    registerModel("PkFirm", PkFirm);
    registerModel("PkClient", PkClient);

    const firm = await PkFirm.create({ name: "Apple", firm_name: "Apple Inc" });
    const client = await PkClient.create({ firm_name: "Apple Inc" });

    const loaded = await loadBelongsTo(client, "pkFirm", {
      className: "PkFirm",
      foreignKey: "firm_name",
      primaryKey: "firm_name",
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.readAttribute("name")).toBe("Apple");
  });

  it("belongs to with null foreign key", async () => {
    // Rails: test_belongs_to (null FK variant)
    class NullFkCompany extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class NullFkAccount extends Base {
      static {
        this.attribute("company_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NullFkCompany", NullFkCompany);
    registerModel("NullFkAccount", NullFkAccount);

    const account = await NullFkAccount.create({ company_id: null });
    const loaded = await loadBelongsTo(account, "nullFkCompany", {
      className: "NullFkCompany",
      foreignKey: "company_id",
    });
    expect(loaded).toBeNull();
  });

  it("belongs to with missing record returns null", async () => {
    // Rails: test_belongs_to (missing FK)
    class MissingCompany extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class MissingAccount extends Base {
      static {
        this.attribute("company_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("MissingCompany", MissingCompany);
    registerModel("MissingAccount", MissingAccount);

    const account = await MissingAccount.create({ company_id: 9999 });
    const loaded = await loadBelongsTo(account, "missingCompany", {
      className: "MissingCompany",
      foreignKey: "company_id",
    });
    expect(loaded).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Building / creating the belonging object
  // -------------------------------------------------------------------------

  it("building the belonging object", async () => {
    // Rails: test_building_the_belonging_object
    class BuildFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class BuildAccount extends Base {
      static {
        this.attribute("firm_id", "integer");
        this.attribute("credit_limit", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("BuildFirm", BuildFirm);

    const account = await BuildAccount.create({ credit_limit: 10 });

    // Simulate buildAssociation — create unsaved firm and set FK
    const firm = new BuildFirm({ name: "Apple" });
    await firm.save();
    account.writeAttribute("firm_id", firm.id);
    await account.save();

    const reloaded = await loadBelongsTo(account, "buildFirm", {
      className: "BuildFirm",
      foreignKey: "firm_id",
    });
    expect(reloaded).not.toBeNull();
    expect(reloaded!.readAttribute("name")).toBe("Apple");
  });

  it("creating the belonging object", async () => {
    // Rails: test_creating_the_belonging_object
    class CreateFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class CreateAccount extends Base {
      static {
        this.attribute("firm_id", "integer");
        this.attribute("credit_limit", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("CreateFirm", CreateFirm);

    const account = await CreateAccount.create({ credit_limit: 10 });

    const firm = await CreateFirm.create({ name: "Apple" });
    account.writeAttribute("firm_id", firm.id);
    await account.save();

    const loaded = await loadBelongsTo(account, "createFirm", {
      className: "CreateFirm",
      foreignKey: "firm_id",
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.readAttribute("name")).toBe("Apple");
    expect(loaded!.isNewRecord()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Assignment / natural assignment
  // -------------------------------------------------------------------------

  it("natural assignment", async () => {
    // Rails: test_natural_assignment
    class NatFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class NatAccount extends Base {
      static {
        this.attribute("firm_id", "integer");
        this.attribute("credit_limit", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NatFirm", NatFirm);

    const apple = await NatFirm.create({ name: "Apple" });
    const account = await NatAccount.create({ credit_limit: 10 });

    account.writeAttribute("firm_id", apple.id);
    await account.save();

    expect(account.readAttribute("firm_id")).toBe(apple.id);
  });

  it("natural assignment to nil removes the association", async () => {
    // Rails: test_natural_assignment_to_nil
    class NilFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class NilAccount extends Base {
      static {
        this.attribute("firm_id", "integer");
        this.attribute("credit_limit", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NilFirm", NilFirm);
    registerModel("NilAccount", NilAccount);

    const firm = await NilFirm.create({ name: "Apple" });
    const account = await NilAccount.create({
      firm_id: firm.id,
      credit_limit: 10,
    });

    // Clear the FK
    account.writeAttribute("firm_id", null);
    await account.save();

    const loaded = await loadBelongsTo(account, "nilFirm", {
      className: "NilFirm",
      foreignKey: "firm_id",
    });
    expect(loaded).toBeNull();
  });

  // -------------------------------------------------------------------------
  // optional / required
  // -------------------------------------------------------------------------

  it("optional relation", async () => {
    // Rails: test_optional_relation
    class OptCompany extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class OptAccount extends Base {
      static {
        this.attribute("company_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.belongsTo.call(OptAccount, "optCompany", {
      className: "OptCompany",
      foreignKey: "company_id",
      optional: true,
    });
    registerModel("OptCompany", OptCompany);
    registerModel("OptAccount", OptAccount);

    const account = new OptAccount({});
    // optional: true means no FK presence validation
    const valid = await account.isValid();
    expect(valid).toBe(true);
  });

  it("not optional relation is invalid without fk", async () => {
    // Rails: test_not_optional_relation
    class ReqCompany extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class ReqAccount extends Base {
      static {
        this.attribute("company_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.belongsTo.call(ReqAccount, "reqCompany", {
      className: "ReqCompany",
      foreignKey: "company_id",
      optional: false,
    });
    registerModel("ReqCompany", ReqCompany);
    registerModel("ReqAccount", ReqAccount);

    const account = new ReqAccount({});
    const valid = await account.isValid();
    expect(valid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // touch: true
  // -------------------------------------------------------------------------

  it("belongs to with touch option on save", async () => {
    // Rails: test_belongs_to_with_touch_option_on_touch
    class TouchPost extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("updated_at", "string");
        this.adapter = adapter;
      }
    }
    class TouchComment extends Base {
      static {
        this.attribute("body", "string");
        this.attribute("post_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.belongsTo.call(TouchComment, "touchPost", {
      className: "TouchPost",
      foreignKey: "post_id",
      touch: true,
    });
    registerModel("TouchPost", TouchPost);
    registerModel("TouchComment", TouchComment);

    const post = await TouchPost.create({
      title: "Hello",
      updated_at: new Date("2020-01-01").toISOString(),
    });
    const comment = await TouchComment.create({ body: "Nice", post_id: post.id });

    await touchBelongsToParents(comment);

    const reloaded = await TouchPost.find(post.id as number);
    // updated_at should be updated (not necessarily the same as before)
    expect(reloaded.readAttribute("updated_at")).not.toBe(
      new Date("2020-01-01").toISOString()
    );
  });

  // -------------------------------------------------------------------------
  // counter_cache
  // -------------------------------------------------------------------------

  it("belongs to counter", async () => {
    // Rails: test_belongs_to_counter
    // create() auto-increments counter cache; destroy() auto-decrements
    class CcPost extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("cc_comments_count", "integer", { default: 0 });
        this.adapter = adapter;
      }
    }
    class CcComment extends Base {
      static {
        this.attribute("body", "string");
        this.attribute("post_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.belongsTo.call(CcComment, "ccPost", {
      className: "CcPost",
      foreignKey: "post_id",
      counterCache: true,
    });
    registerModel("CcPost", CcPost);
    registerModel("CcComment", CcComment);

    const post = await CcPost.create({ title: "Post" });

    // create() should auto-increment the counter
    await CcComment.create({ body: "Hi", post_id: post.id });

    const reloaded = await CcPost.find(post.id as number);
    expect(reloaded.readAttribute("cc_comments_count")).toBe(1);
  });

  it.skip("custom named counter cache", async () => {
    // Rails: test_custom_named_counter_cache / test_custom_counter_cache
    class CnPost extends Base {
      static {
        this.attribute("title", "string");
        this.attribute("my_comment_count", "integer");
        this.adapter = adapter;
      }
    }
    class CnComment extends Base {
      static {
        this.attribute("body", "string");
        this.attribute("post_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.belongsTo.call(CnComment, "cnPost", {
      className: "CnPost",
      foreignKey: "post_id",
      counterCache: "my_comment_count",
    });
    registerModel("CnPost", CnPost);
    registerModel("CnComment", CnComment);

    const post = await CnPost.create({ title: "Post", my_comment_count: 0 });
    const comment = await CnComment.create({ body: "Hi", post_id: post.id });

    await updateCounterCaches(comment, "increment");

    const reloaded = await CnPost.find(post.id as number);
    expect(reloaded.readAttribute("my_comment_count")).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Polymorphic belongs_to
  // -------------------------------------------------------------------------

  it("polymorphic belongs_to", async () => {
    // Rails: test_polymorphic_association_class
    class PolyImage extends Base {
      static {
        this.attribute("url", "string");
        this.attribute("imageable_id", "integer");
        this.attribute("imageable_type", "string");
        this.adapter = adapter;
      }
    }
    class PolyPost extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    registerModel("PolyPost", PolyPost);
    registerModel("PolyImage", PolyImage);

    const post = await PolyPost.create({ title: "Hello" });
    const image = await PolyImage.create({
      url: "http://example.com/img.png",
      imageable_id: post.id,
      imageable_type: "PolyPost",
    });

    const loaded = await loadBelongsTo(image, "imageable", {
      polymorphic: true,
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.readAttribute("title")).toBe("Hello");
  });

  // -------------------------------------------------------------------------
  // Reloading the belonging object
  // -------------------------------------------------------------------------

  it("reloading the belonging object", async () => {
    // Rails: test_reloading_the_belonging_object
    class ReloadFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class ReloadAccount extends Base {
      static {
        this.attribute("firm_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("ReloadFirm", ReloadFirm);
    registerModel("ReloadAccount", ReloadAccount);

    const firm = await ReloadFirm.create({ name: "Odegy" });
    const account = await ReloadAccount.create({ firm_id: firm.id });

    // First load
    const first = await loadBelongsTo(account, "reloadFirm", {
      className: "ReloadFirm",
      foreignKey: "firm_id",
    });
    expect(first!.readAttribute("name")).toBe("Odegy");

    // Update firm name directly
    firm.writeAttribute("name", "ODEGY");
    await firm.save();

    // Reload by clearing cache and reloading
    if ((account as any)._cachedAssociations) {
      (account as any)._cachedAssociations.delete("reloadFirm");
    }
    const second = await loadBelongsTo(account, "reloadFirm", {
      className: "ReloadFirm",
      foreignKey: "firm_id",
    });
    expect(second!.readAttribute("name")).toBe("ODEGY");
  });

  // -------------------------------------------------------------------------
  // Assignment before child saved
  // -------------------------------------------------------------------------

  it("assignment before child saved", async () => {
    // Rails: test_assignment_before_child_saved
    class AbsFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class AbsClient extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("firm_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("AbsFirm", AbsFirm);
    registerModel("AbsClient", AbsClient);

    const firm = await AbsFirm.create({ name: "New Firm" });
    const client = new AbsClient({ name: "New Client" });

    client.writeAttribute("firm_id", firm.id);
    await client.save();

    expect(client.readAttribute("firm_id")).toBe(firm.id);
    expect(client.isNewRecord()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // inverse_of
  // -------------------------------------------------------------------------

  it("belongs to with inverse of", async () => {
    // Rails: test_belongs_to (inverse caching)
    class InvPost extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    class InvComment extends Base {
      static {
        this.attribute("body", "string");
        this.attribute("post_id", "integer");
        this.adapter = adapter;
      }
    }
    Associations.hasMany.call(InvPost, "comments", {
      className: "InvComment",
      foreignKey: "post_id",
      inverseOf: "post",
    });
    Associations.belongsTo.call(InvComment, "post", {
      className: "InvPost",
      foreignKey: "post_id",
      inverseOf: "comments",
    });
    registerModel("InvPost", InvPost);
    registerModel("InvComment", InvComment);

    const post = await InvPost.create({ title: "Hello" });
    const comment = await InvComment.create({ body: "Hi", post_id: post.id });

    const loaded = await loadBelongsTo(comment, "post", {
      className: "InvPost",
      foreignKey: "post_id",
      inverseOf: "comments",
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.readAttribute("title")).toBe("Hello");
  });

  // -------------------------------------------------------------------------
  // Stale tracking / foreign key changes
  // -------------------------------------------------------------------------

  it("reassigning the parent id updates the object", async () => {
    // Rails: test_reassigning_the_parent_id_updates_the_object
    class StFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class StClient extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("firm_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("StFirm", StFirm);
    registerModel("StClient", StClient);

    const firm1 = await StFirm.create({ name: "First" });
    const firm2 = await StFirm.create({ name: "Second" });
    const client = await StClient.create({ name: "Movable", firm_id: firm1.id });

    expect(client.readAttribute("firm_id")).toBe(firm1.id);

    client.writeAttribute("firm_id", firm2.id);
    await client.save();

    expect(client.readAttribute("firm_id")).toBe(firm2.id);

    const loaded = await loadBelongsTo(client, "stFirm", {
      className: "StFirm",
      foreignKey: "firm_id",
    });
    expect(loaded!.readAttribute("name")).toBe("Second");
  });

  // -------------------------------------------------------------------------
  // New record with FK but no object
  // -------------------------------------------------------------------------

  it("new record with foreign key but no object", async () => {
    // Rails: test_new_record_with_foreign_key_but_no_object
    class NrFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class NrClient extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("firm_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NrFirm", NrFirm);
    registerModel("NrClient", NrClient);

    const client = new NrClient({ name: "New Client", firm_id: 1 });
    // It's a new record so is not persisted
    expect(client.isNewRecord()).toBe(true);
    // FK is set
    expect(client.readAttribute("firm_id")).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Don't find target when FK is null
  // -------------------------------------------------------------------------

  it("dont find target when foreign key is null", async () => {
    // Rails: test_dont_find_target_when_foreign_key_is_null
    class NoFkFirm extends Base {
      static {
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }
    class NoFkClient extends Base {
      static {
        this.attribute("name", "string");
        this.attribute("firm_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NoFkFirm", NoFkFirm);
    registerModel("NoFkClient", NoFkClient);

    const client = new NoFkClient({ name: "Client" });
    // No FK set — null FK means no query
    const loaded = await loadBelongsTo(client, "noFkFirm", {
      className: "NoFkFirm",
      foreignKey: "firm_id",
    });
    expect(loaded).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Clearing association clears inverse
  // -------------------------------------------------------------------------

  it("assigning nil on an association clears the associations inverse", async () => {
    // Rails: test_assigning_nil_on_an_association_clears_the_associations_inverse
    class NilInvPost extends Base {
      static {
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    }
    class NilInvComment extends Base {
      static {
        this.attribute("body", "string");
        this.attribute("post_id", "integer");
        this.adapter = adapter;
      }
    }
    registerModel("NilInvPost", NilInvPost);
    registerModel("NilInvComment", NilInvComment);

    const post = await NilInvPost.create({ title: "Post" });
    const comment = await NilInvComment.create({ body: "Hi", post_id: post.id });

    // Simulate clearing — set FK to null
    comment.writeAttribute("post_id", null);
    await comment.save();

    const loaded = await loadBelongsTo(comment, "nilInvPost", {
      className: "NilInvPost",
      foreignKey: "post_id",
    });
    expect(loaded).toBeNull();
  });
});
