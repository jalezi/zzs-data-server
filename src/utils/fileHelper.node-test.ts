import assert from 'node:assert';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';
import zlib from 'node:zlib';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import { parseCompressedFile } from './fileHelper';

describe('fileHelper tests', () => {
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

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    const [error, rows] = await parseCompressedFile(
      './test-file.tsv.gz',
      'tsv',
    );

    assert.strictEqual(error, undefined);

    assert.deepStrictEqual(rows, [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Another' },
    ]);
  });

  it('should throw an error for a malformed TSV content', async () => {
    // Simulate a malformed TSV file with inconsistent columns
    const malformedContent = 'id\tname\n1\tTest\n2'; // Missing 'name' column in the second row
    const { mockStream, gunzipStream } = setupMocks(malformedContent);

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    // Call the function
    const [error, rows] = await parseCompressedFile(
      './malformed-file.tsv.gz',
      'tsv',
    );
    console.log(error);

    // Assertions
    assert.strictEqual(rows, undefined); // No rows should be returned
    assert.ok(error); // Error should be defined
  });

  it('should handle an empty compressed file gracefully', async () => {
    const { mockStream, gunzipStream } = setupMocks('');

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    const [, rows] = await parseCompressedFile('./empty-file.tsv.gz', 'tsv');

    assert.deepStrictEqual(rows, []);
  });

  it('should handle premature stream closure gracefully', async () => {
    const { mockStream, gunzipStream } = setupMocks();

    // Simulate premature stream closure
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.emit('close'); // Simulate premature closure
    });

    // Call the function
    const [error, rows] = await parseCompressedFile(
      './premature-close.tsv.gz',
      'tsv',
    );

    // Assertions
    assert.strictEqual(rows, undefined); // No rows should be returned
    assert.ok(error); // Error should be defined
  });

  it('should process rows correctly from a valid input', async () => {
    const fileContent = 'id\tname\n1\tTest\n2\tAnother\n';
    const { mockStream, gunzipStream } = setupMocks(fileContent);

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    const [, rows] = await parseCompressedFile('./test-file.tsv.gz', 'tsv');

    assert.deepStrictEqual(rows, [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Another' },
    ]);
  });
});
