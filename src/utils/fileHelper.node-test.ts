import assert from 'node:assert';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';
import zlib from 'node:zlib';
import sinon from 'sinon';
import type { SinonSpy, SinonStub } from 'sinon';
import { parseCompressedFile } from './fileHelper';
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

    const rows = await parseCompressedFile('./test-file.tsv.gz', 'tsv');

    assert.deepStrictEqual(rows, [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Another' },
    ]);

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', format: 'tsv' },
      'Starting file parsing',
    );
    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', rowsCount: 2 },
      'File parsing completed',
    );
  });

  it('should throw an error for a malformed TSV content', async () => {
    const error = {
      code: 'CSV_RECORD_INCONSISTENT_COLUMNS',
      message: 'Invalid Record Length: columns length is 2, got 1 on line 3',
    };
    const { mockStream, gunzipStream } = setupMocks(
      'id\tname\n1\tTest\ninvalid-row\n',
      error,
    );

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    await assert.rejects(
      () => parseCompressedFile('./malformed-content.tsv.gz', 'tsv'),
      new Error('Invalid Record Length: columns length is 2, got 1 on line 3'),
    );

    sinon.assert.calledWithMatch(
      loggerErrorSpy,
      sinon.match.has(
        'err',
        sinon.match.has(
          'message',
          'Invalid Record Length: columns length is 2, got 1 on line 3',
        ),
      ),
      'File parsing failed',
    );
  });

  it('should handle an empty compressed file gracefully', async () => {
    const { mockStream, gunzipStream } = setupMocks('');

    // Simulate file content piping
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.end();
    });

    const rows = await parseCompressedFile('./empty-file.tsv.gz', 'tsv');

    assert.deepStrictEqual(rows, []);

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './empty-file.tsv.gz', format: 'tsv' },
      'Starting file parsing',
    );
    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './empty-file.tsv.gz', rowsCount: 0 },
      'File parsing completed',
    );
  });

  it('should handle premature stream closure gracefully', async () => {
    const { mockStream, gunzipStream } = setupMocks();

    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.emit('close'); // Premature close
    });

    await assert.rejects(
      () => parseCompressedFile('./premature-closure-file.tsv.gz', 'tsv'),
      new Error('Premature stream closure or unexpected end'),
    );

    sinon.assert.calledWithMatch(
      loggerErrorSpy,
      sinon.match.has(
        'err',
        sinon.match.has(
          'message',
          'Premature stream closure or unexpected end',
        ),
      ),
      'File parsing failed',
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

    const rows = await parseCompressedFile('./test-file.tsv.gz', 'tsv');
    assert.deepStrictEqual(rows, [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Another' },
    ]);

    sinon.assert.calledWithMatch(
      loggerInfoSpy,
      { filePath: './test-file.tsv.gz', rowsCount: 2 },
      'File parsing completed',
    );
  });
});
