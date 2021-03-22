import assert from 'assert';
import flatMap from 'lodash.flatmap';
import fromPairs from 'lodash.frompairs';
import isPlainObject from 'lodash.isplainobject';
import partition from 'lodash.partition';
import {
  AmbiguousPathError,
  RecursionError,
  SchemaCompileError,
} from './errors';
import { Path, PathArray } from './path';
import { Source } from './source';

function isObject(x: unknown): x is object {
  return isPlainObject(x);
}

export interface TypeMismatch {
  type: Schema<unknown>;
  value: unknown;
  path: PathArray;
}

export interface ValidateOptions {
  path?: PathArray;
  allowExtraFields?: boolean;
}

export interface RestrictOptions {
  fillEmpty?: boolean;
  fillZero?: boolean;
  coerce?: boolean;
}

export abstract class Schema<T> {
  abstract validate(value: unknown, options?: ValidateOptions): TypeMismatch[];
  abstract restrict(value: unknown, options?: RestrictOptions): T | undefined;
  abstract zeroValue(): T;
  abstract toSource(): Source;
  abstract child(index: string | number): Schema<unknown> | undefined;
  abstract isRecursive(): boolean;
  abstract hasFixedShape(): boolean;

  atPath(path: Path): Schema<unknown> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let s: Schema<unknown> | undefined = this;
    const pathSoFar: (string | number)[] = [];
    try {
      for (const i of path) {
        if (!s) {
          break;
        }
        pathSoFar.push(i);
        s = s.child(i);
      }
      return s;
    } catch (e) {
      if (e instanceof AmbiguousPathError) {
        throw new AmbiguousPathError(pathSoFar);
      }
      throw e;
    }
  }

  isScalar(): this is ScalarType<T> {
    return false;
  }
  isArray(): this is ArrayType<unknown> {
    return false;
  }
  isObject(): this is ObjectType | DictionaryType<unknown> {
    return false;
  }
}

export abstract class ScalarType<T> extends Schema<T> {
  child(): undefined {
    return undefined;
  }

  atPath(): undefined {
    return undefined;
  }

  isScalar(): this is ScalarType<T> {
    return true;
  }

  isRecursive(): boolean {
    return false;
  }

  hasFixedShape(): boolean {
    return true;
  }
}

export class StringType extends ScalarType<string> {
  static readonly self = new StringType();
  private constructor() {
    super();
  }

  toSource(): 'string' {
    return 'string';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return typeof value === 'string' ? [] : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (options.coerce) {
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        return `${value}`;
      }
      if (value instanceof Uint8Array) {
        return Buffer.from(value).toString('base64');
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): string {
    return '';
  }
}

export class FloatType extends ScalarType<number> {
  static readonly self = new FloatType();
  private constructor() {
    super();
  }

  toSource(): 'float' {
    return 'float';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return typeof value === 'number' ? [] : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): number | undefined {
    if (typeof value === 'number') {
      return value;
    }
    if (options.coerce) {
      if (typeof value === 'string') {
        return +value;
      } else if (value === true) {
        return 1;
      } else if (value === false || value == null) {
        return 0;
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): number {
    return 0;
  }
}

export class IntegerType extends ScalarType<number> {
  static readonly self = new IntegerType();
  private constructor() {
    super();
  }

  toSource(): 'integer' {
    return 'integer';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return typeof value === 'number' && value === Math.floor(value)
      ? []
      : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): number | undefined {
    if (typeof value === 'number' && value === Math.floor(value)) {
      return value;
    }
    if (options.coerce) {
      if (typeof value === 'number') {
        return Math.round(value);
      } else if (typeof value === 'string') {
        const parsed = parseInt(value);
        if (!isNaN(parsed)) {
          return parsed;
        }
      } else if (value === true) {
        return 1;
      } else if (value === false || value == null) {
        return 0;
      } else if (value instanceof Date) {
        return value.getTime();
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): number {
    return 0;
  }
}

export class BinaryType extends ScalarType<Uint8Array> {
  static readonly self = new BinaryType();
  private constructor() {
    super();
  }

  toSource(): 'binary' {
    return 'binary';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return value instanceof Uint8Array ? [] : [{ type: this, value, path }];
  }

  restrict(
    value: unknown,
    options: RestrictOptions = {}
  ): Uint8Array | undefined {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (options.coerce && typeof value === 'string') {
      try {
        return Buffer.from(value, 'base64');
      } catch (e) {
        // do nothing
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): Uint8Array {
    return new Uint8Array();
  }
}

export class DateType extends ScalarType<Date> {
  static readonly self = new DateType();
  private constructor() {
    super();
  }

  toSource(): 'date' {
    return 'date';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return value instanceof Date ? [] : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): Date | undefined {
    if (value instanceof Date) {
      return value;
    }
    if (
      options.coerce &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      try {
        return new Date(value);
      } catch (e) {
        // do nothing
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): Date {
    return new Date(0);
  }
}

export class BooleanType extends ScalarType<boolean> {
  static readonly self = new BooleanType();
  private constructor() {
    super();
  }

  toSource(): 'boolean' {
    return 'boolean';
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return typeof value === 'boolean' ? [] : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    } else if (options.coerce) {
      return !!value;
    } else if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): boolean {
    return false;
  }
}

export class NullType extends ScalarType<null> {
  static readonly self = new NullType();
  private constructor() {
    super();
  }

  toSource(): null {
    return null;
  }

  readonly source = null;
  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return value === null ? [] : [{ type: this, value, path }];
  }

  restrict(value: unknown, options: RestrictOptions = {}): null | undefined {
    if (value === null || (options.coerce && !value) || options.fillZero) {
      return null;
    }
    return undefined;
  }

  zeroValue(): null {
    return null;
  }
}

export class OneOfType<T> extends Schema<T> {
  constructor(public readonly subtypes: readonly Schema<T>[]) {
    super();
  }

  toSource(): Source {
    return ['oneof', ...this.subtypes.map((s) => s.toSource())];
  }

  validate(value: unknown, options: ValidateOptions = {}): TypeMismatch[] {
    return this.subtypes.some((s) => !s.validate(value, options).length)
      ? []
      : [{ type: this, value, path: options.path ?? [] }];
  }

  child(path: string | number): undefined {
    if (this.hasFixedShape()) {
      return undefined;
    }
    throw new AmbiguousPathError([path]);
  }

  isRecursive(): boolean {
    return this.subtypes.some((t) => t.isRecursive());
  }

  hasFixedShape(): boolean {
    return this.subtypes.every((t) => t.isScalar() && t.hasFixedShape());
  }

  restrict(value: unknown, options: RestrictOptions = {}): T | undefined {
    for (const t of this.subtypes) {
      const restricted = t.restrict(value, {});
      if (restricted !== undefined) {
        return restricted;
      }
    }
    if (options.coerce) {
      for (const t of this.subtypes) {
        const coerced = t.restrict(value, { coerce: true });
        if (coerced !== undefined) {
          return coerced;
        }
      }
    }
    if (options.fillZero) {
      return this.zeroValue();
    }
    if (options.fillEmpty && !this.hasFixedShape()) {
      return this.subtypes
        .map((t) => t.restrict(value, options))
        .find((r) => Array.isArray(r) || isObject(r));
    }
    return undefined;
  }

  zeroValue(): T {
    return this.subtypes[0].zeroValue();
  }
}

export class EnumType extends ScalarType<string | number | boolean | null> {
  constructor(
    public readonly members: readonly (string | number | boolean | null)[]
  ) {
    super();
  }

  toSource(): Source {
    return ['enum', ...this.members];
  }

  validate(
    value: unknown,
    { path = [] }: ValidateOptions = {}
  ): TypeMismatch[] {
    return this.members.indexOf(value as any) >= 0
      ? []
      : [{ type: this, value, path }];
  }

  restrict(
    value: unknown,
    options: RestrictOptions = {}
  ): string | number | boolean | null | undefined {
    if (this.members.includes(value as any)) {
      return value as any;
    } else if (options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): string | number | boolean | null {
    return this.members[0];
  }
}

export class ArrayType<T> extends Schema<T[]> {
  constructor(public readonly elementType: Schema<T>) {
    super();
  }

  toSource(): Source {
    return [this.elementType.toSource()];
  }

  validate(value: unknown, options: ValidateOptions = {}): TypeMismatch[] {
    const path = options.path ?? [];
    if (!Array.isArray(value)) {
      return [{ type: this, value, path }];
    }
    return flatMap(value, (v, i) =>
      this.elementType.validate(v, { ...options, path: [...path, i] })
    );
  }

  child(path: string | number): Schema<T> | undefined {
    return typeof path === 'number' ? this.elementType : undefined;
  }

  isArray(): this is ArrayType<T> {
    return true;
  }

  isRecursive(): boolean {
    return this.elementType.isRecursive();
  }

  hasFixedShape(): boolean {
    return this.elementType.hasFixedShape();
  }

  restrict(value: unknown, options: RestrictOptions = {}): T[] | undefined {
    if (Array.isArray(value)) {
      return value
        .map((e) => this.elementType.restrict(e, options))
        .filter((e) => e !== undefined) as T[];
    } else if (options.fillEmpty || options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): T[] {
    return [];
  }
}

export class DictionaryType<T> extends Schema<{ [key: string]: T }> {
  constructor(public readonly valueType: Schema<T>) {
    super();
  }

  toSource(): Source {
    return ['dictionary', this.valueType.toSource()];
  }

  validate(value: unknown, options: ValidateOptions = {}): TypeMismatch[] {
    const path = options.path ?? [];
    if (!isObject(value)) {
      return [{ type: this, value, path }];
    }
    return flatMap(Object.entries(value), ([k, v]) =>
      this.valueType.validate(v, { ...options, path: [...path, k] })
    );
  }

  child(path: string | number): Schema<T> | undefined {
    return typeof path === 'string' ? this.valueType : undefined;
  }

  isObject(): this is DictionaryType<T> {
    return true;
  }

  isRecursive(): boolean {
    return this.valueType.isRecursive();
  }

  hasFixedShape(): boolean {
    return this.valueType.hasFixedShape();
  }

  restrict(
    value: unknown,
    options: RestrictOptions = {}
  ): { [key: string]: T } | undefined {
    if (isObject(value)) {
      return fromPairs(
        Object.entries(value)
          .map(([k, v]) => [k, this.valueType.restrict(v, options)])
          .filter(([, v]) => v !== undefined)
      );
    } else if (options.fillEmpty || options.fillZero) {
      return this.zeroValue();
    }
    return undefined;
  }

  zeroValue(): { [key: string]: T } {
    return {};
  }
}

export class ObjectType extends Schema<object> {
  constructor(
    public readonly entries: { readonly [key: string]: Schema<unknown> }
  ) {
    super();
  }

  toSource(): Source {
    return fromPairs(
      Object.entries(this.entries).map(([k, v]) => [k, v.toSource()])
    );
  }

  validate(value: unknown, options: ValidateOptions = {}): TypeMismatch[] {
    const path = options.path ?? [];
    if (!isObject(value)) {
      return [{ type: this, value, path }];
    }
    const failures = flatMap(Object.entries(this.entries), ([k, v]) =>
      k in value ? v.validate(value[k], { ...options, path: [...path, k] }) : []
    );
    if (
      !options.allowExtraFields &&
      !Object.keys(value).every((k) => k in this.entries)
    ) {
      failures.push({ type: this, value, path });
    }
    return failures;
  }

  child(path: string | number): Schema<unknown> | undefined {
    return this.entries[path];
  }

  isObject(): this is ObjectType {
    return true;
  }

  isRecursive(): boolean {
    return Object.values(this.entries).some((e) => e.isRecursive());
  }

  hasFixedShape(): boolean {
    return Object.values(this.entries).every((e) => e.hasFixedShape());
  }

  restrict(value: unknown, options: RestrictOptions = {}): object | undefined {
    if (!isObject(value) && !options.fillZero && !options.fillEmpty) {
      return undefined;
    }
    const base = isObject(value) ? value : {};
    return fromPairs(
      Object.entries(this.entries)
        .map(([k, v]) => [k, v.restrict(base[k], options)])
        .filter(([, v]) => v !== undefined)
    );
  }

  zeroValue(): object {
    return fromPairs(
      Object.entries(this.entries).map(([k, v]) => [k, v.zeroValue()])
    );
  }
}

export class AnyType extends Schema<any> {
  static readonly self = new AnyType();
  private constructor() {
    super();
  }

  toSource(): 'any' {
    return 'any';
  }

  validate(): never[] {
    return [];
  }

  child(path: string | number): undefined {
    throw new AmbiguousPathError([path]);
  }

  isRecursive(): boolean {
    return false;
  }

  hasFixedShape(): boolean {
    return false;
  }

  restrict(value: unknown): unknown {
    return value;
  }

  zeroValue(): null {
    return null;
  }
}

class FixpointType extends Schema<unknown> {
  public schema?: Schema<unknown>;

  constructor(public readonly label: string) {
    super();
  }

  toSource() {
    if (this.schema) {
      return this.schema.toSource();
    } else {
      return this.label;
    }
  }

  validate(value: unknown, options?: ValidateOptions): TypeMismatch[] {
    assert(this.schema);
    return this.schema.validate(value, options);
  }

  child(path: string | number): Schema<unknown> | undefined {
    assert(this.schema);
    return this.schema.child(path);
  }

  isArray(): this is ArrayType<unknown> {
    assert(this.schema);
    return this.schema.isArray();
  }

  isObject(): this is ObjectType | DictionaryType<unknown> {
    assert(this.schema);
    return this.schema.isObject();
  }

  isRecursive(): boolean {
    return true;
  }

  hasFixedShape(): boolean {
    assert(this.schema);
    return this.schema.hasFixedShape();
  }

  restrict(value: unknown, options: RestrictOptions = {}): unknown {
    if (options.fillEmpty || options.fillZero) {
      throw new RecursionError(
        'cannot fillEmpty or fillZero on a recursive schema',
        this.label
      );
    }
    assert(this.schema);
    return this.schema.restrict(value, options);
  }

  zeroValue(): unknown {
    throw new RecursionError(
      'cannot compute zeroValue of a recursive schema',
      this.label
    );
  }
}

export function compileSchema(
  source: Source,
  path: PathArray = [],
  scope: { readonly [label: string]: Schema<unknown> } = {}
): Schema<unknown> {
  if (isObject(source)) {
    const [bindings, entries] = partition(
      Object.entries(source),
      ([k]) => k.startsWith('$') && !k.startsWith('$$')
    );
    if (bindings.length) {
      if (
        typeof source['$schema'] === 'string' &&
        source['$schema'].startsWith('http')
      ) {
        throw new SchemaCompileError(
          'this is a JSON Schema, not a Spartan Schema.',
          path
        );
      }
      // FIXME: Fixpoints pointing to scalars will break "oneof"
      const fixpoints: [string, FixpointType][] = bindings.map(([k]) => [
        k,
        new FixpointType(k),
      ]);
      const scopeWithFixpoints = { ...scope, ...fromPairs(fixpoints) };
      const compiledBindings = bindings.map(([k, v], i) => {
        const result = compileSchema(v, [...path, k], scopeWithFixpoints);
        fixpoints[i][1].schema = result;
        return [k, result];
      });
      scope = { ...scope, ...fromPairs(compiledBindings) };
    }
    return new ObjectType(
      fromPairs(
        entries.map(([k, v]) => [
          k.startsWith('$$') ? k.slice(1) : k,
          compileSchema(v, [...path, k], scope),
        ])
      )
    );
  } else if (Array.isArray(source)) {
    if (source.length === 1) {
      return new ArrayType(compileSchema(source[0], [...path, 0], scope));
    } else if (source.length > 1) {
      switch (source[0]) {
        case 'oneof':
          return new OneOfType(
            (source as Source[])
              .slice(1)
              .map((s, i) => compileSchema(s, [...path, i + 1], scope))
          );
        case 'enum':
          return new EnumType(
            (source as unknown[]).slice(1).map((s, i) => {
              switch (typeof s) {
                case 'string':
                case 'number':
                case 'boolean':
                  return s;
                default:
                  if (s === null) {
                    return s;
                  }
                  throw new SchemaCompileError(
                    'enum entries must be scalar values',
                    [...path, i + 1]
                  );
              }
            })
          );
        case 'dictionary':
          if (source.length !== 2) {
            throw new SchemaCompileError(
              'dictionary must be a 2-element array',
              path
            );
          }
          return new DictionaryType(
            compileSchema(source[1], [...path, 1], scope)
          );
        default:
          throw new SchemaCompileError(
            `not a Spartan Schema type tag: ${JSON.stringify(
              source[0]
            )} (expected "oneof", "enum", or "dictionary")`,
            path
          );
      }
    }
  }
  switch (source) {
    case 'string':
      return StringType.self;
    case 'integer':
      return IntegerType.self;
    case 'float':
      return FloatType.self;
    case 'binary':
      return BinaryType.self;
    case 'date':
      return DateType.self;
    case 'boolean':
      return BooleanType.self;
    case 'null':
      return NullType.self;
    case 'any':
      return AnyType.self;
  }
  if (typeof source === 'string') {
    if (source.startsWith('$') && !source.startsWith('$$')) {
      const ref = scope[source];
      if (ref) {
        return ref;
      }
      throw new SchemaCompileError(
        `label not in scope: ${JSON.stringify(source)}`,
        path
      );
    }
    throw new SchemaCompileError(
      `not a Spartan Schema type: ${JSON.stringify(source)}`,
      path
    );
  }
  if (source === null) {
    return NullType.self;
  }
  throw new SchemaCompileError(
    `unexpected JSON value: ${JSON.stringify(source)}`,
    path
  );
}
