#!/usr/bin/env node

console.log('=== PRUEBA DE CLI ARGUMENTS ===\n');

// Simular argumentos CLI
process.argv = [
  'node',
  'test-cli.js',
  '--token=glpat-test-token-123',
  '--api-url=https://gitlab.com/api/v4',
  '--read-only=true'
];

console.log('Argumentos simulados:', process.argv.slice(2));

// Parse CLI arguments (mismo código del index.ts)
const args = process.argv.slice(2);
const cliArgs = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    if (value) {
      cliArgs[key] = value;
    } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      cliArgs[key] = args[++i];
    }
  }
}

// Helper function
function getConfig(cliKey, envKey, defaultValue) {
  return cliArgs[cliKey] || process.env[envKey] || defaultValue;
}

// Probar configuración
console.log('\n=== RESULTADOS ===');
console.log('CLI Args parsed:', cliArgs);
console.log('Token:', getConfig('token', 'GITLAB_PERSONAL_ACCESS_TOKEN'));
console.log('API URL:', getConfig('api-url', 'GITLAB_API_URL'));
console.log('Read Only:', getConfig('read-only', 'GITLAB_READ_ONLY_MODE'));

console.log('\n=== CONFIGURACIÓN CORRECTA ===');
console.log(`{
  "mcpServers": {
    "gitlab": {
      "command": "npx",
      "args": [
        "-y",
        "@alfonsodg/mcp-gitlab",
        "--token=TU_GITLAB_TOKEN",
        "--api-url=https://gitlab.com/api/v4"
      ],
      "tools": ["*"]
    }
  }
}`);
