const jwt = require('jsonwebtoken');
const JWT_SECRET = 'VAN_SON_LIBRARY_SECURE_KEY_2026';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Bạn chưa đăng nhập!' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ!' });
    req.user = decoded;
    next();
  });
}

function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Truy cập bị từ chối! Yêu cầu quyền Quản trị viên.' });
    }
    next();
  });
}

module.exports = { JWT_SECRET, verifyToken, verifyAdmin };
