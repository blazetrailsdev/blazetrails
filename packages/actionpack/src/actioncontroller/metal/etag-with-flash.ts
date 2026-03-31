/**
 * ActionController::EtagWithFlash
 *
 * When the flash is set, includes its contents in the ETag so that
 * flash-dependent views properly bust caches.
 * @see https://api.rubyonrails.org/classes/ActionController/EtagWithFlash.html
 */

export function flashEtagger(request: {
  flash?: { empty?: boolean; toJSON?(): unknown };
}): unknown | undefined {
  const flash = request.flash;
  if (flash && !flash.empty) {
    return flash.toJSON ? flash.toJSON() : flash;
  }
  return undefined;
}
