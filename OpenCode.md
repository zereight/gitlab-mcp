# OpenCode Configuration

## Build/Test Commands

- `npm run build` - Compile TypeScript to build/
- `npm run dev` - Build and run the server
- `npm run watch` - Watch mode compilation
- `npm test` - Run API validation tests
- `npm run test:integration` - Run integration tests
- `npm run test:server` - Build and test all transport servers
- `npm run lint` - ESLint check
- `npm run lint:fix` - ESLint auto-fix
- `npm run format` - Prettier format all files
- `npm run format:check` - Check formatting

## Code Style Guidelines

- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (type: "module" in package.json)
- **Imports**: Use .js extensions for local imports, named imports preferred
- **Types**: Explicit typing with Zod schemas, avoid `any` types
- **Naming**: camelCase for variables/functions, PascalCase for types/schemas
- **Error Handling**: Use structured error responses with proper HTTP status codes
- **Logging**: Use pino logger with structured logging
- **Schemas**: Define Zod schemas for all API inputs/outputs, export both type and schema
- **File Structure**: Separate schemas in schemas.ts, custom utilities in customSchemas.ts
