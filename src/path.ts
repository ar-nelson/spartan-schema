export type Path = Iterable<string | number>;

export type PathArray = readonly (string | number)[];

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
