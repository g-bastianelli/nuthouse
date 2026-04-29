const fs = require('fs');
const os = require('os');
const path = require('path');

const FLAG_PATH = path.join(__dirname, '..', 'data', '.state');
const VALID_MODES = new Set(['off', 'saucy', 'gooning']);

let mode = 'off';
try {
  const content = fs.readFileSync(FLAG_PATH, 'utf8').trim();
  if (VALID_MODES.has(content)) mode = content;
} catch (e) {}

if (mode === 'off') process.exit(0);

const messagesPath = path.join(__dirname, '..', 'data', 'messages.json');
const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
const pool = messages[mode] || messages['saucy'];
const message = pool[Math.floor(Math.random() * pool.length)];

process.stdout.write(JSON.stringify({ systemMessage: message }));
