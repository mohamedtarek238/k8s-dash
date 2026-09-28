const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');

// Create temporary isolated test directory
const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k8s-auth-test-'));
const testUsersFile = path.join(testTmpDir, 'users.json');
process.env.USERS_FILE_PATH = testUsersFile;
process.env.JWT_SECRET = 'test-auth-jwt-secret-xyz123';

const authService = require('../src/services/auth.service');
const { createApp } = require('../src/app');

console.log('--- Starting Authentication & User Management Test Suite ---');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✓ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

(async () => {
  // Test 1: Automatically creates users.json if absent
  await runAsyncTest('1. Automatically create users.json when absent and create admin user', async () => {
    assert.strictEqual(fs.existsSync(testUsersFile), false);
    const created = await authService.createUser({
      username: 'admin2',
      password: 'password123',
      role: 'admin',
    });

    assert.strictEqual(created.username, 'admin2');
    assert.strictEqual(created.role, 'admin');
    assert.strictEqual(created.id, 1);
    assert.strictEqual(fs.existsSync(testUsersFile), true);

    const users = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    assert.strictEqual(users.length, 1);
    assert.strictEqual(users[0].username, 'admin2');
    assert.strictEqual(users[0].role, 'admin');
    assert.strictEqual(typeof users[0].passwordHash, 'string');
    assert.strictEqual(users[0].passwordHash.startsWith('$2'), true);
  });

  // Test 2: Password security - only bcrypt hash stored, NO plaintext
  runTest('2. Security: No plaintext or decryptable passwords stored in users.json', () => {
    const rawContent = fs.readFileSync(testUsersFile, 'utf8');
    assert.strictEqual(rawContent.includes('password123'), false, 'Plaintext password must not exist in file');
    const users = JSON.parse(rawContent);
    assert.strictEqual(users[0].password, undefined);
    assert.strictEqual(users[0].plainPassword, undefined);
    assert.strictEqual(users[0].encryptedPassword, undefined);
  });

  // Test 3: Create viewer user and preserve existing users
  await runAsyncTest('3. Create viewer user and preserve existing users with unique ID', async () => {
    const created = await authService.createUser({
      username: 'testuser',
      password: 'viewerpass123',
      role: 'viewer',
    });

    assert.strictEqual(created.username, 'testuser');
    assert.strictEqual(created.role, 'viewer');
    assert.strictEqual(created.id, 2);

    const users = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    assert.strictEqual(users.length, 2);
    assert.strictEqual(users[0].username, 'admin2');
    assert.strictEqual(users[1].username, 'testuser');
    assert.strictEqual(users[1].role, 'viewer');
  });

  // Test 4: Duplicate user rejection
  await runAsyncTest('4. Prevent duplicate usernames (case-insensitive)', async () => {
    let errorThrown = false;
    try {
      await authService.createUser({
        username: 'TESTUSER',
        password: 'anotherpass123',
        role: 'viewer',
      });
    } catch (err) {
      errorThrown = true;
      assert.strictEqual(err.message.includes('already exists'), true);
    }
    assert.strictEqual(errorThrown, true);

    const users = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    assert.strictEqual(users.length, 2);
  });

  // Test 5: Role validation
  await runAsyncTest('5. Validate role must be admin or viewer', async () => {
    let errorThrown = false;
    try {
      await authService.createUser({
        username: 'superman',
        password: 'secretpass123',
        role: 'superadmin',
      });
    } catch (err) {
      errorThrown = true;
      assert.strictEqual(err.message.includes("Role must be either 'admin' or 'viewer'"), true);
    }
    assert.strictEqual(errorThrown, true);
  });

  // Test 6: CLI Script execution via npm run create-user / node script
  runTest('6. CLI script: executes successfully with arguments and hidden input logic', () => {
    const scriptPath = path.resolve(__dirname, '../src/scripts/create-user.js');
    const result = spawnSync('node', [
      scriptPath,
      '--username', 'clisample',
      '--password', 'clipass123',
      '--role', 'viewer',
    ], {
      env: {
        ...process.env,
        USERS_FILE_PATH: testUsersFile,
      },
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout.includes('User "clisample" created successfully'), true);
    assert.strictEqual(result.stdout.includes('clipass123'), false, 'Password must not be printed');

    const users = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    assert.strictEqual(users.some((u) => u.username === 'clisample'), true);
  });

  // Test 7: CLI duplicate check exits with status code 1
  runTest('7. CLI script: duplicate username exits with code 1 and error message', () => {
    const scriptPath = path.resolve(__dirname, '../src/scripts/create-user.js');
    const result = spawnSync('node', [
      scriptPath,
      '--username', 'clisample',
      '--password', 'clipass123',
      '--role', 'viewer',
    ], {
      env: {
        ...process.env,
        USERS_FILE_PATH: testUsersFile,
      },
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.stderr.includes('already exists'), true);
  });

  // Test 8: Login verification with plaintext password (bcrypt.compare succeeds)
  await runAsyncTest('8. Login: verifyCredentials succeeds with valid plaintext password', async () => {
    const verified = await authService.verifyCredentials('admin2', 'password123');
    assert.notStrictEqual(verified, null);
    assert.strictEqual(verified.username, 'admin2');
    assert.strictEqual(verified.role, 'admin');
  });

  // Test 9: Login failure with invalid password
  await runAsyncTest('9. Login: verifyCredentials fails with invalid password', async () => {
    const verified = await authService.verifyCredentials('admin2', 'wrongpassword');
    assert.strictEqual(verified, null);
  });

  // Test 10: JWT token generation and verification
  runTest('10. JWT: generateToken creates valid token decodable with verifyToken', () => {
    const user = { id: 1, username: 'admin2', role: 'admin' };
    const token = authService.generateToken(user);
    assert.strictEqual(typeof token, 'string');

    const decoded = authService.verifyToken(token);
    assert.strictEqual(decoded.id, 1);
    assert.strictEqual(decoded.username, 'admin2');
    assert.strictEqual(decoded.role, 'admin');
  });

  // Test 11: Password reset successfully changes the password hash but preserves ID and role
  await runAsyncTest('11. Password Reset: successfully changes hash and preserves ID/role', async () => {
    const usersBefore = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    const adminBefore = usersBefore.find(u => u.username === 'admin2');
    
    const updated = await authService.resetPassword({
      username: 'admin2',
      newPassword: 'newpassword123'
    });

    assert.strictEqual(updated.username, 'admin2');
    assert.strictEqual(updated.id, adminBefore.id);
    assert.strictEqual(updated.role, adminBefore.role);

    const usersAfter = JSON.parse(fs.readFileSync(testUsersFile, 'utf8'));
    const adminAfter = usersAfter.find(u => u.username === 'admin2');
    
    assert.notStrictEqual(adminAfter.passwordHash, adminBefore.passwordHash);
  });

  // Test 12: Login with old password fails
  await runAsyncTest('12. Password Reset: login with old password fails', async () => {
    const verified = await authService.verifyCredentials('admin2', 'password123');
    assert.strictEqual(verified, null);
  });

  // Test 13: Login with new password succeeds
  await runAsyncTest('13. Password Reset: login with new password succeeds', async () => {
    const verified = await authService.verifyCredentials('admin2', 'newpassword123');
    assert.notStrictEqual(verified, null);
    assert.strictEqual(verified.username, 'admin2');
  });

  // Test 14: Password reset fails for unknown user
  await runAsyncTest('14. Password Reset: fails for unknown user', async () => {
    let errorThrown = false;
    try {
      await authService.resetPassword({
        username: 'nonexistent',
        newPassword: 'newpassword123'
      });
    } catch (err) {
      errorThrown = true;
      assert.strictEqual(err.message.includes('does not exist'), true);
    }
    assert.strictEqual(errorThrown, true);
  });

  // Test 15: CLI Script execution for password reset
  runTest('15. CLI script: executes successfully via piped inputs', () => {
    const scriptPath = path.resolve(__dirname, '../src/scripts/reset-password.js');
    const child = require('child_process').spawnSync('node', [scriptPath], {
      input: 'admin2\nverynewpassword\nverynewpassword\n',
      env: {
        ...process.env,
        USERS_FILE_PATH: testUsersFile,
      },
      encoding: 'utf8',
    });

    assert.strictEqual(child.status, 0);
    assert.strictEqual(child.stdout.includes('reset successfully'), true);
  });

  // Test 16: Login with new CLI-set password succeeds
  await runAsyncTest('16. CLI script: login with CLI-set password succeeds', async () => {
    const verified = await authService.verifyCredentials('admin2', 'verynewpassword');
    assert.notStrictEqual(verified, null);
    assert.strictEqual(verified.username, 'admin2');
  });

  // Cleanup tmp dir
  try {
    fs.rmSync(testTmpDir, { recursive: true, force: true });
  } catch (_e) {}

  console.log(`\n========================================`);
  console.log(`Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
})();
