'use strict'

const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { DateTime } = require('luxon');

const main = async () => {
    const sourcePath = core.getInput('source_path');
    const destPath = core.getInput('dest_path');

    const input = fs.createReadStream(sourcePath);
    const rl = readline.createInterface({input});

    let seenHeaders = false;
    let date = '';
    let done = false;
    let stats = {};
    rl.on('line', line => {
        if (done || line.trim() === '') {
            // Already done - ignore any additional lines which are emitted.
            return;
        }
        if (!seenHeaders) {
            // Skip the header row.
            seenHeaders = true;
            return;
        }

        // Split on comma; probably _should_ use a proper CSV parser, but the
        // data file contains nothing special (not even any quoted fields).
        let fields = line.split(',');

        if (date === '') {
            // First actual data row.  Grab the date.
            date = fields[0];
        }
        if (fields[0] !== date) {
            // This day is done - we've moved on to the next date.
            writeData(stats, destPath, date);
            date = fields[0];
            stats = {};
        }

        // Process row.
        if (fields[1] !== 'Confirmed') {
            // Unconfirmed; skip.
            return;
        }
        if (fields[5] === 'Yes') {
            // Overseas travel.
            incStat(stats, 'Overseas travel', fields[7]);
            return;
        }

        // Increment region/DHB's count.
        incStat(stats, fields[4], fields[7]);
    });

    rl.on('close', () => {
        console.log(stats);
        input.close();
        writeData(stats, destPath, date);
    });
  }

  function incStat(stats, key, num) {
    num = parseInt(num, 10);
    if (stats.hasOwnProperty(key)) {
        stats[key] += num;
    } else {
        stats[key] = num;
    }
  }

  function writeData(stats, pathTemplate, date) {
    let parsed = DateTime.fromISO(date);
    let outPath = parsed.toFormat(pathTemplate);
    let dirName = path.dirname(outPath);
    fs.mkdirSync(dirName, {recursive: true});
    fs.writeFile(outPath, JSON.stringify(stats), (err) => {
        if (err) {
            throw err;
        }
        console.log(`Data file ${outPath} written.`);
      });
  }
  
  main().catch(err => core.setFailed(err.message))