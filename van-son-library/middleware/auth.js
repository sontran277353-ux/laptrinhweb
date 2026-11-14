const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const configuredSecret = process.env.JWT_SECRET;
if (!configuredSecret && process.env.NODE_ENV === 'production') {
  throw new Error('Thiếu JWT_SECRET. Hãy cấu hình biến môi trường trước khi chạy server.');
}
const JWT_SECRET = configuredSecret || crypto.randomBytes(32).toString('hex');
if (!configuredSecret) {
  console.warn('Đang dùng JWT_SECRET tạm thời cho môi trường phát triển.');
}

function verifyToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Bạn chưa đăng nhập!' });
  }

  jwt.verify(token, JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ!' });
    }
    req.user = decoded;
    return next();
  });
}

function verifyAdmin(req, res, next) {
  return verifyToken(req, res, () => {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Truy cập bị từ chối! Yêu cầu quyền Quản trị viên.' });
    }
    return next();
  });
}

module.exports = { JWT_SECRET, verifyToken, verifyAdmin };
