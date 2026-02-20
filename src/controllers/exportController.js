const ExportService = require('../services/exportService');
const { validateColumns, validateDelimiter, validateQuoteChar, validateFilters } = require('../utils/validators');
const logger = require('../utils/logger');
const fs = require('fs');
const zlib = require('zlib');

class ExportController {
  static async initiateExport(req, res) {
    try {
      const columns = req.query.columns ? validateColumns(req.query.columns) : null;
      const delimiter = validateDelimiter(req.query.delimiter);
      const quoteChar = validateQuoteChar(req.query.quoteChar);

      const filters = validateFilters({
        country_code: req.query.country_code,
        subscription_tier: req.query.subscription_tier,
        min_ltv: req.query.min_ltv
      });

      const exportId = await ExportService.initiateExport(filters, columns, delimiter, quoteChar);

      res.status(202).json({
        exportId,
        status: 'pending'
      });

      logger.info(`Export initiated: ${exportId}`, { filters });
    } catch (error) {
      logger.error('Export initiation error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  }

  static getStatus(req, res) {
    try {
      const { exportId } = req.params;
      const job = ExportService.getStatus(exportId);

      if (!job) {
        return res.status(404).json({
          error: 'Export not found'
        });
      }

      res.json({
        exportId: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error || null,
        createdAt: job.createdAt?.toISOString(),
        completedAt: job.completedAt?.toISOString() || null
      });
    } catch (error) {
      logger.error('Status check error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static downloadExport(req, res) {
    try {
      const { exportId } = req.params;
      const job = ExportService.getStatus(exportId);

      if (!job) {
        return res.status(404).json({
          error: 'Export not found'
        });
      }

      if (job.status !== 'completed') {
        return res.status(425).json({
          error: `Export is ${job.status}. Please wait for completion or check status.`
        });
      }

      const filePath = ExportService.getFilePath(exportId);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'File not found'
        });
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const acceptGzip = req.headers['accept-encoding']?.includes('gzip');

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || start > end) {
          res.status(416).set({
            'Content-Range': `bytes */${fileSize}`
          }).end();
          return;
        }

        const chunkSize = (end - start) + 1;
        const readStream = fs.createReadStream(filePath, { start, end });

        if (acceptGzip) {
          res.status(206).set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="export_${exportId}.csv.gz"`,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Encoding': 'gzip',
            'Accept-Ranges': 'bytes'
          });

          readStream.pipe(zlib.createGzip()).pipe(res);
        } else {
          res.status(206).set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="export_${exportId}.csv"`,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunkSize,
            'Accept-Ranges': 'bytes'
          });

          readStream.pipe(res);
        }

        logger.info(`Download range: ${exportId} (bytes ${start}-${end})`);
        return;
      }

      const readStream = fs.createReadStream(filePath);

      if (acceptGzip) {
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="export_${exportId}.csv.gz"`,
          'Content-Encoding': 'gzip',
          'Accept-Ranges': 'bytes',
          'Transfer-Encoding': 'chunked'
        });

        readStream.pipe(zlib.createGzip()).pipe(res);
      } else {
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="export_${exportId}.csv"`,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes'
        });

        readStream.pipe(res);
      }

      logger.info(`Download started: ${exportId} (${fileSize} bytes)`);

    } catch (error) {
      logger.error('Download error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static cancelExport(req, res) {
    try {
      const { exportId } = req.params;
      const result = ExportService.cancelExport(exportId);

      if (!result.found) {
        return res.status(404).json({
          error: 'Export not found'
        });
      }

      if (!result.cancelled) {
        return res.status(400).json({
          error: 'Export cannot be cancelled in its current state'
        });
      }

      logger.info(`Export cancelled: ${exportId}`);
      res.status(204).send();

    } catch (error) {
      logger.error('Cancel error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  static health(req, res) {
    res.json({ status: 'ok' });
  }
}

module.exports = ExportController;
