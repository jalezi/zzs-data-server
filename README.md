# zzs-data-server

A Node.js server for handling and processing `.tsv.gz` and `.csv.gz` files, built with TypeScript and modern best practices.

## Features

- **API Versioning**: Support for multiple API versions (`v1`, `v2`, etc.).
- **Environment Validation**: Uses `zod` to validate and manage environment variables.
- **Rate Limiting**: Protects the API from abuse using `express-rate-limit`.
- **Redis Caching**: Implements efficient data caching with Redis.
- **Logging**: High-performance logging with `pino` and `pino-http` for HTTP request/response logging.
- **File Parsing**: Processes `.tsv.gz` and `.csv.gz` files using `csv-parse`.
- **Security**: Secures endpoints with `helmet` and CORS policies.
- **API Key Authentication**: Supports API key-based authentication for external access.
- **Testing**: Integrated testing with Jest and Node.js Test Runner.
- **Biome**: Ensures consistent code formatting and linting.
- **Lefthook**: Manages Git hooks for pre-commit checks.

---

## Quick Start

1. Clone and install:
   ```bash
   git clone https://github.com/your-username/zzs-data-server.git
   cd zzs-data-server
   pnpm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your settings:
   ```env
   PORT=3000
   API_KEYS=your-secret-key-1,your-secret-key-2
   API_KEYS_REQUIRED=true
   NODE_ENV=development
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   LOG_LEVEL=info
   REDIS_URL=redis://localhost:6379
   REDIS_TTL=3600
   ```

3. Start development:
   ```bash
   pnpm dev
   ```

---

## Development Guide

### Prerequisites
- Node.js 18+
- pnpm 8+
- Git

### Code Quality Tools
- **Biome**: `pnpm lint:check` and `pnpm lint:fix`
- **Lefthook**: `pnpm lefthook install`
- **Tests**: `pnpm test`

---

## API Reference

### Authentication
All endpoints require an API key header:
```http
X-API-Key: your-secret-key
```

### Endpoints

#### GET /api/v1/data
Fetches processed data from the server.

**Query Parameters:**
- `format` (optional): Response format ('json' | 'csv')
- `filter` (optional): Filter criteria

**Response:**
```json
{
  "data": [...],
  "meta": {
    "count": 100,
    "timestamp": "2024-01-20T12:00:00Z"
  }
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| API_KEYS | Comma-separated API keys | (required) |
| NODE_ENV | Environment mode | development |
| LOG_LEVEL | Logging level | info |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| REDIS_TTL | Cache TTL in seconds | 3600 |

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

## Docker Support

```dockerfile
# Example docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./database:/app/database
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Logging

- Uses `pino` and `pino-http` for structured logging.
- Development mode uses `pino-pretty` for readable logs.

---

## Caching

The server uses Redis for caching responses:

- **Default TTL**: 1 hour (configurable via `REDIS_TTL`)
- **Cache Keys**: Based on request path and query parameters
- **Manual Invalidation**: Available through admin endpoints
- **Health Check**: Redis connection status monitored

### Cache Management

1. Clear specific cache:
   ```bash
   curl -X DELETE "/api/v1/cache/:key" -H "X-API-Key: your-secret-key"
   ```

2. Clear all cache:
   ```bash
   curl -X DELETE "/api/v1/cache" -H "X-API-Key: your-secret-key"
   ```

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
