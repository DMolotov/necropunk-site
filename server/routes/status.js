module.exports = (req, res) => {
  return res.json({
    message: 'Service is running',
    uptime: process.uptime(),
  });
};