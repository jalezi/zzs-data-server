import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import sinon from 'sinon';
import { catchError, loggerMessages } from './catchError';
import { logger } from './logger';

class SpecificError extends Error {}
class AnotherError extends Error {}

describe('catchError', () => {
  let loggerInfoStub: sinon.SinonStub;
  let loggerWarnStub: sinon.SinonStub;
  let loggerErrorStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub the logger methods
    loggerInfoStub = sinon.stub(logger, 'info');
    loggerWarnStub = sinon.stub(logger, 'warn');
    loggerErrorStub = sinon.stub(logger, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return [undefined, resolvedValue] for a successful promise', async () => {
    const promise = Promise.resolve('Success');
    const result = await catchError(promise, [SpecificError]);
    assert.deepStrictEqual(result, [undefined, 'Success']);
    sinon.assert.calledWith(
      loggerInfoStub,
      loggerMessages.success,
      sinon.match.any,
    );
  });

  it('should return [error] if no specific errors are provided and an error occurs', async () => {
    const error = new Error('Test error');
    const promise = Promise.reject(error);

    const result = await catchError(promise, []);
    assert.deepStrictEqual(result, [error]);
    sinon.assert.calledWith(
      loggerErrorStub,
      loggerMessages.unknown,
      sinon.match.any,
    );
  });

  it('should return [error] if a specific error is caught', async () => {
    const error = new SpecificError('Specific error');
    const promise = Promise.reject(error);

    const result = await catchError(promise, [SpecificError]);
    assert.deepStrictEqual(result, [error]);
    sinon.assert.calledWith(
      loggerWarnStub,
      loggerMessages.specific,
      sinon.match.any,
    );
  });

  it('should rethrow errors not listed in errorsToCatch', async () => {
    const error = new AnotherError('Unhandled error');
    const promise = Promise.reject(error);

    await assert.rejects(
      () => catchError(promise, [SpecificError]),
      AnotherError,
    );
    sinon.assert.calledWith(
      loggerErrorStub,
      loggerMessages.unhandled,
      sinon.match.any,
    );
  });

  it('should handle non-Error types gracefully', async () => {
    const promise = Promise.reject('String error'); // Non-Error type
    const result = await catchError(promise, [SpecificError]);

    assert.deepStrictEqual(result, ['String error']); // Ensure correct return value

    sinon.assert.calledWith(loggerErrorStub, loggerMessages.unknown, {
      errorType: 'Unknown', // Non-Error types are logged as 'Unknown'
      error: 'String error', // The raw string value
      stack: undefined, // Non-Error types do not have a stack
    });
  });

  it('should log errors appropriately', async () => {
    const error = new SpecificError('Specific error');
    const promise = Promise.reject(error);

    await catchError(promise, [SpecificError]);

    sinon.assert.calledWithMatch(loggerWarnStub, loggerMessages.specific, {
      errorType: 'SpecificError',
      error: 'Specific error',
    });
  });
});
