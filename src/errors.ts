import { PathArray, pathToString } from './path';

export abstract class SpartanError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class RecursionError extends SpartanError {
  constructor(message: string, public readonly label: string) {
    super(`${message} (recursive label: ${label})`);
  }
}

export class SchemaCompileError extends SpartanError {
  constructor(message: string, public readonly path: PathArray) {
    super(`${message} (at ${pathToString(path)})`);
  }
}
