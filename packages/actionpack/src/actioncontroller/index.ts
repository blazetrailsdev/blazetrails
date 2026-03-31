export const VERSION = "8.0.2";

export {
  AbstractController,
  ActionNotFound,
  type ActionCallback,
  type AroundCallback,
  type CallbackOptions,
} from "./abstract-controller.js";

export { Metal, MiddlewareStack, Middleware } from "./metal.js";

export { Base, DoubleRenderError, type RenderOptions, type RescueHandler } from "./base.js";
export { API } from "./api.js";

export { TestCase, type RequestOptions } from "./test-case.js";
export { IntegrationTest, type IntegrationRequestOptions } from "./integration-test.js";
export {
  wrapParameters,
  applyParamsWrapper,
  deriveWrapperKey,
  type WrapParametersOptions,
  type ParamsWrapperConfig,
} from "./params-wrapper.js";

export {
  Parameters,
  ParameterMissing,
  ExpectedParameterMissing,
  UnpermittedParameters,
  UnfilteredParameters,
  InvalidParameterKey,
  type StrongParameters,
} from "./metal/strong-parameters.js";

export {
  ActionControllerError,
  BadRequest,
  RenderError,
  RoutingError,
  UrlGenerationError,
  MethodNotAllowed,
  NotImplemented,
  MissingFile,
  SessionOverflowError,
  UnknownHttpMethod,
  UnknownFormat,
  RespondToMismatchError,
  MissingExactTemplate,
} from "./metal/exceptions.js";

export { UnsafeRedirectError } from "./metal/redirecting.js";
export { MissingRenderer, Renderers } from "./metal/renderers.js";
export { Collector, VariantCollector } from "./metal/mime-responds.js";
export { BrowserBlocker } from "./metal/allow-browser.js";
export { Options as ParamsWrapperOptions } from "./metal/params-wrapper.js";
export {
  InvalidAuthenticityToken,
  InvalidCrossOriginRequest,
} from "./metal/request-forgery-protection.js";
export { SSE, ClientDisconnected } from "./metal/live.js";
export { Renderer } from "./renderer.js";
export { Deprecator, deprecator } from "./deprecator.js";
export { TestRequest, LiveTestResponse, TestSession } from "./test-case.js";
