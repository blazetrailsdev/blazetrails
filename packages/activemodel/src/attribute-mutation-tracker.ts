export class AttributeMutationTracker {
  forcedChanges = new Set<string>();
  changedValues = new Map<string, unknown>();
}

export class ForcedMutationTracker extends AttributeMutationTracker {}

export class NullMutationTracker {
  forcedChanges = new Set<string>();
  changedValues = new Map<string, unknown>();
}
