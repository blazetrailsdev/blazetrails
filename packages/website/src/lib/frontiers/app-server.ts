/**
 * Browser-side Rack app server.
 *
 * Runs ActionPack routing + controllers in the main thread.
 * Controllers render JSON/HTML/plain responses.
 *
 * This is the core dogfooding layer — BlazeTrails serving BlazeTrails.
 */

import type { Runtime } from "./runtime.js";
import type { RackEnv, RackResponse } from "@blazetrails/rack";
import { bodyFromString, bodyToString } from "@blazetrails/rack";
import { RouteSet, Request, Response, Parameters, ActionController } from "@blazetrails/actionpack";

export interface AppServer {
  call: (method: string, path: string, options?: RequestOptions) => Promise<AppResponse>;
  routes: RouteSet;
  registerController: (name: string, controllerClass: ControllerClass) => void;
  drawRoutes: (fn: (r: any) => void) => void;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: string;
  params?: Record<string, string>;
}

export interface AppResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

type ControllerClass = new () => InstanceType<typeof ActionController.Base>;

export function createAppServer(_runtime: Runtime): AppServer {
  const routeSet = new RouteSet();
  const controllers = new Map<string, ControllerClass>();

  routeSet.setDispatcher(async (controllerName, action, params, env): Promise<RackResponse> => {
    const Ctrl = controllers.get(controllerName);
    if (!Ctrl) {
      return [
        404,
        { "content-type": "text/plain" },
        bodyFromString(`Controller not found: ${controllerName}`),
      ];
    }

    const controller = new Ctrl();
    const request = new Request(env);

    (request as any).parameters = new Parameters({
      ...params,
      ...(request.params ?? {}),
    });

    const response = new Response();

    try {
      await controller.dispatch(action, request, response);

      const headers: Record<string, string> = {};
      if ((response as any)._headers) {
        Object.assign(headers, (response as any)._headers);
      }

      return [response.status, headers, bodyFromString(response.body ?? "")];
    } catch (e: any) {
      return [
        500,
        { "content-type": "text/plain" },
        bodyFromString(`Error in ${controllerName}#${action}: ${e.message}`),
      ];
    }
  });

  const server: AppServer = {
    routes: routeSet,

    async call(method, path, options = {}): Promise<AppResponse> {
      const env: RackEnv = {
        REQUEST_METHOD: method.toUpperCase(),
        PATH_INFO: path,
        QUERY_STRING: "",
        SERVER_NAME: "localhost",
        SERVER_PORT: "3000",
        "rack.url_scheme": "http",
        "rack.input": options.body ?? "",
      };

      const qIdx = path.indexOf("?");
      if (qIdx !== -1) {
        env.PATH_INFO = path.slice(0, qIdx);
        env.QUERY_STRING = path.slice(qIdx + 1);
      }

      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          env[`HTTP_${k.toUpperCase().replace(/-/g, "_")}`] = v;
        }
      }

      const [status, headers, body] = await routeSet.call(env);
      const bodyStr = await bodyToString(body);

      return { status, headers, body: bodyStr };
    },

    registerController(name: string, controllerClass: ControllerClass) {
      controllers.set(name, controllerClass);
    },

    drawRoutes(fn: (r: any) => void) {
      routeSet.draw(fn);
    },
  };

  return server;
}
