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

  it("returns no rows when the composite-key tuple list is empty (owner has no through records)", async () => {
    const shop = await CkShop.create({ name: "Lonely" });
    // No orders for this shop → through-records pluck yields [] →
    // tuple-IN short-circuits to a never-true predicate.
    const reflection = (CkShop as any)._reflectOnAssociation("ckLineItemsThroughOrders");
    const items = await loadHasMany(shop, "ckLineItemsThroughOrders", reflection.options);
    expect(items).toEqual([]);
  });
});
