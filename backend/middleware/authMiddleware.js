const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access denied');

  try {
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    console.log('JWT_SECRET:', process.env.JWT_SECRET); // Debug log
    const verified = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    res.status(401).json({ error: 'Invalid token', details: err.message });
  }
};