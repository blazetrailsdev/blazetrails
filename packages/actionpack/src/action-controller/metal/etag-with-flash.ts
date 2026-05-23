/**
 * ActionController::EtagWithFlash
 *
 * When the flash is set, includes its contents in the ETag so that
 * flash-dependent views properly bust caches.
 * @see https://api.rubyonrails.org/classes/ActionController/EtagWithFlash.html
 */

// Rails: `etag { flash if request.respond_to?(:flash) && !flash.empty? }`
// The flash object is passed to the ETagger which calls `to_param`-style
// serialization. `toSessionValue` (the session-storable representation)
// matches what Rails serializes — not `toHash`, which excludes flash.now
// entries and would fail to bust caches on flash.now changes.
export function flashEtagger(request: {
  flash?: {
    empty?: boolean;
    toSessionValue?(): unknown;
  };
}): unknown | undefined {
  const flash = request.flash;
  if (!flash || flash.empty) return undefined;
  return flash.toSessionValue ? flash.toSessionValue() : flash;
}
