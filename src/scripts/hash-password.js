#!/usr/bin/env node
/**
 * Generate a bcrypt password hash to put into ADMIN_PASSWORD_HASH.
 *
 * Usage:
 *   npm run hash-password -- <password>
 *   node src/scripts/hash-password.js <password>
 *
 * If no password is passed as an argument, the script prompts for it on
 * stdin (input is hidden).
 */

const bcrypt = require('bcrypt');
const readline = require('readline');

const ROUNDS = 10;

async function readHiddenLine(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    // Mute echo by overriding the output write for the duration of this prompt.
    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = function (stringToWrite) {
      if (stringToWrite === '\n' || stringToWrite === '\r\n') {
        originalWrite.call(rl, stringToWrite);
      }
      // swallow other characters
    };

    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  let password = process.argv.slice(2).join(' ');

  if (!password) {
    password = await readHiddenLine('Password: ');
  }

  if (!password) {
    console.error('No password provided. Aborting.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.warn('⚠️ Password is shorter than 8 characters. Recommended minimum is 12.');
  }

  const hash = await bcrypt.hash(password, ROUNDS);
  console.log('');
  console.log('Add this to your .env file:');
  console.log('');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
