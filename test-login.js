import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Login:', data));
});

req.write(JSON.stringify({ email: 'admin@bookly.com', password: 'Admin1234!' }));
req.end();
