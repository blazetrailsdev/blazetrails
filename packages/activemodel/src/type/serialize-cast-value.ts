export interface SerializeCastValue {
  itselfIfSerializeCastValueCompatible(): unknown;
}

export interface SerializeCastValueClassMethods {
  isSerializeCastValueCompatible(): boolean;
}

export interface DefaultImplementation {
  serializeCastValue(value: unknown): unknown;
}
