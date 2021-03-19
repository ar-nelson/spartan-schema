import { expect } from 'chai';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import YAML from 'yaml';
import { compileSchema, Schema } from '../src';

describe('Spartan Schema', function () {
  const schemas: {
    schema: any;
    pass: any[];
    fail: any[];
    restrict: any[];
  }[] = YAML.parse(readFileSync('test/testcases.yaml', { encoding: 'utf8' }));

  for (const { schema, pass = [], fail = [], restrict = [] } of schemas) {
    describe(JSON.stringify(schema), function () {
      let compiledSchema: Schema<unknown>;

      it('should compile', function () {
        compiledSchema = compileSchema(schema);
        expect(compiledSchema).to.be.instanceOf(Schema);
      });

      for (const value of pass) {
        it(`pass: ${JSON.stringify(value)}`, function () {
          expect(compiledSchema.validate(value)).to.deep.equal([]);
        });
      }

      for (const value of fail) {
        it(`fail: ${JSON.stringify(value)}`, function () {
          expect(compiledSchema.validate(value)).to.have.length.greaterThan(0);
        });
      }

      for (const { from, to, ...options } of restrict) {
        it(`restrict: ${JSON.stringify(from)} ${JSON.stringify(
          options
        )}`, function () {
          expect(compiledSchema.restrict(from, options)).to.deep.equal(to);
        });
      }
    });
  }
});
