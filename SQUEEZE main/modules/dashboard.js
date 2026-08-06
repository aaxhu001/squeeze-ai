/**
 * SQUEEZE AI - Local Analytics Web Dashboard Server
 * 
 * Runs a lightweight local web server on port 3000 providing real-time telemetry,
 * stats analytics, memory cache lookups, and raw vs compressed trace comparisons.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const { loadStats } = require('./stats-recorder.js');
const { globalMemory } = require('./memory.js');

class SqueezeDashboardServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.server = null;
    this.publicDir = path.join(__dirname, '../../dashboard/public');
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);
        const pathname = parsedUrl.pathname;

        // API Endpoints
        if (pathname === '/api/stats') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(loadStats()));
          return;
        }

        if (pathname === '/api/memory') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(globalMemory.cache));
          return;
        }

        if (pathname === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            port: this.port,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // Static Files Serving
        let filePath = path.join(this.publicDir, pathname === '/' ? 'index.html' : pathname);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(this.publicDir, 'index.html');
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }

          let contentType = 'text/html';
          if (filePath.endsWith('.css')) contentType = 'text/css';
          if (filePath.endsWith('.js')) contentType = 'text/javascript';
          if (filePath.endsWith('.json')) contentType = 'application/json';
          if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[SQUEEZE Dashboard] Port ${this.port} is in use.`);
        }
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`\n====================================================`);
        console.log(`⚡ SQUEEZE AI Local Analytics Web Dashboard`);
        console.log(`====================================================`);
        console.log(`🌐 Server active on: http://localhost:${this.port}`);
        console.log(`====================================================\n`);
        resolve(this.server);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  openInBrowser() {
    const url = `http://localhost:${this.port}`;
    let command;

    switch (process.platform) {
      case 'win32':
        command = `start "" "${url}"`;
        break;
      case 'darwin':
        command = `open "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
        break;
    }

    exec(command, (error) => {
      if (error) {
        console.log(`[SQUEEZE Dashboard] Note: Open ${url} in your browser.`);
      } else {
        console.log(`🚀 Dashboard launched automatically in browser.`);
      }
    });
  }
}

module.exports = SqueezeDashboardServer;
