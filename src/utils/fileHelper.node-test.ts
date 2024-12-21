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

    // Mock parse function
    parseMock = sinon.stub().callsFake((_options, callback) => {
      const parseStream = new (require('node:stream').Transform)({
        objectMode: true,
        transform(
          chunk: { toString: () => string },
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          _encoding: any,
          done: () => void,
        ) {
          const rows = chunk
            .toString()
            .split('\n')
            .slice(1) // Skip header
            .map((line) => {
              const [id, name] = line.split('\t');
              return { id, name };
            });
          // biome-ignore lint/complexity/noForEach: <explanation>
          rows.forEach((row) => this.push(row));
          done();
        },
      });
      callback(null, parseStream);
      return parseStream;
    });

    loggerInfoSpy = sinon.spy(logger, 'info');
    loggerErrorSpy = sinon.spy(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should parse a valid TSV file successfully', async () => {
    const mockStream = new PassThrough(); // Use PassThrough
    mockStream.push('id\tname\n1\tTest\n2\tAnother\n');
    mockStream.push(null); // End of stream

    fsMock.returns(mockStream);

    const gunzipStream = new PassThrough();
    zlibMock.returns(gunzipStream);

    setImmediate(() => {
      gunzipStream.write('id\tname\n1\tTest\n2\tAnother\n');
      gunzipStream.end();
    });

    parseMock.callsFake((_options) => {
      const parseStream = new PassThrough({
        objectMode: true,
        transform(chunk, _encoding, callback) {
          const rows = chunk
            .toString()
            .split('\n')
            .slice(1) // Skip header
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            .map((line: { split: (arg0: string) => [any, any] }) => {
              const [id, name] = line.split('\t');
              return { id, name };
            });

          // biome-ignore lint/complexity/noForEach: <explanation>
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          rows.forEach((row: any) => this.push(row));
          callback();
        },
      });
      return parseStream;
    });

    const rows = await parseCompressedFile('./test-file.tsv.gz', 'tsv');

    assert.deepStrictEqual(rows, [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Another' },
    ]);

    assert(
      loggerInfoSpy.calledWithMatch(
        { filePath: './test-file.tsv.gz', format: 'tsv' },
        'Starting file parsing',
      ),
    );
    assert(
      loggerInfoSpy.calledWithMatch(
        { filePath: './test-file.tsv.gz', rowsCount: 2 },
        'File parsing completed',
      ),
    );
  });

  it.skip('should throw an error for an invalid file', async () => {
    const mockStream = new PassThrough();
    const error = new Error('Invalid file');

    // Mock fs.createReadStream to return the mock stream
    fsMock.returns(mockStream);

    // Mock zlib.createGunzip to pass the mockStream
    const gunzipStream = new PassThrough();
    zlibMock.returns(gunzipStream);

    // Mock parse to return another mock stream
    const parseStream = new PassThrough({
      objectMode: true,
      transform(_chunk, _encoding, callback) {
        console.log('Transforming');
        callback(null, parseStream); // Call the callback with an error
      },
    });
    parseMock.callsFake(() => parseStream);

    // Emit an error on the parseStream
    setImmediate(() => {
      mockStream.emit('error', error); // End of stream
    });

    // Call the function and ensure it rejects
    await assert.rejects(
      () => parseCompressedFile('./invalid-file.tsv.gz', 'tsv'),
      error,
    );

    // Check logger calls
    assert(
      loggerErrorSpy.calledWithMatch(
        { err: error, filePath: './invalid-file.tsv.gz' },
        'File parsing failed',
      ),
    );
  });

  it.skip('should throw an error for a malformed compressed file', async () => {
    const mockStream = new PassThrough();
    const gunzipStream = new PassThrough();
    const error = new Error('Malformed gzip data');

    // Mock fs.createReadStream to return the mock stream
    fsMock.returns(mockStream);

    // Mock zlib.createGunzip to emit an error
    zlibMock.returns(gunzipStream);
    setImmediate(() => {
      gunzipStream.emit('error', error); // Emit the error
    });

    // Call the function and ensure it rejects
    await assert.rejects(
      () => parseCompressedFile('./malformed-file.tsv.gz', 'tsv'),
      error,
    );

    // Check logger calls
    assert(
      loggerErrorSpy.calledWithMatch(
        { err: error, filePath: './malformed-file.tsv.gz' },
        'File parsing failed',
      ),
    );
  });

  it('should throw an error for a malformed TSV content', async () => {
    const mockStream = new PassThrough();
    const gunzipStream = new PassThrough();
    const parseStream = new PassThrough({ objectMode: true });
    const error = {
      code: 'CSV_RECORD_INCONSISTENT_COLUMNS',
      message: 'Invalid Record Length: columns length is 2, got 1 on line 3',
    };

    // Mock fs.createReadStream to return the mock stream
    fsMock.returns(mockStream);

    // Mock zlib.createGunzip to return the gunzip stream
    zlibMock.returns(gunzipStream);

    // Mock parse to emit a CsvError
    parseMock.callsFake(() => {
      setImmediate(() => {
        parseStream.emit('error', error);
      });
      return parseStream;
    });

    // Simulate valid file content being piped into the parser
    setImmediate(() => {
      mockStream.pipe(gunzipStream);
      gunzipStream.write('id\tname\n1\tTest\ninvalid-row\n');
      gunzipStream.end();
    });

    await assert.rejects(
      () => parseCompressedFile('./malformed-content.tsv.gz', 'tsv'),
      new Error('Invalid Record Length: columns length is 2, got 1 on line 3'),
    );

    // Verify the logger captured the error
    assert(
      loggerErrorSpy.calledWithMatch(
        sinon.match.has(
          'err',
          sinon.match.has(
            'message',
            'Invalid Record Length: columns length is 2, got 1 on line 3',
          ),
        ),
        'File parsing failed',
      ),
    );
  });

  it.skip('should handle an empty compressed file gracefully', async () => {
    // Placeholder for empty file test
  });
});
