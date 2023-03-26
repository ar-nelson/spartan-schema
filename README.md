# Spartan Schema

An ultra-minimal, Typescript-compatible alternative to [JSON
Schema][json-schema], designed as part of [Osmosis][osmosis].

**Spartan Schema is...**

- **Clear**: Spartan Schemas are singificantly simpler than comparable JSON
  schemas. Here's a schema that will match objects like
  `{ name: { first: "Al", last: "Yankovic" }, age: 62 }`:

   ```json
   {
     "schema": {
       "name": {
         "first": "string",
         "middle": ["optional", "string"],
         "last": "string"
       },
       "age": "integer"
     }
   }
   ```

- **Compatible**: Spartan Schema includes `binary` and `date` types, for
  languages like YAML and MessagePack that support more data types than JSON.
  The parser expects a JavaScript object, which can be parsed from any JSON-like
  format, or written directly in JS/TS source.

- **Minimal**: The entire specification fits on a single page. Spartan Schema
  can describe itself in 20 lines of YAML:

   ```yaml
   spartan: 1
   let:
     EnumValue: [oneof, null, boolean, number, string]
     Type:
     - oneof
     - [enum, null, 'null', boolean, integer, float, number, string, date, binary]
     - [array, [enum, enum], [ref, EnumValue], [ref, EnumValue]]
     - [array, [enum, oneof], [ref, Type], [ref, Type]]
     - [array, [enum, tuple], [ref, Type], [ref, Type]]
     - [array, [enum, array], [ref, Type], [ref, Type]]
     - [tuple, [enum, dictionary], [ref, Type]]
     - [tuple, [enum, ref], string]
     - - dictionary
       - - oneof
         - [tuple, [enum, optional], [ref, Type]]
         - [ref, Type]
   schema:
     spartan: [optional, [enum, 1]]
     let: [optional, [dictionary, [ref, Type]]]
     schema: [ref, Type]
   ```

- **Statically typed**: Spartan Schema uses [Typescript 4.1 recursive
  conditional types][types] to convert schemas into Typescript type definitions.
  A schema written directly in source code can be a single source of truth for
  both compile-time and runtime typechecking.

   ```typescript
   import { matchesSchema } from 'spartan-schema';

   // Schemas should be defined with 'as const', for typechecking.
   const personSchema = {
     schema: {
       name: {
         first: 'string',
         middle: ['optional', 'string'],
         last: 'string'
       },
       age: 'integer'
     }
   } as const;

   const isPerson = matchesSchema(personSchema);

   function loadPerson(json: string) {
     const data = JSON.parse(json);
     if (!isPerson(data)) {
       throw new Error("JSON data does not match schema");
     }

     // The type of `data` is now:
     //
     // { name: { first: string, middle?: string, last: string }, age: number }
     //
     // This type was derived from `personSchema`!

     console.log(`Hello, ${data.name.first} ${data.name.last}!`);
   }
   ```

## Usage

Spartan Schema is compatible with both Node and Deno, and has no dependencies.

The repository is written in Deno-compatible Typescript. `mod.ts` can be
imported directly:

```typescript
import {
  Schema,
  matchesSchema
} from 'https://deno.land/x/spartanschema/v1.1.0/mod.ts';
```

The Node module is built with [`dnt`][dnt], and is available on NPM as
`spartan-schema`:

```typescript
import {
  Schema,
  matchesSchema
} from 'spartan-schema';
```

All `deno` build commands are documented in the Makefile. To run the test suite
and build the Node module, just run `make` (requires Deno).

## The Schema Language

### The Root Object

The root of a Spartan Schema is an object. This object must contain a `"schema"`
property, and may optionally contain `"spartan"` and `"let"` properties. Other
properties are allowed, and will be ignored.

- `"schema"`: The schema itself. A single schema type.
- `"let"`: An object whose values are schema types. Its properties are defined
  as *reference types*, which can be accessed with the `"ref"` directive type.
  - For example, `{ "let": { "Foo": "string" }, "schema": ["ref", "Foo"] }` is
    equivalent to `{ "schema": "string" }`.
- `"spartan"`: The Spartan Schema major version of this schema. If present, it
  must be `1`.

### Schema Types

- Primitive types: `"string"`, `"integer"`, `"float"`, `"number"`, `"binary"`, `"date"`,
  `"boolean"`, `null`.
  - `"float"` is an alias for `"number"`.
  - `"null"` can also be written as the literal value `null`.
- Object type: An object whose keys are schema types. Matches an object with
  all of the included keys, if those keys' values match their schema types.
  - Unspecified keys are allowed, and will not be checked.
  - Keys are required by default. To make a key optional, use the directive type
    `"optional"`: `{ "optionalKey": ["optional", <value type>] }`
- Directive types: Arrays whose first element is a string. The string is the
  *name* of the directive, and the rest of the array is the directive's
  *arguments*.
  - `"enum"` takes an argument list of primitive values (strings, numbers,
    `true`, `false`, `null`) and matches only those exact values.
  - `"oneof"` takes an argument list of schema types and matches anything that
    matches at least one of those types.
  - `"tuple"` takes an argument list of schema types and matches an array with
    that exact length, with each element matching the argument at the same
    index.
  - `"array"` takes an argument list of schema types.
    - If it has one argument, it matches an array of any length whose elements
      all match that argument.
    - If it has more than one argument, it behaves like `"tuple"` with
      a variable-length suffix: given *N* arguments, `"array"` matches an array
      with at least *N - 1* elements, where each of these elements matches the
      argument of the same index, followed by 0 or more additional elements
      which match the last argument.
  - `"dictionary"` takes one schema type argument, and matches an object whose
    values all match this argument.
  - `"ref"` takes one string argument. Its argument must be a key in the root
    object's `"let"` property. A `"ref"` is substituted with the value of the
    `"let"` property that it names.
    - Recursion is allowed, and `"ref"`s can be used inside of `"let"` to create
      infinite types.
  - `"optional"` is only allowed as a value of an object type. It takes one
    schema type argument. It makes its key in the object type optional, with
    its argument as the value type.

## Comparison to JSON Schema

Spartan Schema is *much less verbose* than JSON Schema, but has more limited
features.

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
      "description": "Age in years.",
      "type": "integer",
      "minimum": 0
    }
  }
}
```

</td><td>

```json
{
  "schema": {
    "firstName": "string",
    "lastName": "string",
    "age": "integer"
  }
}
```

This schema is much shorter, but does not include names, URLs, or field
descriptions, and cannot specify a minimum for `age`.

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
  "let": {
    "Veggie": {
      "veggieName": "string",
      "veggieLike": "boolean"
    }
  },
  "schema": {
    "fruits": ["array", "string"],
    "vegetables": ["array", ["ref", "Veggie"]]
  }
}
```

Spartan Schema supports references, using `"let"` and `"ref"`. All fields are
required unless marked `"optional"`.

</td></tr></table>

## API

Spartan Schema defines only a few functions that operate on schema objects.
A schema object is made up of plain JavaScript objects and arrays that match the
Spartan Schema spec.

### type `Schema`

The type of valid Spartan Schemas.

When writing schemas directly in Typescript code, you should not use this type;
instead, use `as const` and let Typescript infer the exact type of the schema.

### type `MatchesSchema<S extends Schema>`

Given a type `S` that describes the exact shape of a `Schema`,
`MatchesSchema<S>` is the type of values that match that schema.

For example, `MatchesSchema<{ schema: { foo: "string" } }>` is
`{ foo: string }`.

`MatchesSchema` is a complex recursive type, and can easily cause the Typescript
compiler to fail with a "Type instantiation is excessively deep and possibly
infinite" error. It should only be used on schema types that are 100% statically
known.

### type `PathArray`

`type PathArray = readonly (string | number)[]`

A path to a specific location in a JSON document.

### type `SchemaAssertionError`

`{ json, schema, validationErrors, message }`

A detailed error thrown by `assertMatchesSchema` when schema validation fails.
Includes the schema, the JSON that didn't match, and the list of validation
errors, complete with JSONPath locations in both the schema and the JSON value.

### function `isSchema(schema, errors?)`

A type predicate that checks whether `schema` is a valid Spartan Schema.

`errors` is a mutable array of `{ message, location }` pairs; if it is present
and `isSchema` returns false, it will be populated with a list of parsing
errors.

### function `matchesSchema(schema)(value, errors?)`

A curried function that checks whether `value` matches `schema` and returns
a boolean.

If `schema` is statically known at typechecking type (defined with `as const`),
then the function returned by `matchesSchema(schema)` will be a type predicate.

`errors` is a mutable array of `{ dataPath, schemaPath, message, children? }`
objects. If it is present and `matchesSchema` returns false, it will be
populated with a list of validation errors.

### function `assertMatchesSchema(schema)(value, message?)`

A curried function that checks whether `value` matches `schema` and throws
a `SchemaAssertionError` if it doesn't.

If `schema` is statically known at typechecking type (defined with `as const`),
then the function returned by `assertMatchesSchema(schema)` will be a type
assertion function.

`message` is an optional message string to include in the thrown error.

### function `zeroValue(schema)`

Returns the *zero value* of this schema's root type.

| Type           | Zero value                                    |
| -------------- | --------------------------------------------- |
| `null`         | `null`                                        |
| boolean        | `false`                                       |
| integer, float | `0`                                           |
| string         | `""`                                          |
| binary         | `0`-length `Uint8Array`                       |
| date           | `new Date(0)` (Jan 1, 1970)                   |
| object         | object populated with properties' zero values |
| `oneof`        | zero value of first type                      |
| `enum`         | first enum value                              |
| `array`        | `[]`                                          |
| `tuple`        | array populated with elements' zero values    |
| `dictionary`   | `{}`                                          |

This function typechecks the schema it receives. If it is passed a known schema
type `S` (defined `as const` in a Typescript file), then its return type will
be `MatchesSchema<S>`.

May throw an exception if the schema type is infinitely recursive.

## License

Copyright &copy; 2021-2023 Adam Nelson

Spartan Schema is distributed under the [Blue Oak Model License][blue-oak]. It
is a MIT/BSD-style license, but with [some clarifying
improvements][why-blue-oak] around patents, attribution, and multiple
contributors.

[json-schema]: https://json-schema.org
[osmosis]: https://github.com/ar-nelson/osmosis-js
[types]: https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
[dnt]: https://github.com/denoland/dnt
[blue-oak]: https://blueoakcouncil.org/license/1.0.0
[why-blue-oak]: https://writing.kemitchell.com/2019/03/09/Deprecation-Notice.html
