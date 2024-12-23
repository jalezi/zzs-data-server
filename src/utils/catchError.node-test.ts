import assert from 'node:assert';
import { describe, it } from 'node:test';
import { catchError } from './catchError';

class SpecificError extends Error {}
class AnotherError extends Error {}

describe('catchError', () => {
  it('should return [undefined, resolvedValue] for a successful promise', async () => {
    const promise = Promise.resolve('Success');
    const result = await catchError(promise, [SpecificError]);
    assert.deepStrictEqual(result, [undefined, 'Success']);
  });

  it('should return [error] if no specific errors are provided and an error occurs', async () => {
    const error = new Error('Test error');
    const promise = Promise.reject(error);

    const result = await catchError(promise);
    assert.deepStrictEqual(result, [error]);
  });

  it('should return [error] if a specific error is caught', async () => {
    const error = new SpecificError('Specific error');
    const promise = Promise.reject(error);

    const result = await catchError(promise, [SpecificError]);
    assert.deepStrictEqual(result, [error]);
  });

  it('should rethrow errors not listed in errorsToCatch', async () => {
    const error = new AnotherError('Unhandled error');
    const promise = Promise.reject(error);

    await assert.rejects(
      () => catchError(promise, [SpecificError]),
      AnotherError,
    );
  });
});
