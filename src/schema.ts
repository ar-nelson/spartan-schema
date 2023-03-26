// Spartan Schema
// Copyright © 2021-2023 Adam Nelson <adam@nels.onl>
// Distributed under the Blue Oak Model License

import isPlainObject from './isPlainObject.ts';
import { PathArray, pathToString } from './path.ts';

/**
 * The type of valid Spartan Schemas.
 *
 * When writing schemas directly in Typescript code, you should not use this
 * type; instead, use `as const` and let Typescript infer the exact type of the
 * schema.
 */
export interface Schema {
  readonly spartan?: 1;
  readonly let?: { readonly [key: string]: SchemaType };
  readonly schema: SchemaType;
}

export type SchemaType =
  | null
  | 'null'
  | 'boolean'
  | 'integer'
  | 'float'
  | 'number'
  | 'string'
  | 'date'
  | 'binary'
  | readonly [
    'enum',
    string | number | boolean | null,
    ...(string | number | boolean | null)[],
  ]
  | readonly ['tuple', SchemaType, ...SchemaType[]]
  | readonly ['array', SchemaType, ...SchemaType[]]
  | readonly ['dictionary', SchemaType]
  | readonly ['oneof', SchemaType, ...SchemaType[]]
  | readonly ['ref', string]
  | { readonly [key: string]: SchemaType | readonly ['optional', SchemaType] };

export interface SchemaError {
  readonly message: string;
  readonly location: PathArray;
}

function isSchemaType(
  schema: unknown,
  refs: Record<string, unknown>,
  location: PathArray,
  errors?: SchemaError[],
): schema is SchemaType {
  if (schema === null) {
    return true;
  } else if (Array.isArray(schema)) {
    if (schema.length < 2) {
      errors &&
        errors.push({
          message: 'Array types must have at least 2 elements',
          location,
        });
      return false;
    }
    if (typeof schema[0] !== 'string') {
      errors &&
        errors.push({
          message: 'Array types must start with a string',
          location: [...location, 0],
        });
      return false;
    }
    switch (schema[0]) {
      case 'enum': {
        let result = true;
        for (let i = 1; i < schema.length; i++) {
          switch (typeof schema[i]) {
            case 'boolean':
            case 'number':
            case 'string':
              continue;
            default:
              if (schema[i] === null) {
                continue;
              }
              result = false;
              errors &&
                errors.push({
                  message: '"enum" type elements must be boolean, number, string, or null',
                  location: [...location, i],
                });
          }
        }
        return result;
      }
      case 'tuple':
      case 'array':
      case 'oneof': {
        let result = true;
        for (let i = 1; i < schema.length; i++) {
          if (!isSchemaType(schema[i], refs, [...location, i], errors)) {
            result = false;
            if (!errors) {
              break;
            }
          }
        }
        return result;
      }
      case 'dictionary':
        if (schema.length !== 2) {
          errors &&
            errors.push({
              message: '"dictionary" type must have exactly 2 elements',
              location,
            });
          return false;
        }
        return isSchemaType(schema[1], refs, [...location, 1], errors);
      case 'ref':
        if (schema.length !== 2) {
          errors &&
            errors.push({
              message: '"ref" type must have exactly 2 elements',
              location,
            });
          return false;
        }
        if (typeof schema[1] !== 'string') {
          errors &&
            errors.push({
              message: '"ref" type label must be a string',
              location: [...location, 1],
            });
          return false;
        }
        if (!(schema[1] in refs)) {
          errors &&
            errors.push({
              message: `"ref" type refers to nonexistent variable ${
                JSON.stringify(
                  schema[1],
                )
              }`,
              location: [...location, 1],
            });
          return false;
        }
        return true;
      case 'optional':
        errors &&
          errors.push({
            message: '"optional" type is only allowed as an object key',
            location,
          });
        return false;
      default:
        errors &&
          errors.push({
            message: `Unknown array type: ${JSON.stringify(schema[0])}`,
            location: [...location, 0],
          });
        return false;
    }
  } else if (isPlainObject(schema)) {
    let result = true;
    for (const [k, v] of Object.entries(schema)) {
      let s: SchemaType;
      if (Array.isArray(v) && v.length > 0 && v[0] === 'optional') {
        if (v.length !== 2) {
          result = false;
          if (errors) {
            errors &&
              errors.push({
                message: '"optional" type must have exactly 2 elements',
                location: [...location, k],
              });
            continue;
          } else {
            break;
          }
        }
        s = v[1];
      } else {
        s = v as SchemaType;
      }
      if (!isSchemaType(s, refs, [...location, k], errors)) {
        result = false;
        if (!errors) {
          break;
        }
      }
    }
    return result;
  } else if (typeof schema === 'string') {
    switch (schema) {
      case 'null':
      case 'boolean':
      case 'integer':
      case 'float':
      case 'number':
      case 'string':
      case 'date':
      case 'binary':
        return true;
      default:
        errors &&
          errors.push({
            message: `Unknown scalar type: ${JSON.stringify(schema)}`,
            location,
          });
        return false;
    }
  }
  errors &&
    errors.push({
      message: `Literal value outside "enum": ${JSON.stringify(schema)}`,
      location,
    });
  return false;
}

/**
 * A type predicate that checks whether `schema` is a valid Spartan Schema.
 *
 * `errors` is a mutable array of `{ message, location }` pairs; if it is
 * present and `isSchema` returns false, it will be populated with a list of
 * parsing errors.
 */
export function isSchema(
  schema: unknown,
  errors?: SchemaError[],
): schema is Schema {
  if (!isPlainObject(schema)) {
    errors &&
      errors.push({ message: 'Schema must be an object', location: [] });
    return false;
  }
  let result = true;
  if ('spartan' in schema) {
    if (schema['spartan'] !== 1) {
      if (errors) {
        errors &&
          errors.push({
            message: 'Schema property "spartan" must be 1, if present',
            location: ['spartan'],
          });
        result = false;
      } else {
        return false;
      }
    }
  }
  let refs: Record<string, unknown> = {};
  if ('let' in schema) {
    if (isPlainObject(schema['let'])) {
      refs = schema['let'];
      for (const [k, v] of Object.entries(refs)) {
        if (!isSchemaType(v, refs, ['let', k], errors)) {
          result = false;
          if (!errors) {
            return false;
          }
        }
      }
    } else if (errors) {
      errors &&
        errors.push({
          message: 'Schema property "let" must be an object, if present',
          location: ['let'],
        });
      result = false;
    } else {
      return false;
    }
  }
  if ('schema' in schema) {
    return isSchemaType(schema['schema'], refs, ['schema'], errors) && result;
  } else {
    errors &&
      errors.push({
        message: 'Schema must have a "schema" property',
        location: [],
      });
    return false;
  }
}

type MatchesObject<
  S extends {
    readonly [key: string]: SchemaType | readonly ['optional', SchemaType];
  },
  Refs extends { [key: string]: SchemaType },
> =
  & {
    readonly [
      K in keyof S as S[K] extends readonly ['optional', SchemaType] ? K
        : never
    ]?: S[K] extends readonly ['optional', SchemaType] ? MatchesSchemaType<S[K][1], Refs>
      : unknown;
  }
  & {
    readonly [
      K in keyof S as S[K] extends readonly ['optional', SchemaType] ? never
        : K
    ]: S[K] extends SchemaType ? MatchesSchemaType<S[K], Refs> : unknown;
  };

type MatchesArray<A, Refs extends { [key: string]: SchemaType }> = A extends readonly [] ? never
  : A extends readonly [SchemaType] ? readonly MatchesSchemaType<A[0], Refs>[]
  : A extends readonly [SchemaType, SchemaType]
    ? readonly [MatchesSchemaType<A[0], Refs>, ...MatchesSchemaType<A[1], Refs>[]]
  : A extends readonly [SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      ...MatchesSchemaType<A[2], Refs>[],
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      ...MatchesSchemaType<A[3], Refs>[],
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      ...MatchesSchemaType<A[4], Refs>[],
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType]
    ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      ...MatchesSchemaType<A[5], Refs>[],
    ]
  : A extends
    readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType]
    ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      ...MatchesSchemaType<A[6], Refs>[],
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      ...MatchesSchemaType<A[7], Refs>[],
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      ...MatchesSchemaType<A[8], Refs>[],
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      MatchesSchemaType<A[8], Refs>,
      ...MatchesSchemaType<A[9], Refs>[],
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    ...SchemaType[],
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      MatchesSchemaType<A[8], Refs>,
      MatchesSchemaType<A[9], Refs>,
      ...unknown[],
    ]
  : unknown[];

type MatchesTuple<A, Refs extends { [key: string]: SchemaType }> = A extends readonly [] ? never
  : A extends readonly [SchemaType] ? readonly [MatchesSchemaType<A[0], Refs>]
  : A extends readonly [SchemaType, SchemaType]
    ? readonly [MatchesSchemaType<A[0], Refs>, MatchesSchemaType<A[1], Refs>]
  : A extends readonly [SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
    ]
  : A extends readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType]
    ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
    ]
  : A extends
    readonly [SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType, SchemaType]
    ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      MatchesSchemaType<A[8], Refs>,
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      MatchesSchemaType<A[8], Refs>,
      MatchesSchemaType<A[9], Refs>,
    ]
  : A extends readonly [
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    SchemaType,
    ...SchemaType[],
  ] ? readonly [
      MatchesSchemaType<A[0], Refs>,
      MatchesSchemaType<A[1], Refs>,
      MatchesSchemaType<A[2], Refs>,
      MatchesSchemaType<A[3], Refs>,
      MatchesSchemaType<A[4], Refs>,
      MatchesSchemaType<A[5], Refs>,
      MatchesSchemaType<A[6], Refs>,
      MatchesSchemaType<A[7], Refs>,
      MatchesSchemaType<A[8], Refs>,
      MatchesSchemaType<A[9], Refs>,
      ...unknown[],
    ]
  : unknown[];

export type MatchesSchemaType<
  S extends SchemaType,
  Refs extends { [key: string]: SchemaType },
> = SchemaType extends S ? unknown
  : S extends null | 'null' ? null
  : S extends 'boolean' ? boolean
  : S extends 'integer' | 'float' | 'number' ? number
  : S extends 'string' ? string
  : S extends 'date' ? Date
  : S extends 'binary' ? Uint8Array
  : S extends readonly ['enum', ...infer Values] ? Values[number]
  : S extends readonly ['tuple', ...infer Props] ? MatchesTuple<Props, Refs>
  : S extends readonly ['array', ...infer Props] ? MatchesArray<Props, Refs>
  : S extends readonly ['dictionary', SchemaType]
    ? { readonly [key: string]: MatchesSchemaType<S[1], Refs> }
  : S extends readonly ['oneof', ...infer Branches]
    ? Branches extends readonly SchemaType[] ? MatchesSchemaType<Branches[number], Refs>
    : unknown
  : S extends readonly ['ref', keyof Refs] ? MatchesSchemaType<Refs[S[1]], Refs>
  : S extends {
    readonly [key: string]: SchemaType | readonly ['optional', SchemaType];
  } ? MatchesObject<S, Refs>
  : never;

/**
 * Given a type `S` that describes the exact shape of a `Schema`,
 * `MatchesSchema<S>` is the type of values that match that schema.
 *
 * For example, `MatchesSchema<{ schema: { foo: "string" } }>` is
 * `{ foo: string }`.
 *
 * `MatchesSchema` is a complex recursive type, and can easily cause the
 * Typescript compiler to fail with a "Type instantiation is excessively deep
 * and possibly infinite" error. It should only be used on schema types that are
 * 100% statically known.
 */
export type MatchesSchema<S extends Schema> = Schema extends S ? unknown
  : MatchesSchemaType<
    S['schema'],
    S['let'] extends { [key: string]: SchemaType } ? S['let'] : Record<never, never>
  >;

type Validator = (value: unknown, dataPath: PathArray) => ValidationError[];

type RefValidators<Refs extends { readonly [key: string]: SchemaType }> = {
  [K in keyof Refs]: Validator;
};

export interface ValidationError {
  dataPath: PathArray;
  schemaPath: PathArray;
  message: string;
  children?: ValidationError[][];
}

export function validationErrorToString({ dataPath, schemaPath, message }: ValidationError) {
  return `${pathToString(dataPath)}: ${message} (rule ${pathToString(schemaPath)})`;
}

/**
 * A detailed error thrown by [[assertMatchesSchema]] when schema validation
 * fails. Includes the schema, the JSON that didn't match, and the list of
 * validation errors, complete with JSONPath locations in both the schema and
 * the JSON value.
 */
export class SchemaAssertionError extends Error {
  static maxErrorsPerMessage = 8;

  constructor(
    public readonly json: unknown,
    public readonly schema: Schema,
    public readonly validationErrors: ValidationError[],
    private readonly initialMessage = 'Schema validation failed',
  ) {
    super();
  }

  get message() {
    return `${this.initialMessage}\nJSON: ${
      JSON.stringify(this.json, null, 2)
    }\nValidation errors:${this.validationMessage}`;
  }

  get validationMessage() {
    const max = SchemaAssertionError.maxErrorsPerMessage;
    return this.validationErrors.slice(0, max).map((e) =>
      validationErrorToString(e) +
      (e.children?.length
        ? e.children.slice(0, max).map((es) =>
          '- ' + es.slice(0, max).map(validationErrorToString).join('\n  ') +
          (es.length > max ? `\n  (...and ${es.length - max} more)` : '')
        ).join('\n') +
          (e.children.length > max ? `\n- (...and ${e.children.length - max} more)` : '')
        : '')
    ).join('\n') + (this.validationErrors.length > max
      ? `\n(...and ${this.validationErrors.length - max} more)`
      : '');
  }
}

function validateSchemaType<
  S extends SchemaType,
  Refs extends { readonly [key: string]: SchemaType },
>(schema: S, refs: RefValidators<Refs>, schemaPath: PathArray = []): Validator {
  if (schema === null) {
    return (value, dataPath) =>
      value === null ? [] : [{ dataPath, schemaPath, message: 'expected null' }];
  } else if (Array.isArray(schema)) {
    switch (schema[0]) {
      case 'enum':
        return (value, dataPath) => {
          for (let i = 1; i < schema.length; i++) {
            if (value === schema[i]) {
              return [];
            }
          }
          return [{
            dataPath,
            schemaPath,
            message: schema.length === 2
              ? 'expected the exact value ' + JSON.stringify(schema[1])
              : `expected one of ${
                (schema.slice(1) as SchemaType[]).map((x) => JSON.stringify(x)).join(', ')
              }`,
          }];
        };
      case 'tuple': {
        const predicates = (schema.slice(1) as SchemaType[]).map((e, i) =>
          validateSchemaType(e, refs, [...schemaPath, i + 1])
        );
        return (value, dataPath) => {
          if (!Array.isArray(value)) {
            return [{ dataPath, schemaPath, message: 'expected array' }];
          } else if (value.length !== predicates.length) {
            return [{
              dataPath,
              schemaPath,
              message: `expected array of exactly ${predicates.length} values, got ${value.length}`,
            }];
          }
          return value.flatMap((v, i) => predicates[i](v, [...dataPath, i]));
        };
      }
      case 'array': {
        if (schema.length === 2) {
          const e = validateSchemaType(schema[1], refs, [...schemaPath, 1]);
          return (value, dataPath) => {
            if (!Array.isArray(value)) {
              return [{ dataPath, schemaPath, message: 'expected array' }];
            }
            return value.flatMap((v, i) => e(v, [...dataPath, i]));
          };
        } else {
          const predicates = (schema.slice(1) as SchemaType[]).map((e, i) =>
            validateSchemaType(e, refs, [...schemaPath, i + 1])
          );
          return (value, dataPath) => {
            if (!Array.isArray(value)) {
              return [{ dataPath, schemaPath, message: 'expected array' }];
            } else if (value.length < predicates.length - 1) {
              return [{
                dataPath,
                schemaPath,
                message: `expected array of at least ${
                  predicates.length - 1
                } values, got ${value.length}`,
              }];
            }
            return value.flatMap((v, i) =>
              predicates[
                i < predicates.length - 1 ? i : predicates.length - 1
              ](v, [...dataPath, i])
            );
          };
        }
      }
      case 'dictionary': {
        const e = validateSchemaType(schema[1], refs, [...schemaPath, 1]);
        return (value, dataPath) => {
          if (!isPlainObject(value)) {
            return [{ dataPath, schemaPath, message: 'expected object' }];
          }
          return Object.entries(value).flatMap(([k, v]) => e(v, [...dataPath, k]));
        };
      }
      case 'oneof': {
        const predicates = (schema.slice(1) as SchemaType[]).map((e, i) =>
          validateSchemaType(e, refs, [...schemaPath, i + 1])
        );
        return (value, dataPath) => {
          const children: ValidationError[][] = [];
          for (const p of predicates) {
            const errors = p(value, dataPath);
            if (!errors.length) return [];
            children.push(errors);
          }
          return [{
            dataPath,
            schemaPath,
            message: `all ${predicates.length} options failed`,
            children,
          }];
        };
      }
      case 'ref':
        // Can't use refs[schema[1]] directly because of recursion
        return (value, dataPath) =>
          refs[schema[1]]?.(value, dataPath) ?? [{
            dataPath,
            schemaPath,
            message: `broken ref: schema has no let definition named ${JSON.stringify(schema[1])}`,
          }];
    }
  } else if (isPlainObject(schema)) {
    const predicates = Object.entries(schema).map(([k, v]) => {
      const isOptional = Array.isArray(v) && v[0] === 'optional';
      const predicate = validateSchemaType(isOptional ? v[1] : v, refs, [
        ...schemaPath,
        k,
        ...isOptional ? [1] : [],
      ]);
      return (value: Record<string, unknown>, dataPath: PathArray) =>
        k in value
          ? predicate(value[k as keyof typeof value], [...dataPath, k])
          : (isOptional
            ? []
            : [{ dataPath, schemaPath, message: `missing required field ${JSON.stringify(k)}` }]);
    });
    return (value, dataPath) => {
      if (!isPlainObject(value)) {
        return [{ dataPath, schemaPath, message: 'expected object' }];
      }
      return predicates.flatMap((p) => p(value, dataPath));
    };
  } else {
    switch (schema) {
      case 'null':
        return (value, dataPath) =>
          value === null ? [] : [{ dataPath, schemaPath, message: 'expected null' }];
      case 'boolean':
        return (value, dataPath) =>
          typeof value === 'boolean' ? [] : [{ dataPath, schemaPath, message: 'expected boolean' }];
      case 'float':
      case 'number':
        return (value, dataPath) =>
          typeof value === 'number' ? [] : [{ dataPath, schemaPath, message: 'expected number' }];
      case 'integer':
        return (value, dataPath) =>
          typeof value === 'number' && Number.isInteger(value)
            ? []
            : [{ dataPath, schemaPath, message: 'expected integer' }];
      case 'string':
        return (value, dataPath) =>
          typeof value === 'string' ? [] : [{ dataPath, schemaPath, message: 'expected string' }];
      case 'date':
        return (value, dataPath) =>
          value instanceof Date ? [] : [{ dataPath, schemaPath, message: 'expected date' }];
      case 'binary':
        return (value, dataPath) =>
          ArrayBuffer.isView(value) ? [] : [{ dataPath, schemaPath, message: 'expected binary' }];
    }
  }
  return (_, dataPath) => [{ dataPath, schemaPath, message: 'bad schema' }];
}

/**
 * A curried function that checks whether `value` matches `schema` and returns
 * a boolean.
 *
 * If `schema` is statically known at typechecking type (defined with
 * `as const`), then the function returned by `matchesSchema(schema)` will be a
 * type predicate.
 *
 * `errors` is a mutable array of `{ dataPath, schemaPath, message, children? }`
 * objects. If it is present and `matchesSchema` returns false, it will be
 * populated with a list of validation errors.
 */
export function matchesSchema<S extends Schema>({
  schema,
  let: refs = {},
}: S): (value: unknown, errors?: ValidationError[]) => value is MatchesSchema<S> {
  const refValidators: { [key: string]: Validator } = {};
  for (const [k, v] of Object.entries(refs)) {
    refValidators[k] = validateSchemaType(v, refValidators, ['let', k]);
  }
  const validator = validateSchemaType(schema, refValidators, ['schema']);
  return (value, errors?): value is MatchesSchema<S> => {
    const result = validator(value, []);
    if (result.length) {
      if (errors != null) errors.push(...result);
      return false;
    }
    return true;
  };
}

/**
 * A curried function that checks whether `value` matches `schema` and throws
 * a [[SchemaAssertionError]] if it doesn't.
 *
 * If `schema` is statically known at typechecking type (defined with
 * `as const`), then the function returned by `assertMatchesSchema(schema)` will
 * be a type assertion function.
 *
 * `message` is an optional message string to include in the thrown error.
 */
export function assertMatchesSchema<S extends Schema>(
  schema: S,
): (value: unknown, message?: string) => asserts value is MatchesSchema<S> {
  const refValidators: { [key: string]: Validator } = {};
  for (const [k, v] of Object.entries(schema.let ?? {})) {
    refValidators[k] = validateSchemaType(v, refValidators, ['let', k]);
  }
  const validator = validateSchemaType(schema.schema, refValidators, ['schema']);
  return (value, message?): asserts value is MatchesSchema<S> => {
    const result = validator(value, []);
    if (result.length) {
      throw new SchemaAssertionError(value, schema, result, message);
    }
  };
}

function typeZeroValue(
  schema: SchemaType,
  refs: { readonly [key: string]: SchemaType },
  history: Set<SchemaType>,
): unknown {
  if (schema === null) {
    return null;
  }
  if (typeof schema === 'string') {
    switch (schema) {
      case 'null':
        return null;
      case 'boolean':
        return false;
      case 'float':
      case 'integer':
      case 'number':
        return 0;
      case 'string':
        return '';
      case 'date':
        return new Date(0);
      case 'binary':
        return new Uint8Array();
      default:
        return undefined;
    }
  }
  if (history.has(schema)) {
    throw new Error(
      `Cannot determine zero value of the infinite schema type ${
        JSON.stringify(
          schema,
        )
      }`,
    );
  }
  history.add(schema);

  if (Array.isArray(schema)) {
    switch (schema[0]) {
      case 'enum':
        return schema[1];
      case 'tuple':
        return (schema.slice(1) as SchemaType[]).map((n) => typeZeroValue(n, refs, history));
      case 'array':
        return (schema.slice(1, schema.length - 1) as SchemaType[]).map((n) =>
          typeZeroValue(n, refs, history)
        );
      case 'dictionary':
        return {};
      case 'oneof':
        return typeZeroValue(schema[1], refs, history);
      case 'ref':
        return typeZeroValue(refs[schema[1]], refs, history);
    }
  } else if (typeof schema === 'object') {
    return Object.entries(schema)
      .filter(([, v]) => !Array.isArray(v) || v[0] !== 'optional')
      .reduce(
        (accum: Record<string, unknown>, [k, v]) => ({
          ...accum,
          [k]: typeZeroValue(v, refs, history),
        }),
        {},
      );
  }
  return undefined;
}

/**
 * Returns the *zero value* of this schema's root type.
 *
 * | Type           | Zero value                                    |
 * | -------------- | --------------------------------------------- |
 * | `null`         | `null`                                        |
 * | boolean        | `false`                                       |
 * | integer, float | `0`                                           |
 * | string         | `""`                                          |
 * | binary         | `0`-length `Uint8Array`                       |
 * | date           | `new Date(0)` (Jan 1, 1970)                   |
 * | object         | object populated with properties' zero values |
 * | `oneof`        | zero value of first type                      |
 * | `enum`         | first enum value                              |
 * | `array`        | `[]`                                          |
 * | `tuple`        | array populated with elements' zero values    |
 * | `dictionary`   | `{}`                                          |
 *
 * This function typechecks the schema it receives. If it is passed a known
 * schema type `S` (defined `as const` in a Typescript file), then its return
 * type will be `MatchesSchema<S>`.
 *
 * May throw an exception if the schema type is infinitely recursive.
 */
export function zeroValue<S extends Schema>({
  schema,
  let: refs = {},
}: S): MatchesSchema<S> {
  return typeZeroValue(schema, refs, new Set()) as MatchesSchema<S>;
}
