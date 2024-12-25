import assert from 'node:assert';
import { afterEach, describe, it } from 'node:test';
import proxyquire from 'proxyquire';
import sinon from 'sinon';

const mockDataFiles = [
  { id: 'file1', path: '/path/to/file1', format: 'csv' },
  { id: 'file2', path: '/path/to/file2', format: 'tsv' },
];

// Create a mock for the fileHelper module
const fileHelperMock = {
  parseFile: sinon.stub(),
};

// Use proxyquire to mock both the config and fileHelper modules
const { getFileData } = proxyquire('./tsvService', {
  '../database/config': { dataFiles: mockDataFiles },
  '../utils/fileHelper': fileHelperMock,
});

describe('getFileData', () => {
  afterEach(() => {
    sinon.restore();
    fileHelperMock.parseFile.reset(); // Reset mock calls
  });

  it('should return data for a valid file ID', async () => {
    const mockParsedData = [{ name: 'John', age: 30 }];
    fileHelperMock.parseFile.resolves(mockParsedData);

    const result = await getFileData('file1');
    assert.deepStrictEqual(result, mockParsedData);

    // Ensure the function calls parseCompressedFile with correct arguments
    sinon.assert.calledWith(fileHelperMock.parseFile, '/path/to/file1', 'csv');
  });

  it('should throw an error if the file ID is not found', async () => {
    await assert.rejects(async () => {
      await getFileData('nonExistentFile');
    }, new Error('File not found'));
  });

  it('should propagate errors from parseCompressedFile', async () => {
    fileHelperMock.parseFile.rejects(new Error('Parse error'));

    await assert.rejects(async () => {
      await getFileData('file1');
    }, new Error('Parse error'));
  });
});
