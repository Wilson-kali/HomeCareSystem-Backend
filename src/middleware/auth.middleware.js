const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(decoded.userId, {
      include: [{ model: require('../models').Role }]
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    // Add role name to user object for easier access
    req.user = {
      ...user.toJSON(),
      role: user.Role?.name
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateToken };