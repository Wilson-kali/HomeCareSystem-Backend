const crypto = require('crypto');

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const formatDate = (date) => {
  return new Date(date).toISOString();
};

const sanitizeUser = (user) => {
  const { password, ...userWithoutPassword } = user.toJSON ? user.toJSON() : user;
  return userWithoutPassword;
};

const paginate = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { limit: parseInt(limit), offset: parseInt(offset) };
};

module.exports = {
  generateToken,
  formatDate,
  sanitizeUser,
  paginate
};
