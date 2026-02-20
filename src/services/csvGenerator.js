const fs = require('fs');
const { Transform } = require('stream');
const { stringify } = require('csv-stringify');
const logger = require('../utils/logger');

class CSVGenerator {
  static createWriteStream(filePath, columns, options = {}) {
    const writeStream = fs.createWriteStream(filePath, { flags: 'w' });

    return {
      writeStream,
      csvStringifier: stringify({
        header: true,
        columns: columns,
        delimiter: options.delimiter || ',',
        quote: options.quoteChar || '"',
        escape: options.quoteChar || '"'
      })
    };
  }

  static formatRecord(row, selectedColumns) {
    const record = {};
    selectedColumns.forEach(col => {
      if (col in row) {
        record[col] = row[col];
      }
    });
    return record;
  }

  static getHeaderRow(columns) {
    return columns;
  }
}

module.exports = CSVGenerator;
