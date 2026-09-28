#!/usr/bin/env node

require('dotenv').config();
const readline = require('readline');
const authService = require('../services/auth.service');

function askQuestion(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer ? answer.trim() : '');
    });
  });
}

function askHiddenPassword(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);

    // If stdin is not a TTY (piped or redirected input)
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      rl.once('line', (line) => {
        rl.close();
        resolve(line ? line.trim() : '');
      });
      return;
    }

    // TTY mode: raw mode masking characters with '*'
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
    } catch (_err) {
      // Fallback if setRawMode fails on certain virtual terminals
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer ? answer.trim() : '');
      });
      return;
    }

    let password = '';
    const onKey = (char) => {
      if (char === '\r' || char === '\n' || char === '\u0004') {
        try {
          process.stdin.setRawMode(false);
        } catch (_e) {}
        process.stdin.pause();
        process.stdin.removeListener('data', onKey);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        try {
          process.stdin.setRawMode(false);
        } catch (_e) {}
        process.stdout.write('\n');
        process.exit(130);
      } else if (char === '\b' || char === '\x7f' || char === '\x08') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (char.charCodeAt(0) >= 32) {
        // Printable character
        password += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onKey);
  });
}

/**
 * Parses CLI arguments if provided:
 * --username <name> --password <pass> --role <role>
 * or -u <name> -p <pass> -r <role>
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--username' || arg === '-u') {
      result.username = args[++i];
    } else if (arg === '--password' || arg === '-p') {
      result.password = args[++i];
    } else if (arg === '--role' || arg === '-r') {
      result.role = args[++i];
    }
  }

  return result;
}

/**
 * Collects inputs from pipe if stdin is non-TTY and not all args were provided
 */
async function readPipedInputs() {
  return new Promise((resolve) => {
    const lines = [];
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });
    rl.on('line', (line) => {
      lines.push(line);
    });
    rl.on('close', () => {
      resolve(lines);
    });
  });
}

async function main() {
  const cliArgs = parseArgs();
  let username = cliArgs.username;
  let password = cliArgs.password;
  let role = cliArgs.role;

  // If not all arguments are supplied
  if (!username || !password || !role) {
    if (!process.stdin.isTTY) {
      // Piped mode: read lines
      const lines = await readPipedInputs();
      let lineIdx = 0;
      if (!username && lineIdx < lines.length) username = lines[lineIdx++];
      if (!password && lineIdx < lines.length) password = lines[lineIdx++];
      if (!role && lineIdx < lines.length) role = lines[lineIdx++];
    } else {
      // Interactive TTY mode
      if (!username) {
        username = await askQuestion('Username: ');
      }
      if (!password) {
        password = await askHiddenPassword('Password: ');
      }
      if (!role) {
        role = await askQuestion('Role (admin or viewer): ');
      }
    }
  }

  // 1-3. Validate inputs
  try {
    authService.validateUserInputs({ username, password, role });
  } catch (validationErr) {
    console.error(`Error: ${validationErr.message}`);
    process.exit(1);
  }

  // 4-7. Check users.json, check duplicates, hash password, store user
  try {
    const created = await authService.createUser({ username, password, role });
    console.log(`User "${created.username}" created successfully.`);
    console.log(`Role: ${created.role}`);
    console.log(`ID: ${created.id}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
