require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const statusRouter = require('./routes/status');
const authRouter = require('./routes/auth');
const knowledgeRouter = require('./routes/knowledge');
const mysql = require('./lib/mysql');
const { initKnowledgeCollection } = require('./lib/knowledge');

const app = express();
const port = process.env.PORT || 3000;
const allowStartWithoutMysql = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ALLOW_START_WITHOUT_MYSQL || '').trim().toLowerCase(),
);
let mysqlReady = false;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'client', 'pages')));
app.use('/lib', express.static(path.join(__dirname, '..', 'lib')));
app.use(express.json({ limit: '1mb' }));

if (typeof statusRouter === 'function') {
  app.get('/api/status', statusRouter);
} else {
  app.use('/api/status', statusRouter);
}

app.use('/api/auth', (req, res, next) => {
  if (mysqlReady) return next();
  return res.status(503).json({ error: 'auth is unavailable: mysql is not connected' });
});
app.use('/api/auth', authRouter);
app.use('/api/knowledge', knowledgeRouter);

app.use((err, req, res, next) => {
  void req;
  void next;
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

(async () => {
  try {
    try {
      await mysql.connect();
      await mysql.initSchema();
      mysqlReady = true;
      console.log(`MySQL connected: ${process.env.MYSQL_DATABASE || 'necropunk'} (users only)`);
    } catch (dbError) {
      if (!allowStartWithoutMysql) {
        throw dbError;
      }
      mysqlReady = false;
      console.warn('MySQL unavailable, starting in limited mode (knowledge + static only).');
      console.warn(dbError && dbError.message ? dbError.message : dbError);
    }

    const initResult = await initKnowledgeCollection();
    console.log(`Knowledge loaded from JSON: ${initResult.count} item(s)`);

    const server = app.listen(port, () => {
      console.log(`Server started: http://localhost:${port}`);
    });

    process.on('SIGINT', () => {
      server.close(async () => {
        console.log('Server stopped');
        try {
          await mysql.close();
        } catch (e) {
          console.error('MySQL close error', e);
        }
        process.exit(0);
      });
    });
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();
