export function requireRole(role) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (req.user.role !== role) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
