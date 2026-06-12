import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'project_atlas_erp_secret_key';

// JWT Verification Middleware
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Token format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '인증 토큰이 누락되었습니다.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      role: decoded.role,
      email: decoded.email
    };
    next();
  } catch (error) {
    return res.status(403).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
  }
};

// Role-based Authorization Middleware
// roles: array of roles allowed to access the route, e.g. ['admin', 'manager']
export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `권한이 부족합니다. 필요한 역할: [${roles.join(', ')}], 내 역할: [${req.user.role}]` 
      });
    }

    next();
  };
};
