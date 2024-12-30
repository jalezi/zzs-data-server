import assert from 'node:assert';
import { describe, it } from 'node:test';
import express from 'express';
import proxyquire from 'proxyquire';
import request from 'supertest';

// Mock configuration for dataFiles
const mockedConfig = {
  dataFiles: [
    { id: 'file1', path: './test-data/file1.tsv.gz', format: 'tsv' },
    { id: 'file2', path: './test-data/file2.csv.gz', format: 'csv' },
    { id: 'file3', path: './test-data/file3.csv.gz', format: 'csv' },
  ],
};

// Mock parseCompressedFile utility
const mockedFileHelper = {
  parseFile: async (
    path: string,
    _format: string,
    _zodSchema: unknown,
    _isCompressed: boolean,
  ) => {
    if (path.includes('file1'))
      return [undefined, { data: [{ id: 1, name: 'Test Data 1' }] }];
    if (path.includes('file2'))
      return [undefined, { data: [{ id: 2, name: 'Test Data 2' }] }];
    if (path.includes('file3')) return [new Error('Failed to parse')];
    return [new Error('Failed to parse')];
  },
};

// Replace dependencies with mocks
const dataRoutes = proxyquire('./dataRoutes', {
  '../../database/config': mockedConfig,
  '../../utils/fileHelper': mockedFileHelper,
}).default;

const app = express();
app.use(express.json());
app.use('/v1/data', dataRoutes);

describe('dataRoutes', () => {
  it('should return parsed data for a valid file ID', async () => {
    const response = await request(app).get('/v1/data/file1');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(response.body.data, [
      { id: 1, name: 'Test Data 1' },
    ]);
  });

  it('should return an error with message "File not found"', async () => {
    const response = await request(app).get('/v1/data/invalidFile');
    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.message, 'File not found');
  });

  it('should handle parsing errors gracefully', async () => {
    const response = await request(app).get('/v1/data/file3');
    assert.strictEqual(response.status, 500);
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.message, 'Failed to parse');
  });
});
