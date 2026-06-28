const schedules = require('./schedules.js');
const test = require('./test.js');

module.exports = (req, res) => {
  const { url } = req;

  if (url.startsWith('/api/schedules')) {
    return schedules(req, res);
  }

  if (url.startsWith('/api/test')) {
    return test(req, res);
  }

  res.status(404).send('Not Found');
};