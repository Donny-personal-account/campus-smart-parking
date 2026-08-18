// API 代理云函数 - 所有请求通过云函数转发到后端
const http = require('http');
const querystring = require('querystring');

const BACKEND_HOST = '49.235.146.233';
const BACKEND_PORT = 8080;

exports.main = async (event, context) => {
  const { path, method = 'GET', data = {}, headers = {}, fileBase64, fileName } = event;

  try {
    const isGet = method.toUpperCase() === 'GET';
    
    // 构建请求选项
    let requestPath = `/api${path}`;
    let postData = null;
    
    if (isGet && Object.keys(data).length > 0) {
      requestPath += '?' + querystring.stringify(data);
    }

    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: requestPath,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': context.WX_CLIENTIP || '',
        ...headers
      },
      timeout: 20000
    };

    // 如果有文件上传(base64), 构造multipart
    if (fileBase64 && fileName) {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      const ext = fileName.split('.').pop() || 'jpg';
      
      const parts = [];
      parts.push(Buffer.from(`--${boundary}\r\n`));
      parts.push(Buffer.from(`Content-Disposition: form-data; name="avatar"; filename="avatar.${ext}"\r\n`));
      parts.push(Buffer.from(`Content-Type: image/${ext === 'png' ? 'png' : 'jpeg'}\r\n\r\n`));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      
      const body = Buffer.concat(parts);
      postData = body;
      options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      options.headers['Content-Length'] = body.length;
    } else if (!isGet) {
      postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: json });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: body });
          }
        });
      });
      req.on('error', e => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (postData) req.write(postData);
      req.end();
    });

    return {
      success: true,
      statusCode: result.statusCode,
      data: result.data
    };
  } catch (error) {
    console.error('API代理错误:', error.message);
    return {
      success: false,
      statusCode: 500,
      error: error.message || '代理请求失败',
      data: null
    };
  }
};
