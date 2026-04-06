/**
 * Encryption contexts — context stack for encryption settings.
 *
 * Mirrors: ActiveRecord::Encryption::Contexts
 */

export interface EncryptionContext {
  encryptionDisabled?: boolean;
  protectedMode?: boolean;
  keyProvider?: unknown;
  [key: string]: unknown;
}

const contextStack: EncryptionContext[] = [];

function currentContext(): EncryptionContext {
  return contextStack.length > 0 ? contextStack[contextStack.length - 1] : {};
}

export function withEncryptionContext<T>(overrides: EncryptionContext, fn: () => T): T {
  const previous = currentContext();
  contextStack.push({ ...previous, ...overrides });
  try {
    return fn();
  } finally {
    contextStack.pop();
  }
}

export function withoutEncryption<T>(fn: () => T): T {
  return withEncryptionContext({ encryptionDisabled: true }, fn);
}

export function protectingEncryptedData<T>(fn: () => T): T {
  return withEncryptionContext({ protectedMode: true }, fn);
}

export function getEncryptionContext(): EncryptionContext {
  return currentContext();
}

export function isEncryptionDisabled(): boolean {
  return currentContext().encryptionDisabled === true;
}

export function isProtectedMode(): boolean {
  return currentContext().protectedMode === true;
}
