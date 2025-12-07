import express from 'express';

const app = express();
const router = express.Router();

app.use('/api/v4', router);

router.use((req, res, next) => {
  console.log(`[Router] Incoming: ${req.method} ${req.url}`);
  next();
});

router.get('/projects/1', (req, res) => {
  console.log('Hit /projects/1');
  res.send('projects 1');
});

router.get('/projects/1/issues', (req, res) => {
  console.log('Hit /projects/1/issues');
  res.send('projects 1 issues');
});

// Simulate request
const req1 = { method: 'GET', url: '/api/v4/projects/1' };
const req2 = { method: 'GET', url: '/api/v4/projects/1/issues' };

import http from 'http';

const server = app.listen(9999, () => {
  console.log('Server started on 9999');
  
  fetch('http://localhost:9999/api/v4/projects/1')
    .then(r => r.text())
    .then(t => console.log('Response 1:', t))
    .then(() => fetch('http://localhost:9999/api/v4/projects/1/issues'))
    .then(r => r.text())
    .then(t => console.log('Response 2:', t))
    .then(() => server.close());
});