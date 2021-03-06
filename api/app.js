var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var ledsRouter = require('./routes/leds');
var pingRouter = require('./routes/ping');
var drivesRouter = require('./routes/drives');
var supervisorRouter = require('./routes/supervisor');
var networkRouter = require('./routes/network');
var expectsRouter = require('./routes/expects');
var historyRouter = require('./routes/history');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', indexRouter);
app.use('/api/leds', ledsRouter);
app.use('/api/ping', pingRouter);
app.use('/api/drives', drivesRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/network', networkRouter);
app.use('/api/expects', expectsRouter);
app.use('/api/history', historyRouter);

// docs
app.get('/api-docs', (req, res) => {
  let yaml = req.query['yml']
  res.sendFile(path.resolve(__dirname, `swagger.${yaml ? 'yml' : 'json'}`));
});

// serve the UI
app.use(express.static(path.resolve(__dirname, '../../ui/build'))); // relative to dist
app.get('*', (_, res) => {
  res.sendFile(path.resolve(__dirname, '../../ui/build', 'index.html'));
});
module.exports = app;
