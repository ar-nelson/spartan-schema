# Spartan Schema

An ultra-minimal JSON schema language for strongly-typed data. Much, much
simpler than [JSON Schema][json-schema]. Just write the shape of your data, in
a Typescript-like format, and it does what you expect.

```json
{
  "compilerOptions": {
    "module": ["enum", "commonjs", "amd", "umd", "system", "es6"],
    "noImplicitAny": "boolean",
    "removeComments": "boolean",
    "preserveConstEnums": "boolean",
    "sourceMap": "boolean"
  },
  "files": ["string"],
  "include": ["string"],
  "exclude": ["string"]
}
```

*Example: A schema for a subset of [`tsconfig.json`][tsconfig]. Fields not
specified here are allowed, and will not be typechecked.*

Includes `binary` and `date` types, for formats that support them. Given
a parser for the format, Spartan Schema can validate TOML, YAML, MessagePack,
CBOR, and probably other formats too.

Spartan Schema was designed as part of [Osmosis][osmosis], and that guided most
design decisions. Any usefulness in other contexts is just a nice bonus.

> **Current status: alpha.** Although this is a very small library, it is not
> thoroughly tested, so I don't recommend using it in production yet.

## The Schema Language

- Scalar types: `"string"`, `"integer"`, `"float"`, `"binary"`, `"date"`,
  `"boolean"`, `null`, `["enum", …]`.
  - `"enum"` takes a list of scalar values (strings, numbers, `true`, `false`,
    `null`):
    ```json
    ["enum", "foo", "bar", "baz"]
    ```
- Composite types: objects, arrays, `["dictionary", …]`, `["oneof", …]`, `any`.
  - An object type is an object that maps keys to types. All keys are optional.
    ```json
    { "name": "string", "age": "integer" }
    ```
  - An array type is a one-element array containing another type.
    ```json
    ["integer"]
    ```
  - `"dictionary"` describes an object that may contain any keys, but all values
    must be of the same type.
    ```json
    ["dictionary", "integer"]
    ```
  - `"oneof"` takes a list of types, and matches any of them:
    ```json
    ["oneof", "integer", "string"]
    ```
  - `"any"` matches anything.
- Labels and references
  - `$` at the start of a key is a reserved character. It can be escaped as
    `$$`.
  - A key starting with `$` defines a labeled type, which is in scope in its
    containing object and all of that object's children.
  - A string starting with `$` is a reference to an in-scope label.
  - Example:

    ```json
    {
      "$Numbers": ["integer"],
      "foo": "$Numbers",
      "bar": "$Numbers"
    }
    ```

…and that's it. That's the whole language.

## Comparison to JSON Schema

Spartan Schema is *much less verbose* than JSON Schema, but also less powerful.
Sometimes, this is a worthwhile tradeoff.

(Examples taken from https://json-schema.org/learn/miscellaneous-examples.html)

<table>
<tr><th>JSON Schema</th><th>Spartan Schema</th></tr>
<tr>
<td>

```json
{
  "$id": "https://example.com/person.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Person",
  "type": "object",
  "properties": {
    "firstName": {
      "type": "string",
      "description": "The person's first name."
    },
    "lastName": {
      "type": "string",
      "description": "The person's last name."
    },
    "age": {
      "description": "Age in years…",
      "type": "integer",
      "minimum": 0
    }
  }
}
```

</td><td>

```json
{
  "firstName": "string",
  "lastName": "string",
  "age": "integer"
}
```

This schema is much shorter, but does not include field descriptions, and cannot
specify a minimum for `age`.

</td></tr><tr><td>

```json
{
  "$id": "https://example.com/arrays.schema.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "fruits": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "vegetables": {
      "type": "array",
      "items": { "$ref": "#/$defs/veggie" }
    }
  },
  "$defs": {
    "veggie": {
      "type": "object",
      "required": [ "veggieName", "veggieLike" ],
      "properties": {
        "veggieName": {
          "type": "string",
          "description": "The name of the vegetable."
        },
        "veggieLike": {
          "type": "boolean",
          "description": "Do I like this vegetable?"
        }
      }
    }
  }
}
```

</td><td>

```json
{
  "fruits": ["string"],
  "vegetables": ["$Veggie"],
  "$Veggie": {
    "veggieName": "string",
    "veggieLike": "boolean"
  }
}
```

Spartan Schema supports references too, but it doesn't support required fields.

</td></tr></table>

## API

Spartan Schema has an object-oriented API. `compileSchema` takes a JS object
representing a schema source, and returns a `Schema` object with methods for
validation and inspection.

```javascript
import { compileSchema } from 'spartan-schema';

const schema = compileSchema({ city: 'string', state: 'string' });
schema.validate({ city: 'New York', state: 'New York' }); // = []

// If validate returns an empty array, the object matched the schema.
```

### function `compileSchema(source)`

Compiles a `source` object and returns a `Schema`. If you are trying to compile
a schema written in JSON, `JSON.parse` it first.

Can throw a `SchemaCompileError`.

### class `Schema`

A compiled Spartan Schema. A `Schema` represents a single top-level type; each
individual type within a `Schema` is itself a `Schema`.

#### method `validate(value, options?)`

Tests whether `value` matches this schema.

Returns an array of validation errors as `{ path, type, value }` objects. `path`
is an array of `string`s or `number`s, showing where the type mismatch occurred.
`type` is the `Schema` at that path, and `value` is the value at that path that
did not match `type`. If `validate` returns an empty array, validation was
successful.

`options` is an optional object, with the following optional keys:

- `allowExtraFields`, boolean: If `true`, validation will fail if any object
  contains fields not specified in the schema. Defaults to `false`.
- `path`, array: A path to append to the start of the `path`s in the returned
  error objects. Used internally.

#### method `restrict(value, options?)`

Removes all object keys and array elements from `value` that do not match this
schema, and optionally inserts zero values in missing keys. Returns either
a value that matches this schema, or `undefined` if even the top-level type does
not match.

`options` is an optional object, with the following optional keys:

- `fillEmpty`, boolean: If `true`, all array and object types in this schema are
  populated with empty arrays or empty objects if missing. Defaults to `false`.
- `fillZero`, boolean: If `true`, all missing object keys in this schema are
  populated with their types' zero values. Implies `fillEmpty`. Defaults to
  `false`.
- `coerce`, boolean: If `true`, when `restrict` encounters a scalar value that
  does not match its schema type, but could be converted to match that type, it
  will be converted instead of removed. Defaults to `false`. The following
  conversions are supported:
  - `false`, `0`, `"null"` → `null`
  - `null` → boolean (as `false`)
  - integer, float → boolean (`0` is `false`)
  - float → integer (rounded to nearest integer)
  - `null`, boolean, integer, float → string
  - string → `null`, boolean, integer, float (if it parses)
  - binary → string (as base64)
  - string → binary (if valid base64)
  - date → string (as ISO 8601)
  - string → date (if valid ISO 8601)
  - date → integer (as UNIX timestamp)
  - integer → date (as UNIX timestamp)

Can throw a `RecursionError` if called on a recursive schema with either
`fillEmpty` or `fillZero` set to `true`.

#### method `zeroValue()`

Returns the *zero value* of this schema type.

| Type           | Zero value                                   |
| -------------- | -------------------------------------------- |
| `null`         | `null`                                       |
| boolean        | `false`                                      |
| integer, float | `0`                                          |
| string         | `""`                                         |
| binary         | `0`-length `Uint8Array`                      |
| date           | `new Date(0)` (Jan 1, 1970)                  |
| `enum`         | first enum value                             |
| array          | `[]`                                         |
| object         | object populated with all keys' zero values  |
| `dictionary`   | `{}`                                         |
| `oneof`        | zero value of first type                     |
| `any`          | `null`                                       |

Can throw a `RecursionError` if called on a recursive object type.

#### method `atPath(path)`

Given a `path` array consisting of strings and numbers (object keys and array
indexes), returns a `Schema` representing the type at that path in this schema.
Returns `undefined` if the path is not valid in this schema.

Can throw an `AmbiguousPathError` if called on a schema without a fixed shape
(see `hasFixedShape`).

#### method `toSource()`

Decompiles a compiled schema into its JSON source (as objects, not a JSON
string).

Not guaranteed to be a safe round-trip operation if recursive references are
involved; the result will contain labels without corresponding definitions.

#### method `isScalar()`

Returns `true` if this schema is a scalar type (not an array or object).

#### method `isArray()`

Returns `true` if this schema is an array type.

#### method `isObject()`

Returns `true` if this schema is an object or `dictionary` type.

#### method `isRecursive()`

Returns `true` if this schema contains recursive references that could cause
`zeroValue` to fail.

### method `hasFixedShape()`

Returns `true` if this schema meets the condition that *every typed location
must be **only one of** a scalar, an array, or an object*.

In a schema with a fixed shape, `atPath` can know with certainty whether a given
path is valid or invalid, and can always return a type or `undefined`.

This will return `false` if the schema contains:

- a `oneof` containing an array, an object, or a `dictionary`, or
- the type `any`.

### exception `AmbiguousPathError`

Thrown when `atPath` is called on a path that is valid for some—but not all—JSON
values that match a schema. For example:

```json
{
  "foo": ["oneof", ["string"], { "bar": "integer" }]
}
```

What is the type of `["foo", 0]` in this schema? It could be `"string"`, but it
could also be `undefined` if `foo` is an object. When faced with this ambiguity,
Spartan Schema throws an exception.

`hasFixedShape` checks whether your schema is safe from these ambiguities.

### exception `RecursionError`

Thrown when  `zeroValue` is called on a recursive schema, or when `restrict` is
called with the options `fillEmpty: true` or `fillZero: true` on a recursive
schema. This would produce an infinitely nested object, so it throws an
exception instead.

### exception `SchemaCompileError`

Thrown when `compileSchema` fails to compile its input.

## License

Copyright &copy; 2021 Adam Nelson

Spartan Schema is distributed under the [Blue Oak Model License][blue-oak]. It
is a MIT/BSD-style license, but with [some clarifying
improvements][why-blue-oak] around patents, attribution, and multiple
contributors.

[json-schema]: https://json-schema.org
[tsconfig]: https://www.typescriptlang.org/tsconfig
[osmosis]: https://github.com/ar-nelson/osmosis-js
[blue-oak]: https://blueoakcouncil.org/license/1.0.0
[why-blue-oak]: https://writing.kemitchell.com/2019/03/09/Deprecation-Notice.html
