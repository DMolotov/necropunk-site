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
    await mysql.connect();
    await mysql.initSchema();
    console.log(`MySQL connected: ${process.env.MYSQL_DATABASE || 'necropunk'} (users only)`);

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
