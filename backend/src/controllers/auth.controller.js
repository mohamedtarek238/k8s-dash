const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

async function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Username and password are required',
    });
  }

  const user = await authService.verifyCredentials(username, password);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid username or password',
    });
  }

  const token = authService.generateToken(user);

  return sendSuccess(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}

async function me(req, res) {
  return sendSuccess(res, {
    user: req.user,
  });
}

module.exports = {
  login,
  me,
};
