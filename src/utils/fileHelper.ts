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
    let streamEnded = false;

    const input = fs.createReadStream(filePath).on('error', (err) => {
      logger.error({ err, filePath }, 'File reading failed');
      reject(err);
    });

    const gunzip = zlib.createGunzip().on('error', (err) => {
      logger.error({ err, filePath }, 'Decompression failed');
      reject(err);
    });

    const parser = parse({ delimiter, columns: true })
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        streamEnded = true;
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

    input
      .pipe(gunzip)
      .on('close', () => {
        logger.debug({ filePath, streamEnded }, 'Stream closed');
        if (!streamEnded) {
          const error = new Error('Premature stream closure or unexpected end');
          logger.error({ err: error, filePath }, 'File parsing failed');
          reject(error);
        }
      })
      .pipe(parser);
  });
};
