const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'k8s-dashboard-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Resolves the path to users.json.
 * Defaults to backend/data/users.json or backend/users.json.
 */
function getUsersFilePath() {
  if (process.env.USERS_FILE_PATH) {
    return path.resolve(process.env.USERS_FILE_PATH);
  }
  const dataUsersJson = path.resolve(__dirname, '../../data/users.json');
  if (fs.existsSync(dataUsersJson)) {
    return dataUsersJson;
  }
  const rootUsersJson = path.resolve(__dirname, '../../users.json');
  if (fs.existsSync(rootUsersJson)) {
    return rootUsersJson;
  }
  return dataUsersJson;
}

/**
 * Reads all users from users.json.
 * Returns empty array if file does not exist or is empty.
 */
function getUsers() {
  const filePath = getUsersFilePath();
  if (!fs.existsSync(filePath)) {
    if (!process.env.USERS_FILE_PATH) {
      const rootPath = path.resolve(__dirname, '../../users.json');
      if (fs.existsSync(rootPath)) {
        try {
          const raw = fs.readFileSync(rootPath, 'utf8');
          return raw.trim() ? JSON.parse(raw) : [];
        } catch (err) {
          return [];
        }
      }
    }
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`[AuthService] Error reading users file (${filePath}):`, err.message);
    return [];
  }
}

/**
 * Persists the users array to users.json with 2-space indentation.
 * Synchronizes to both data/users.json and users.json for maximum compatibility.
 */
function saveUsers(users) {
  const primaryPath = getUsersFilePath();
  const dir = path.dirname(primaryPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const jsonStr = JSON.stringify(users, null, 2) + '\n';
  fs.writeFileSync(primaryPath, jsonStr, 'utf8');

  // Only mirror if USERS_FILE_PATH was not explicitly custom configured
  if (!process.env.USERS_FILE_PATH) {
    try {
      const rootPath = path.resolve(__dirname, '../../users.json');
      const dataPath = path.resolve(__dirname, '../../data/users.json');
      if (primaryPath !== rootPath) {
        fs.writeFileSync(rootPath, jsonStr, 'utf8');
      }
      if (primaryPath !== dataPath) {
        const dataDir = path.dirname(dataPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(dataPath, jsonStr, 'utf8');
      }
    } catch (_err) {
      // Non-fatal mirror failure
    }
  }
}

/**
 * Validates user creation parameters.
 */
function validateUserInputs({ username, password, role }) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Username is required');
  }
  const cleanUsername = username.trim();
  if (cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long');
  }
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanUsername)) {
    throw new Error('Username may only contain alphanumeric characters, underscores, hyphens, and periods');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const normalizedRole = (role || '').trim().toLowerCase();
  if (!['admin', 'viewer'].includes(normalizedRole)) {
    throw new Error("Role must be either 'admin' or 'viewer'");
  }

  return { cleanUsername, normalizedRole };
}

/**
 * Creates a new user, hashes password with bcrypt, and stores in users.json.
 * Rejects duplicate usernames. Never stores or logs plaintext password.
 */
async function createUser({ username, password, role }) {
  const { cleanUsername, normalizedRole } = validateUserInputs({ username, password, role });

  const users = getUsers();

  const exists = users.some(
    (u) => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (exists) {
    throw new Error(`Username "${cleanUsername}" already exists`);
  }

  // Generate one-way bcrypt hash with cost factor 12
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Compute next ID
  const nextId = users.length > 0
    ? Math.max(...users.map((u) => (typeof u.id === 'number' ? u.id : 0))) + 1
    : 1;

  const newUser = {
    id: nextId,
    username: cleanUsername,
    passwordHash,
    role: normalizedRole,
  };

  users.push(newUser);
  saveUsers(users);

  return {
    id: newUser.id,
    username: newUser.username,
    role: newUser.role,
  };
}

/**
 * Resets a user's password using bcrypt.
 * Replaces only the passwordHash, preserving ID and role.
 */
async function resetPassword({ username, newPassword }) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new Error('Username is required');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  const cleanUsername = username.trim().toLowerCase();
  const users = getUsers();

  const userIndex = users.findIndex(u => u.username && u.username.toLowerCase() === cleanUsername);
  if (userIndex === -1) {
    throw new Error(`User "${username}" does not exist`);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  users[userIndex].passwordHash = passwordHash;
  saveUsers(users);

  return {
    id: users[userIndex].id,
    username: users[userIndex].username,
    role: users[userIndex].role
  };
}

/**
 * Verifies credentials using bcrypt.compare.
 * Returns sanitized user object if valid, null otherwise.
 */
async function verifyCredentials(username, plaintextPassword) {
  if (!username || !plaintextPassword) return null;

  const users = getUsers();
  const cleanUsername = String(username).trim().toLowerCase();
  const user = users.find((u) => u.username && u.username.toLowerCase() === cleanUsername);

  if (!user || !user.passwordHash) {
    // Timing attack mitigation: run dummy compare
    await bcrypt.compare(plaintextPassword, '$2b$12$e80yqH7wG2l02v9d4xI/3OD3b/x1xN09oY2gK4Oa6d5m6V8q5G8S.');
    return null;
  }

  const matches = await bcrypt.compare(plaintextPassword, user.passwordHash);
  if (!matches) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

/**
 * Generates signed JWT for an authenticated user.
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JWT token and returns decoded payload.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  getUsers,
  saveUsers,
  getUsersFilePath,
  createUser,
  resetPassword,
  verifyCredentials,
  generateToken,
  verifyToken,
  validateUserInputs,
  SALT_ROUNDS,
};
