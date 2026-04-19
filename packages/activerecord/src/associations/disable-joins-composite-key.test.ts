/**
 * Composite-key support in DisableJoinsAssociationScope.
 *
 * Rails' disable_joins through associations work with composite
 * primary/foreign keys via tuple IN: `WHERE (c1, c2) IN ((v1a, v1b),
 * (v2a, v2b), ...)`. Same path our impl follows when keyColumns has
 * length > 1.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Base, registerModel } from "../index.js";
import { Associations, loadHasMany } from "../associations.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("DJAS — composite key support", () => {
  let adapter: DatabaseAdapter;

  // Shopify-style composite-PK shape: (shop_id, order_number). We
  // avoid `id` as the second PK column because Base.id is an accessor
  // that collides with raw column reads on test-adapter.
  class CkShop extends Base {
    static {
      this._tableName = "ck_shops";
      this.attribute("name", "string");
    }
  }
  class CkOrder extends Base {
    static {
      this._tableName = "ck_orders";
      this.primaryKey = ["shop_id", "order_number"];
      this.attribute("shop_id", "integer");
      this.attribute("order_number", "integer");
      this.attribute("name", "string");
    }
  }
  class CkLineItem extends Base {
    static {
      this._tableName = "ck_line_items";
      this.attribute("ck_order_shop_id", "integer");
      this.attribute("ck_order_number", "integer");
      this.attribute("sku", "string");
    }
  }

  beforeEach(() => {
    adapter = createTestAdapter();
    CkShop.adapter = adapter;
    CkOrder.adapter = adapter;
    CkLineItem.adapter = adapter;
    registerModel("CkShop", CkShop);
    registerModel("CkOrder", CkOrder);
    registerModel("CkLineItem", CkLineItem);
    (CkShop as any)._associations = [];
    (CkOrder as any)._associations = [];
    (CkLineItem as any)._associations = [];
    Associations.hasMany.call(CkShop, "ckOrders", {
      className: "CkOrder",
      foreignKey: "shop_id",
    });
    // Composite FK on line_items references CkOrder's composite PK.
    Associations.hasMany.call(CkOrder, "ckLineItems", {
      className: "CkLineItem",
      foreignKey: ["ck_order_shop_id", "ck_order_number"],
      primaryKey: ["shop_id", "order_number"],
    });
    Associations.hasMany.call(CkShop, "ckLineItemsThroughOrders", {
      className: "CkLineItem",
      through: "ckOrders",
      source: "ckLineItems",
      disableJoins: true,
    });
  });

  it("loads through a composite-PK chain via tuple-IN — no JOIN", async () => {
    const shop = await CkShop.create({ name: "S" });
    const order = (await CkOrder.create({
      shop_id: shop.id,
      order_number: 100,
      name: "O",
    })) as any;
    await CkLineItem.create({
      ck_order_shop_id: order.shop_id,
      ck_order_number: order.order_number,
      sku: "sku-1",
    });
    await CkLineItem.create({
      ck_order_shop_id: order.shop_id,
      ck_order_number: order.order_number,
      sku: "sku-2",
    });

    const reflection = (CkShop as any)._reflectOnAssociation("ckLineItemsThroughOrders");
    const items = await loadHasMany(shop, "ckLineItemsThroughOrders", reflection.options);
    expect(items.map((i: any) => i.sku).sort()).toEqual(["sku-1", "sku-2"]);
  });

  it("composite-key + ordered upstream: skips DJAR wrap (records load via tuple-IN, no in-list reorder)", async () => {
    // Document the trade-off: composite-key chains skip the loaded-
    // chain DJAR wrap because DJAR's per-key group-by would need
    // tuple grouping (out of scope for this PR). Records still load
    // correctly via the tuple-IN WHERE; they just aren't re-ordered
    // by through-table sequence. Future work could extend DJAR to
    // group by tuple keys.
    Associations.hasMany.call(CkShop, "ckOrdersOrdered", {
      className: "CkOrder",
      foreignKey: "shop_id",
      scope: (rel: any) => rel.order("name"),
    });
    Associations.hasMany.call(CkShop, "ckLineItemsOrdered", {
      className: "CkLineItem",
      through: "ckOrdersOrdered",
      source: "ckLineItems",
      disableJoins: true,
    });
    const shop = await CkShop.create({ name: "S" });
    const orderB = (await CkOrder.create({
      shop_id: shop.id,
      order_number: 200,
      name: "b",
    })) as any;
    const orderA = (await CkOrder.create({
      shop_id: shop.id,
      order_number: 100,
      name: "a",
    })) as any;
    await CkLineItem.create({
      ck_order_shop_id: orderB.shop_id,
      ck_order_number: orderB.order_number,
      sku: "from-b",
    });
    await CkLineItem.create({
      ck_order_shop_id: orderA.shop_id,
      ck_order_number: orderA.order_number,
      sku: "from-a",
    });

    const reflection = (CkShop as any)._reflectOnAssociation("ckLineItemsOrdered");
    const items = await loadHasMany(shop, "ckLineItemsOrdered", reflection.options);
    // Both records load. Order is DB-arbitrary (no reorder applied
    // for composite + ordered-upstream); just assert presence.
    expect(items.map((i: any) => i.sku).sort()).toEqual(["from-a", "from-b"]);
  });

  it("returns no rows when the composite-key tuple list is empty (owner has no through records)", async () => {
    const shop = await CkShop.create({ name: "Lonely" });
    // No orders for this shop → through-records pluck yields [] →
    // tuple-IN short-circuits to a never-true predicate.
    const reflection = (CkShop as any)._reflectOnAssociation("ckLineItemsThroughOrders");
    const items = await loadHasMany(shop, "ckLineItemsThroughOrders", reflection.options);
    expect(items).toEqual([]);
  });
});
