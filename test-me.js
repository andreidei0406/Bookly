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
  let cookie = res.headers['set-cookie'];
  
  const req2 = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: {
      'Cookie': cookie ? cookie.join(';') : ''
    }
  }, (res2) => {
    let data = '';
    res2.on('data', d => data += d);
    res2.on('end', () => console.log('Me:', data));
  });
  req2.end();
});

req.write(JSON.stringify({ email: 'admin@bookly.com', password: 'Admin1234!' }));
req.end();
