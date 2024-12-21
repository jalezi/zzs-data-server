import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse';
import { logger } from './logger';

export const parseCompressedFile = async (
  filePath: string,
  format: 'tsv' | 'csv',
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
): Promise<any[]> => {
  const delimiter = format === 'tsv' ? '\t' : ',';
  logger.info({ filePath, format }, 'Starting file parsing');

  return new Promise((resolve, reject) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const rows: any[] = [];
    fs.createReadStream(filePath)
      .pipe(zlib.createGunzip())
      .pipe(parse({ delimiter, columns: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        logger.info(
          { filePath, rowsCount: rows.length },
          'File parsing completed',
        );
        resolve(rows);
      })
      .on('error', (err) => {
        logger.error({ err, filePath }, 'File parsing failed');
        reject(err);
      });
  });
};
