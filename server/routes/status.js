// Простая реализация обработчика статуса API
module.exports = (req, res, next) => {
  // Если это GET на корень монтируемого пути — вернём статус
  if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
    return res.json({ message: 'Мир настолок готов к работе!', uptime: process.uptime() });
  }
  // Иначе передаём дальше (на случай, если этот модуль расширится)
  return next();
};
