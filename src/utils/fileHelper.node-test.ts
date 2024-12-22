import assert from 'node:assert';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';
import zlib from 'node:zlib';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import { loggerMessages, parseCompressedFile } from './fileHelper';
import { logger } from './logger';

describe('fileHelper tests', () => {
  let fsMock: SinonStub;
  let zlibMock: SinonStub;
  let parseMock: SinonStub;
  let loggerInfoSpy: SinonSpy;
  let loggerErrorSpy: SinonSpy;

  beforeEach(() => {
    // Reset and stub mocks
    fsMock = sinon.stub(fs, 'createReadStream');
    zlibMock = sinon.stub(zlib, 'createGunzip');
    parseMock = sinon.stub();

    // Spy on logger
    loggerInfoSpy = sinon.spy(logger, 'info');
    loggerErrorSpy = sinon.spy(logger, 'error');
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

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', format: 'tsv' },
      loggerMessages.start,
    );
    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', rowsCount: 2 },
      loggerMessages.success,
    );
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

    sinon.assert.calledWithMatch(
      loggerErrorSpy,
      sinon.match.has('err', sinon.match.instanceOf(Error)), // Check if error is logged
      loggerMessages.parseError,
    );
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

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './empty-file.tsv.gz', format: 'tsv' },
      loggerMessages.start,
    );
    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './empty-file.tsv.gz', rowsCount: 0 },
      loggerMessages.success,
    );
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

    console.log({ error, rows });

    // Assertions
    assert.strictEqual(rows, undefined); // No rows should be returned
    assert.ok(error); // Error should be defined

    sinon.assert.calledWithMatch(
      loggerErrorSpy,
      sinon.match.has('err', sinon.match.instanceOf(Error)), // Check if error is logged
      loggerMessages.parseError,
    );
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

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', rowsCount: 2 },
      loggerMessages.success,
    );
  });
});
