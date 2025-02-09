import assert from 'node:assert';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';
import zlib from 'node:zlib';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import { z } from 'zod';
import { parseFile, parseRawContent } from './fileHelper';

describe('fileHelper tests', () => {
  describe('parse compressed file', () => {
    let fsMock: SinonStub;
    let zlibMock: SinonStub;
    let parseMock: SinonStub;

    beforeEach(() => {
      // Reset and stub mocks
      fsMock = sinon.stub(fs, 'createReadStream');
      zlibMock = sinon.stub(zlib, 'createGunzip');
      parseMock = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    /**
     * Helper function to set up mocks for streams.
     */
    const setupMocks = (
      fileContent?: string,
      emitError?: Error | { code: string; message: string },
    ) => {
      const mockStream = new PassThrough();
      const gunzipStream = new PassThrough();
      const parseStream = new PassThrough({ objectMode: true });

      if (fileContent) {
        mockStream.write(fileContent);
        mockStream.end(); // Mark end of stream
      }

      if (emitError) {
        setImmediate(() => parseStream.emit('error', emitError));
      }

      fsMock.returns(mockStream);
      zlibMock.returns(gunzipStream);
      parseMock.callsFake(() => parseStream);

      return { mockStream, gunzipStream, parseStream };
    };

    it('should parse a valid TSV file successfully', async () => {
      const { mockStream, gunzipStream } = setupMocks(
        'id\tname\n1\tTest\n2\tAnother\n',
      );
      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
      });

      // Simulate file content piping
      setImmediate(() => {
        mockStream.pipe(gunzipStream);
        gunzipStream.end();
      });

      const [error, result] = await parseFile(
        './test-file.tsv.gz',
        'tsv',
        schemaWithHeader,
        true,
      );

      assert.strictEqual(error, undefined);

      assert.deepStrictEqual(result, {
        data: [
          { id: '1', name: 'Test' },
          { id: '2', name: 'Another' },
        ],
        meta: {
          totalRows: 2,
          validRows: 2,
          invalidRows: 0,
          allValid: true,
        },
      });
    });

    it('should throw an error for a malformed TSV content', async () => {
      // Simulate a malformed TSV file with inconsistent columns
      const malformedContent = 'id\tname\n1\tTest\n2'; // Missing 'name' column in the second row
      const { mockStream, gunzipStream } = setupMocks(malformedContent);

      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
      });

      // Simulate file content piping
      setImmediate(() => {
        mockStream.pipe(gunzipStream);
        gunzipStream.end();
      });

      // Call the function
      const [error, rows] = await parseFile(
        './malformed-file.tsv.gz',
        'tsv',
        schemaWithHeader,
        true,
      );

      // Assertions
      assert.strictEqual(rows, undefined); // No rows should be returned
      assert.ok(error); // Error should be defined
    });

    it('should handle an empty compressed file gracefully', async () => {
      const { mockStream, gunzipStream } = setupMocks('');

      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
      });

      // Simulate file content piping
      setImmediate(() => {
        mockStream.pipe(gunzipStream);
        gunzipStream.end();
      });

      const [, result] = await parseFile(
        './empty-file.tsv.gz',
        'tsv',
        schemaWithHeader,
        true,
      );

      assert.deepStrictEqual(result, {
        data: [],
        meta: { totalRows: 0, validRows: 0, invalidRows: 0, allValid: true },
      });
    });

    it('should handle premature stream closure gracefully', async () => {
      const { mockStream, gunzipStream } = setupMocks();

      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
      });

      // Simulate premature stream closure
      setImmediate(() => {
        mockStream.pipe(gunzipStream);
        gunzipStream.emit('close'); // Simulate premature closure
      });

      // Call the function
      const [error, rows] = await parseFile(
        './premature-close.tsv.gz',
        'tsv',
        schemaWithHeader,
        true,
      );

      // Assertions
      assert.strictEqual(rows, undefined); // No rows should be returned
      assert.ok(error); // Error should be defined
    });

    it('should process rows correctly from a valid input', async () => {
      const fileContent = 'id\tname\n1\tTest\n2\tAnother\n';
      const { mockStream, gunzipStream } = setupMocks(fileContent);

      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
      });

      // Simulate file content piping
      setImmediate(() => {
        mockStream.pipe(gunzipStream);
        gunzipStream.end();
      });

      const [, result] = await parseFile(
        './test-file.tsv.gz',
        'tsv',
        schemaWithHeader,
        true,
      );

      assert.deepStrictEqual(result, {
        data: [
          { id: '1', name: 'Test' },
          { id: '2', name: 'Another' },
        ],
        meta: {
          totalRows: 2,
          validRows: 2,
          invalidRows: 0,
          allValid: true,
        },
      });
    });
  });

  describe('parse raw file', () => {
    it('should parse csv file with header row with all valid rows', async () => {
      const csvWithHeader = 'id,name,age\n1,John,30\n2,Jane,25\n3,Mary, -5';
      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
        age: z.preprocess(
          (val) => (val === '' ? undefined : val),
          z.coerce.number(),
        ),
      });

      const [error, result] = await parseRawContent(
        csvWithHeader,
        'csv',
        schemaWithHeader,
      );

      assert.equal(error, undefined);
      assert.equal(result?.meta.totalRows, 3);
      assert.equal(result?.meta.validRows, 3);
      assert.equal(result?.meta.invalidRows, 0);
      assert.equal(result?.meta.allValid, true);

      assert.deepEqual(result?.data, [
        { id: '1', name: 'John', age: 30 },
        { id: '2', name: 'Jane', age: 25 },
        { id: '3', name: 'Mary', age: -5 },
      ]);
    });

    it('should parse csv with header row with invalid row', async () => {
      const csvWithHeader = 'id,name,age\n1,John,30\n2,Jane,25\n3,Mary,';
      const schemaWithHeader = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
        age: z.preprocess(
          (val) => (val === '' ? undefined : val),
          z.coerce.number(),
        ),
      });

      const [error, result] = await parseRawContent(
        csvWithHeader,
        'csv',
        schemaWithHeader,
      );
      assert.equal(error, undefined);
      assert.equal(result?.meta.totalRows, 3);
      assert.equal(result?.meta.validRows, 2);
      assert.equal(result?.meta.invalidRows, 1);
      assert.equal(result?.meta.allValid, false);

      assert.deepEqual(result?.data, [
        { id: '1', name: 'John', age: 30 },
        { id: '2', name: 'Jane', age: 25 },
      ]);
    });

    it('should parse csv with error', async () => {
      const malformedCsv = 'id,name,age\n1,John\n2,Jane,25'; // Missing 'age' value for row 1

      const schema = z.object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
        age: z.preprocess(
          (val) => (val === '' ? undefined : val),
          z.coerce.number(),
        ),
      });

      const [error, result] = await parseRawContent(
        malformedCsv,
        'csv',
        schema,
      );

      // Assertions
      assert.ok(error); // An error should be returned
      assert.ok(error);
      assert.equal(result, undefined); // Result should be undefined
      assert.match(
        (error as Error)?.message,
        /Invalid Record Length:/i, // Check that the error message is meaningful
      );
    });
  });
});
