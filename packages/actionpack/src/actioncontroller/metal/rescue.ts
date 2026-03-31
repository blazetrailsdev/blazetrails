/**
 * ActionController::Rescue
 *
 * Provides rescue_from handler chain for controllers, wrapping actions
 * to handle configured errors.
 * @see https://api.rubyonrails.org/classes/ActionController/Rescue.html
 */

export type RescueHandler = (error: Error) => void | Promise<void>;

export class RescueRegistry {
  private _handlers: Array<{
    errorClass: new (...args: unknown[]) => Error;
    handler: RescueHandler;
  }> = [];

  rescueFrom(errorClass: new (...args: unknown[]) => Error, handler: RescueHandler): void {
    this._handlers.push({ errorClass, handler });
  }

  findHandler(error: Error): RescueHandler | null {
    for (const { errorClass, handler } of [...this._handlers].reverse()) {
      if (error instanceof errorClass) return handler;
    }
    return null;
  }

  async processWithRescue(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (error instanceof Error) {
        const handler = this.findHandler(error);
        if (handler) {
          await handler(error);
          return;
        }
      }
      throw error;
    }
  }
}

export function showDetailedExceptions(): boolean {
  return false;
}
