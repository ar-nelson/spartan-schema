export type Source =
  | SourceScalar
  | SourceObject
  | SourceArray
  | SourceDictionary
  | SourceOneOf
  | 'any'
  | string;
export interface SourceObject {
  readonly [key: string]: Source;
}
export interface SourceArray extends ReadonlyArray<Source> {
  readonly [0]: Source;
}
export interface SourceDictionary extends ReadonlyArray<Source> {
  readonly [0]: 'dictionary';
  readonly [1]: Source;
}
export type SourceScalar =
  | SourceEnum
  | 'string'
  | 'integer'
  | 'float'
  | 'binary'
  | 'date'
  | 'boolean'
  | 'null'
  | null;
export interface SourceOneOf extends ReadonlyArray<Source> {
  readonly [0]: 'oneof';
}
export interface SourceEnum
  extends ReadonlyArray<string | number | boolean | null> {
  readonly [0]: 'enum';
}
