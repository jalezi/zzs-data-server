# zzs-data-server

A Node.js server for handling and processing `.tsv.gz` and `.csv.gz` files, built with TypeScript and modern best practices.

## Features

- **API Versioning**: Support for multiple API versions (`v1`, `v2`, etc.).
- **Environment Validation**: Uses `zod` to validate and manage environment variables.
- **Rate Limiting**: Protects the API from abuse using `express-rate-limit`.
- **Logging**: High-performance logging with `pino` and `pino-http` for HTTP request/response logging.
- **File Parsing**: Processes `.tsv.gz` and `.csv.gz` files using `csv-parse`.
- **Security**: Secures endpoints with `helmet` and CORS policies.
- **API Key Authentication**: Supports API key-based authentication for external access.
- **Testing**: Integrated testing with Jest and Node.js Test Runner.
- **Biome**: Ensures consistent code formatting and linting.
- **Lefthook**: Manages Git hooks for pre-commit checks.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/zzs-data-server.git
   cd zzs-data-server
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create an `.env` file in the root directory:
   ```env
   PORT=3000
   API_KEYS=example-key-1,example-key-2
   API_KEYS_REQUIRED=true
   NODE_ENV=development
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```

4. Build the project:
   ```bash
   pnpm build
   ```

5. Start the server:
   ```bash
   pnpm start
   ```

---

## Development

For local development:

1. Start the server in development mode:
   ```bash
   pnpm dev
   ```

2. Format and lint the code using Biome:
   - Check for issues:
     ```bash
     pnpm lint:check
     ```
   - Fix issues:
     ```bash
     pnpm lint:fix
     ```

3. Set up Lefthook for Git hooks:
   ```bash
   pnpm lefthook install
   ```

4. Run pre-commit hooks manually:
   ```bash
   pnpm lefthook run pre-commit
   ```

---

## API Endpoints

### **Base URL:** `/api`

#### **Versioned Endpoints**
- **GET `/api/v1/data`**: Fetches data using version 1 features.

#### **Catch-All Route**
Returns a `404` response for undefined endpoints.

---

## File Parsing

The server processes `.tsv.gz` and `.csv.gz` files stored in the `database` directory. Example configuration:

```typescript
type DataFile = {
  id: string;
  path: `./database/${string}.tsv.gz` | `./database/${string}.csv.gz`;
  format: 'tsv' | 'csv';
};

export const dataFiles = [
  { id: 'users', path: './database/users.tsv.gz', format: 'tsv' },
  { id: 'products', path: './database/products.csv.gz', format: 'csv' },
];
```

Files are parsed using `csv-parse`.

---

## Environment Validation

Environment variables are validated using `zod`. Example validation schema:

```typescript
const envSchema = z.object({
  PORT: z.string().default('3000'),
  API_KEYS: z.string(),
  API_KEYS_REQUIRED: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX: z.string().default('100'),
});
```

If validation fails, the server logs the issues and exits.

---

## Security

- **Helmet**: Secures HTTP headers.
- **CORS**: Configurable cross-origin resource sharing.
- **Rate Limiting**: Protects against abuse with a 15-minute window for 100 requests per IP.

---

## Testing

Naming convention: `*.jest-test.*` for Jest tests and `*.node-test.*` for Node.js Test Runner tests.

1. Run all tests:
   ```bash
   pnpm test
   ```

2. Run Jest tests:
   ```bash
   pnpm test:jest
   ```

3. Run Node.js Test Runner:
   ```bash
   pnpm test:node
   ```

4. View code coverage:
   ```bash
   pnpm test:coverage
   ```

---

## Deployment

1. **Build the project**:
   ```bash
   pnpm build
   ```

2. Use Docker (optional):
   - Build the Docker image:
     ```bash
     docker build -t zzs-data-server .
     ```
   - Run the container:
     ```bash
     docker run -p 3000:3000 zzs-data-server
     ```

3. Or deploy to a platform like Netlify (future).

---

## Logging

- Uses `pino` and `pino-http` for structured logging.
- Development mode uses `pino-pretty` for readable logs.

---

## Contribution

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push and create a pull request.

---

## License

This project is licensed under the MIT License. See `LICENSE` for more details.
