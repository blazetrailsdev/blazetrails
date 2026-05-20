// Rails source: railties/lib/rails/pwa_controller.rb
//
// Serves /service-worker.js and /manifest.webmanifest by rendering the
// app-provided `pwa/service-worker` and `pwa/manifest` templates.
//
// In Rails this extends `Rails::ApplicationController`. That class is
// deferred to PR 1.7 (InfoController), so PWAController extends
// ActionController.Base directly and applies `skipForgeryProtection`
// inline. Switch to ApplicationController once PR 1.7 lands.

import { ActionController } from "@blazetrails/actionpack";

export class PWAController extends ActionController.Base {
  serviceWorker(): void {
    (this.render as (o: Record<string, unknown>) => void)({
      template: "pwa/service-worker",
      layout: false,
    });
  }

  manifest(): void {
    (this.render as (o: Record<string, unknown>) => void)({
      template: "pwa/manifest",
      layout: false,
    });
  }
}

PWAController.skipBeforeAction("verifyAuthenticityToken");
