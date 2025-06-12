// Test script to verify the authentication cookie functionality

// Import required modules
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.aws.dev/api/v4';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || '';
const AUTH_COOKIE_PATH = process.env.AUTH_COOKIE_PATH || '~/.midway/cookie';

// Expand tilde in path
const expandTilde = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }
  
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME, filePath.slice(2));
  }
  
  return filePath;
};

// Read authentication cookie file
function readAuthCookie() {
  try {
    const cookiePath = expandTilde(AUTH_COOKIE_PATH);
    if (!fs.existsSync(cookiePath)) {
      console.error(`Authentication cookie file not found at ${cookiePath}`);
      return null;
    }
    
    const cookieContent = fs.readFileSync(cookiePath, 'utf8');
    const cookies = cookieContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const parts = line.split('\t');
        if (parts.length >= 7) {
          return `${parts[5]}=${parts[6]}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');
    
    return cookies;
  } catch (error) {
    console.error('Error reading authentication cookie:', error);
    return null;
  }
}

// Make a request to GitLab API
async function makeGitLabRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${GITLAB_API_URL}${endpoint}`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if token is provided
    if (GITLAB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITLAB_TOKEN}`;
    }
    
    // Add authentication cookie if available
    const authCookie = readAuthCookie();
    if (authCookie) {
      headers['Cookie'] = authCookie;
      console.log('Using authentication cookie for authentication');
    } else {
      console.log('No authentication cookie available');
    }
    
    const requestOptions = {
      method: options.method || 'GET',
      headers,
      ...options,
    };
    
    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: jsonData });
          } catch (error) {
            resolve({ statusCode: res.statusCode, data });
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test functions
async function testListProjects() {
  try {
    console.log('Testing list projects endpoint...');
    const response = await makeGitLabRequest('/projects?simple=true&per_page=5');
    console.log(`Status: ${response.statusCode}`);
    console.log('Projects:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error listing projects:', error.message);
  }
}

async function testGetUser() {
  try {
    console.log('Testing get user endpoint...');
    const response = await makeGitLabRequest('/user');
    console.log(`Status: ${response.statusCode}`);
    console.log('User:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error getting user:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('Starting GitLab API tests with authentication cookie support');
  console.log(`Using GitLab API URL: ${GITLAB_API_URL}`);
  console.log(`Using authentication cookie path: ${AUTH_COOKIE_PATH}`);
  
  await testGetUser();
  await testListProjects();
}

runTests();
