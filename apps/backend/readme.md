# Basket Bot Backend

Next.js backend with JSON API and admin portal for the Basket Bot shopping list system.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT access tokens + refresh tokens
- **Validation**: Zod schemas (from `@basket-bot/core`)
- **Admin UI**: Mantine components
- **Deployment**: Raspberry Pi with systemd

## Prerequisites

Before installing, ensure you have:

- **Node.js v18 or higher** installed
- **npm** (comes with Node.js) for installing pnpm
- **Git** for cloning the repository
- **Raspberry Pi** running Raspbian (recommended) or any Linux system
- **Admin/sudo access** for systemd service setup

## Quick Start (Raspberry Pi Production)

### 1. Clone the Repository

```bash
git clone <repository-url> basket-bot
cd basket-bot
```

### 2. Run the Installation Script

The installation script handles everything: dependencies, building, database setup, and systemd service configuration.

```bash
chmod +x apps/backend/scripts/install.sh
sudo apps/backend/scripts/install.sh
```

The script will:

- Install pnpm if not present
- Install all dependencies
- Build the core package and backend
- Create `.env` file with a secure JWT secret
- Pause for you to configure admin credentials
- Initialize the SQLite database
- Create and start a systemd service
- Configure automatic startup on boot

### 3. Configure Admin Credentials

When prompted, edit `apps/backend/.env` and update:

```env
ADMIN_EMAIL="your-email@example.com"
ADMIN_NAME="Your Name"
ADMIN_PASSWORD="a-secure-password"
```

Then press Enter to continue the installation.

### 4. Verify Installation

The script will start the service automatically. Verify it's running:

```bash
sudo systemctl status basket-bot-backend
```

Access the application:

- **API**: `http://localhost:3000/api`
- **Admin Portal**: `http://localhost:3000/admin`

## Manual Installation (Development)

For local development without systemd:

### 1. Install Dependencies

From the project root:

```bash
pnpm install
```

### 2. Build Core Package

The backend depends on `@basket-bot/core`:

```bash
pnpm --filter @basket-bot/core build
```

### 3. Set Up Environment

```bash
cd apps/backend
cp .env.example .env
```

Edit `.env` and configure:

- `DATABASE_URL` (default: `file:./dev.db`)
- `JWT_SECRET` (generate with `openssl rand -base64 32`)
- `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`

### 4. Initialize Database

```bash
pnpm db:init
```

This creates the SQLite database and seeds initial data.

### 5. Run Development Server

```bash
pnpm dev
```

The backend will be available at `http://localhost:3000` (or the PORT in your `.env`).

## Project Structure

```
apps/backend/
├── src/
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── households/   # Household management
│   │   │   ├── stores/       # Store management
│   │   │   └── ...
│   │   ├── admin/            # Admin portal pages (Mantine UI)
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── lib/
│   │   ├── auth/             # JWT & password utilities
│   │   ├── db/               # Database connection
│   │   ├── repos/            # Database repositories
│   │   └── services/         # Business logic
│   ├── db/
│   │   └── init.ts           # Database schema
│   └── middleware.ts         # Next.js middleware
├── db/
│   └── seed.ts               # Database seeding script
├── scripts/
│   └── install.sh            # Production installation script
├── .env.example              # Environment template
└── package.json
```

## Environment Variables

See [.env.example](.env.example) for all available options.

**Required:**

- `DATABASE_URL` - SQLite database path (e.g., `file:./production.db`)
- `JWT_SECRET` - Secret key for signing JWTs (use `openssl rand -base64 32`)
- `ADMIN_EMAIL` - Bootstrap admin user email
- `ADMIN_PASSWORD` - Bootstrap admin user password

**Optional:**

- `JWT_ISSUER` - JWT issuer claim (default: `basket-bot`)
- `JWT_AUDIENCE` - JWT audience claim (default: `basket-bot-api`)
- `ACCESS_TOKEN_TTL_SECONDS` - Access token lifetime (default: 900 = 15 minutes)
- `REFRESH_TOKEN_TTL_SECONDS` - Refresh token lifetime (default: 2592000 = 30 days)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (`development` or `production`)
- `REGISTRATION_INVITATION_CODE` - Require invitation code for new registrations (leave empty for open registration)

### Registration Restriction

To restrict signups during initial rollout:

1. Set `REGISTRATION_INVITATION_CODE` in `.env` to your chosen code (e.g., `"beta2026"`)
2. Share this code with invited users
3. Users will see an invitation code field during registration
4. Registration will fail if the code is missing or incorrect

To allow open registration:

- Leave `REGISTRATION_INVITATION_CODE` empty or unset in `.env`
- The invitation code field will not appear in the registration form
- Anyone can register without a code

**Note:** The invitation code is case-insensitive and whitespace is trimmed.

## Database Management

### Initialize/Reset Database

```bash
pnpm db:init
```

This drops and recreates the database with the schema and seed data.

**⚠️ Warning**: This destroys all existing data. Only use in development or initial setup.

### Database Location

- Development: `apps/backend/dev.db`
- Production: `apps/backend/production.db` (or as configured in `.env`)

### Schema

The database schema is defined in [src/db/init.ts](src/db/init.ts) and includes:

- Users and authentication
- Households and membership
- Stores, aisles, sections, and items
- Shopping lists
- Refresh tokens

## Systemd Service Management

After running the install script, the backend runs as a systemd service.

### Service Commands

```bash
# Check status
sudo systemctl status basket-bot-backend

# Start service
sudo systemctl start basket-bot-backend

# Stop service
sudo systemctl stop basket-bot-backend

# Restart service
sudo systemctl restart basket-bot-backend

# View logs (live)
sudo journalctl -u basket-bot-backend -f

# View logs (last 100 lines)
sudo journalctl -u basket-bot-backend -n 100

# Disable auto-start on boot
sudo systemctl disable basket-bot-backend

# Re-enable auto-start on boot
sudo systemctl enable basket-bot-backend
```

### Updating the Application

To update the backend after pulling new code:

```bash
cd /path/to/basket-bot
git pull
pnpm install
pnpm --filter @basket-bot/core build
cd apps/backend
pnpm build
sudo systemctl restart basket-bot-backend
```

If database schema changed, you may need to reinitialize:

```bash
pnpm db:init
sudo systemctl restart basket-bot-backend
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns access + refresh tokens)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token
- `GET /api/auth/me` - Get current user info

### Resource Endpoints

All resource endpoints require `Authorization: Bearer <access-token>` header.

- `/api/households/*` - Household management
- `/api/stores/*` - Store management
- `/api/store-aisles/*` - Store aisle management
- `/api/store-sections/*` - Store section management
- `/api/store-items/*` - Store item management
- `/api/shopping-lists/*` - Shopping list management

See API source code in [src/app/api/](src/app/api/) for detailed endpoint documentation.

## Admin Portal

Access the admin portal at `http://localhost:3000/admin` (or your configured port).

**Login**: Use the admin credentials from your `.env` file.

**Features**:

- User management (view, edit, delete users)
- Household overview
- Store management
- Database inspection

**Tech**: Built with Mantine UI components and SCSS styling.

## Development

### Run Development Server

```bash
pnpm dev
```

This starts Next.js in development mode with hot-reload at `http://localhost:3000`.

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Build for Production

```bash
pnpm build
```

Outputs to `.next/` directory. Run production build with:

```bash
pnpm start
```

## Troubleshooting

### Service won't start

Check logs for errors:

```bash
sudo journalctl -u basket-bot-backend -n 100
```

Common issues:

- Missing or invalid `.env` file
- Database file permissions
- Port already in use
- Missing dependencies (run `pnpm install` in project root)

### Database errors

Reinitialize the database:

```bash
cd apps/backend
pnpm db:init
sudo systemctl restart basket-bot-backend
```

### Permission denied errors

Ensure the admin user has read/write access to:

- Project directory
- Database file
- `.next/` build directory

Fix with:

```bash
sudo chown -R admin:admin /path/to/basket-bot
```

### Port conflicts

If port 3000 is in use, edit `.env`:

```env
PORT=8080
```

Then restart:

```bash
sudo systemctl restart basket-bot-backend
```

## Testing from Remote Machines

To test the backend API from another device on your local network:

### 1. Find Your Server's IP Address

On the Raspberry Pi (or server), run:

```bash
hostname -I
```

Or:

```bash
ip addr show | grep inet
```

Example output: `192.168.1.100`

### 2. Ensure the Server is Listening on All Interfaces

By default, Next.js binds to `0.0.0.0` in production, which allows external connections. Verify in your `.env`:

```env
# No need to set HOSTNAME - defaults to 0.0.0.0 in production
PORT=3000
```

### 3. Test with curl from Remote Machine

Replace `192.168.1.100` with your server's actual IP address.

**Health Check:**

```bash
curl http://192.168.1.100:3000/api/health
```

**Register a User:**

```bash
curl -X POST http://192.168.1.100:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "SecurePassword123!"
  }'
```

**Login:**

```bash
curl -X POST http://192.168.1.100:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

Save the returned `accessToken` for authenticated requests.

**Authenticated Request (Get Current User):**

```bash
curl http://192.168.1.100:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**List Stores:**

```bash
curl http://192.168.1.100:3000/api/stores \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### 4. Firewall Configuration (if needed)

If you can't reach the server from another device, you may need to allow incoming connections on port 3000:

**On Raspberry Pi (using ufw):**

```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

**On Raspberry Pi (using iptables):**

```bash
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables-save
```

### 5. Mobile App Configuration

To connect the mobile app to your Raspberry Pi backend:

1. Find your server's local IP address (e.g., `192.168.1.100`)
2. Update the API base URL in the mobile app configuration
3. Ensure both devices are on the same local network
4. Test connectivity with curl first (as shown above)

**Note:** For production deployments outside your local network, use a proper domain name, HTTPS, and consider security implications (firewall rules, rate limiting, etc.).

## Architecture Notes

- **Auth**: JWT access tokens (15 min) + refresh tokens (30 days, stored server-side)
- **DB**: SQLite with prepared statements via better-sqlite3
- **Validation**: All API requests/responses validated with Zod schemas from `@basket-bot/core`
- **Authorization**: Household/store membership enforced in service layer
- **Admin**: Requires `admin` scope in JWT claims

## Related Documentation

- [../../README.md](../../README.md) - Main project README
- [../../SETUP.md](../../SETUP.md) - Overall setup guide
- [.env.example](.env.example) - Environment variable reference

## License

Private project - all rights reserved.
