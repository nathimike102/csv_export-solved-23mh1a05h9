const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');
const jobQueue = require('./jobQueue');
const CSVGenerator = require('./csvGenerator');
const logger = require('../utils/logger');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000');
const EXPORT_PATH = process.env.EXPORT_STORAGE_PATH || '/app/exports';

class ExportService {
  static async initiateExport(filters = {}, columns = null, delimiter = ',', quoteChar = '"') {
    const exportId = uuidv4();

    await jobQueue.addJob(exportId, {
      filters,
      columns: columns || [
        'id', 'name', 'email', 'signup_date', 'country_code', 'subscription_tier', 'lifetime_value'
      ],
      delimiter,
      quoteChar
    });

    this.processExport(exportId).catch(err => {
      logger.error(`Export ${exportId} processing error:`, err);
      jobQueue.failJob(exportId, err);
    });

    return exportId;
  }

  static async processExport(exportId) {
    const job = jobQueue.getJob(exportId);
    if (!job) {
      throw new Error(`Job ${exportId} not found`);
    }

    jobQueue.startJob(exportId);

    const client = await pool.connect();
    const filePath = path.join(EXPORT_PATH, `${exportId}.csv`);

    try {
      if (!fs.existsSync(EXPORT_PATH)) {
        fs.mkdirSync(EXPORT_PATH, { recursive: true });
      }

      let query = 'SELECT * FROM users WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (job.filters.country_code) {
        query += ` AND country_code = $${paramIndex}`;
        params.push(job.filters.country_code);
        paramIndex++;
      }

      if (job.filters.subscription_tier) {
        query += ` AND subscription_tier = $${paramIndex}`;
        params.push(job.filters.subscription_tier);
        paramIndex++;
      }

      if (job.filters.min_ltv !== undefined) {
        query += ` AND lifetime_value >= $${paramIndex}`;
        params.push(job.filters.min_ltv);
        paramIndex++;
      }

      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
      const countResult = await client.query(countQuery, params);
      const totalRows = parseInt(countResult.rows[0].count);
      job.progress.totalRows = totalRows;

      if (totalRows === 0) {
        this.createEmptyCSV(filePath, job.columns, job.delimiter, job.quoteChar);
        jobQueue.completeJob(exportId, filePath);
        logger.info(`Export ${exportId} completed (0 rows)`);
        return;
      }

      const cursorName = `export_cursor_${exportId.replace(/-/g, '_')}`;
      await client.query(`DECLARE ${cursorName} CURSOR FOR ${query}`, params);

      let processedRows = 0;
      const writeStream = fs.createWriteStream(filePath);

      const { csvStringifier } = CSVGenerator.createWriteStream(filePath, job.columns, {
        delimiter: job.delimiter,
        quoteChar: job.quoteChar
      });

      csvStringifier.pipe(writeStream);

      try {
        while (true) {
          if (jobQueue.getJob(exportId)?.status === 'cancelled') {
            await client.query(`CLOSE ${cursorName}`);
            throw new Error('Export cancelled by user');
          }

          const result = await client.query(`FETCH ${BATCH_SIZE} FROM ${cursorName}`);

          if (result.rows.length === 0) {
            csvStringifier.end();
            break;
          }

          for (const row of result.rows) {
            const record = CSVGenerator.formatRecord(row, job.columns);
            
            const canContinue = csvStringifier.write(record);
            if (!canContinue) {
              await new Promise(resolve => csvStringifier.once('drain', resolve));
            }

            processedRows++;
          }

          jobQueue.updateProgress(exportId, processedRows, totalRows);
          logger.debug(`Export ${exportId} progress: ${processedRows}/${totalRows}`);
        }

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        jobQueue.completeJob(exportId, filePath);
        logger.info(`Export ${exportId} completed (${processedRows} rows)`);

      } catch (err) {
        try {
          await client.query(`CLOSE ${cursorName}`);
        } catch (e) {
          logger.debug('Cursor close error:', e);
        }
        throw err;
      }

    } catch (error) {
      logger.error(`Export ${exportId} failed:`, error);
      jobQueue.failJob(exportId, error);

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          logger.error(`Failed to delete file ${filePath}:`, e);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  static createEmptyCSV(filePath, columns, delimiter = ',', quoteChar = '"') {
    const headerLine = columns
      .map(col => `${quoteChar}${col}${quoteChar}`)
      .join(delimiter);

    fs.writeFileSync(filePath, headerLine + '\n');
  }

  static getStatus(exportId) {
    return jobQueue.getJob(exportId);
  }

  static cancelExport(exportId) {
    const job = jobQueue.getJob(exportId);

    if (!job) {
      return { found: false };
    }

    const cancelled = jobQueue.cancelJob(exportId);

    if (cancelled && job.filePath) {
      const filePath = job.filePath;
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`Cleaned up file for cancelled export ${exportId}`);
          } catch (err) {
            logger.error(`Failed to clean up file ${filePath}:`, err);
          }
        }
      }, 100);
    }

    return { found: true, cancelled };
  }

  static getFilePath(exportId) {
    const job = jobQueue.getJob(exportId);
    if (!job || job.status !== 'completed') {
      return null;
    }
    return job.filePath;
  }

  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

module.exports = ExportService;
