/**
 * Railtie — initialization hooks for ActiveRecord.
 *
 * Mirrors: ActiveRecord::Railtie < Rails::Railtie (railtie.rb)
 *
 * Extends the base Railtie from `@blazetrails/activesupport` and registers
 * itself in the global initialization pipeline.
 */
import { Railtie as BaseRailtie, registerRailtie } from "@blazetrails/activesupport";
import { deprecator } from "./deprecator.js";

export class Railtie extends BaseRailtie {
  constructor() {
    super();
  }

  static {
    registerRailtie(this);

    this.initializer("active_record.deprecator", () => {
      BaseRailtie.deprecators["activeRecord"] = deprecator();
    });

    this.initializer("active_record.initialize_timezone", () => {
      // time_zone_aware_attributes default wiring — applied when Base loads
    });

    this.initializer("active_record.logger", () => {
      // logger wired from Rails.logger on load
    });

    this.initializer("active_record.set_configs", () => {
      // configuration values forwarded to ActiveRecord module attributes
    });

    this.initializer("active_record.initialize_database", () => {
      // establish_connection called when active_record loads
    });
  }
}
