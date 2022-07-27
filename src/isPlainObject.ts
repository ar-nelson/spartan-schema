// Lodash's isPlainObject function, simplified (no IE<9 support) and condensed.
//
// Original code distributed under this MIT license:
//
// -----------------------------------------------------------------------------
//
// Copyright jQuery Foundation and other contributors <https://jquery.org/>
//
// Based on Underscore.js, copyright Jeremy Ashkenas,
// DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>
//
// This software consists of voluntary contributions made by many
// individuals. For exact contribution history, see the revision history
// available at https://github.com/lodash/lodash
//
// ====
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// -----------------------------------------------------------------------------

const objectTag = '[object Object]',
  funcProto = Function.prototype,
  objectProto = Object.prototype,
  funcToString = funcProto.toString,
  hasOwnProperty = objectProto.hasOwnProperty,
  objectCtorString = funcToString.call(Object),
  objectToString = objectProto.toString,
  getPrototype = (x: unknown) => Object.getPrototypeOf(Object(x));

function isObjectLike(value: unknown): boolean {
  return !!value && typeof value === 'object';
}

export default function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObjectLike(value) || objectToString.call(value) !== objectTag) {
    return false;
  }
  const proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  const Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return (
    typeof Ctor === 'function' &&
    Ctor instanceof Ctor &&
    funcToString.call(Ctor) === objectCtorString
  );
}
