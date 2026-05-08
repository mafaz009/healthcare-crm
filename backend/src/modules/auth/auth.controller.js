const authService = require('./auth.service');
const { ok, error } = require('../../utils/response');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return ok(res, result, 'Login successful');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    return ok(res, user);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, oldPassword, newPassword);
    return ok(res, {}, 'Password changed successfully');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    return ok(res, user, 'Profile updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

// JWT is stateless — logout is handled client-side by deleting the token.
// This endpoint exists so the frontend can call it explicitly and get a clean 200.
const logout = (_req, res) => ok(res, {}, 'Logged out successfully');

module.exports = { login, getMe, changePassword, updateProfile, logout };
