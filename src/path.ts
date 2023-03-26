// Spartan Schema
// Copyright © 2021-2023 Adam Nelson <adam@nels.onl>
// Distributed under the Blue Oak Model License

/**
 * A more general type than `PathArray`, for any iterable value that can
 * describe a specific location in a JSON document.
 */
export type Path = Iterable<string | number>;

/**
 * A path to a specific location in a JSON document.
 */
export type PathArray = readonly (string | number)[];

/**
 * Returns a parseable string representation of a `Path`, in JSONPath format.
 */
export function pathToString(path: Path): string {
  let output = '$';
  for (const element of path) {
    if (typeof element === 'string' && /^[a-z_$][a-z0-9_$]*$/i.test(element)) {
      output = `${output}.${element}`;
    } else {
      output = `${output}[${JSON.stringify(element)}]`;
    }
  }
  return output;
}
