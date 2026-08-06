function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
}

module.exports = { requireAuth };
