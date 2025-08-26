# 08-Build-Run-Test.md - Development and Build Instructions

## Prerequisites

### Required Software
- **Node.js**: Version 18+ recommended
- **npm**: Version 9+ (comes with Node.js)
- **PHP**: Version 7.4+ (for backend API)
- **Web Server**: Apache or Nginx (for production)

### System Requirements
- **OS**: macOS, Linux, or Windows
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for node_modules

## Installation Steps

### 1. Clone Repository
```bash
# If using git
git clone <repository-url>
cd strata-football-ui-new

# Or if you have the source files
cd strata-football-ui-new
```

### 2. Install Dependencies
```bash
npm install
```

**Dependencies Installed**:
- React 18.2.0
- React Router DOM 7.8.1
- PropTypes
- TailwindCSS 3.3.3
- Vite 4.4.5
- PostCSS and Autoprefixer

### 3. Verify Installation
```bash
# Check Node.js version
node --version  # Should be 18+

# Check npm version
npm --version   # Should be 9+

# Verify package.json
cat package.json
```

## Development Server

### Start Development Server
```bash
npm run dev
```

**Server Configuration**:
- **URL**: http://localhost:5173
- **Hot Reload**: Enabled
- **Proxy**: `/strata_football` requests → `http://localhost`

### Development Features
- **Fast Refresh**: React component updates without page reload
- **Error Overlay**: In-browser error display
- **Source Maps**: Original source debugging
- **Proxy Setup**: Backend API calls routed automatically

### Vite Configuration (`vite.config.js`)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/strata_football': {
        target: 'http://localhost',
        changeOrigin: true
      }
    }
  }
})
```

## Build for Production

### Production Build
```bash
npm run build
```

**Build Process**:
1. **TypeScript Checking**: Validates TypeScript files
2. **Bundling**: Creates optimized bundles
3. **Minification**: Reduces file sizes
4. **Asset Processing**: Optimizes images and fonts
5. **Output**: Generated in `dist/` directory

### Build Output Structure
```
dist/
├── index.html              # Main HTML file
├── assets/
│   ├── index-<hash>.js     # Main JavaScript bundle
│   ├── index-<hash>.css    # Main CSS bundle
│   └── vendor-<hash>.js    # Vendor dependencies
└── favicon.ico             # Site favicon
```

### Preview Production Build
```bash
npm run preview
```
- **URL**: http://localhost:4173
- **Purpose**: Test production build locally

## Environment Variables

### Available Environment Variables

#### Development Variables
```bash
# .env.development (create if needed)
VITE_DEBUG_MODE=true
VITE_API_BASE_URL=http://localhost
VITE_HEALTH_CHECK_INTERVAL=30000
```

#### Production Variables
```bash
# .env.production
VITE_DEBUG_MODE=false
VITE_API_BASE_URL=https://your-domain.com
VITE_HEALTH_CHECK_INTERVAL=60000
```

### Using Environment Variables
**In JavaScript/TypeScript**:
```javascript
// Access Vite environment variables
const isDebugMode = import.meta.env.VITE_DEBUG_MODE === 'true';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Check development mode
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;
```

### Where Variables are Used
**Location**: `src/utils/debug.js:5-15`
```javascript
const isDebugMode = () => {
  return (
    import.meta.env.DEV || 
    import.meta.env.VITE_DEBUG_MODE === 'true' ||
    window.STRATA_CONFIG?.debug === true
  );
};
```

## Build Configuration Details

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### TailwindCSS Configuration (`tailwind.config.js`)
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'field-green': '#2d5016',
        'yard-line': '#ffffff',
        'home-primary': '#003366',
        'visitor-primary': '#660000'
      }
    },
  },
  plugins: [],
}
```

### PostCSS Configuration (`postcss.config.js`)
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## Path Aliases and Import Handling

### Current Import Pattern
```javascript
// Relative imports (current pattern)
import { useGameState } from '../contexts/FootballGameContext';
import debug from '../utils/debug';

// Component imports
import PlayerName from './PlayerName';
```

### Adding Path Aliases (Optional Enhancement)
To add path aliases, modify `vite.config.js`:
```javascript
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@contexts': path.resolve(__dirname, './src/contexts')
    }
  },
  // ... rest of config
});
```

Then use:
```javascript
import { useGameState } from '@contexts/FootballGameContext';
import debug from '@utils/debug';
```

## Backend Setup Requirements

### PHP Backend Configuration
The frontend expects a PHP backend at `/strata_football/`. Ensure:

1. **Web Server Running**: Apache/Nginx serving PHP
2. **API Endpoints Available**:
   - `/strata_football/api/load_game_state.php`
   - `/strata_football/api/submit_play_enhanced.php`
   - `/strata_football/api/get_rosters.php`
   - All other endpoints (see 03-APIs-and-Endpoints.md)

3. **Database Connection**: MySQL database configured
4. **CORS Headers**: If needed for cross-origin requests

### Backend Health Check
```bash
# Test backend connectivity
curl http://localhost/strata_football/health_check.php

# Should return JSON like:
# {"status":"healthy","timestamp":"..."}
```

## Testing Infrastructure

### Current Testing Status
- **No formal test framework** (Jest/Vitest) configured
- **Manual testing**: Primary testing method
- **Custom test files**: Available in `test_files/`

### Available Test Files
1. **test_files/test-down-distance.js**: Down/distance calculation tests
2. **test_files/test_frontend_contract.mjs**: Data transformation tests

### Running Existing Tests
```bash
# Run down/distance tests
node test_files/test-down-distance.js

# Run data contract tests  
node test_files/test_frontend_contract.mjs
```

### Adding Formal Testing (Recommended)

#### Install Testing Dependencies
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

#### Add Test Scripts to package.json
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build", 
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

#### Vitest Configuration (vitest.config.js)
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
});
```

## Lint and Code Quality

### Current Status
- **No linting configured**
- **No code formatting configured**

### Adding ESLint and Prettier (Recommended)
```bash
# Install linting tools
npm install --save-dev eslint @eslint/js @typescript-eslint/eslint-plugin prettier eslint-config-prettier

# Add scripts to package.json
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix", 
"format": "prettier --write src/"
```

## Deployment

### Static File Deployment
After building, deploy the `dist/` folder to:
- **Apache**: Place in document root or virtual host directory
- **Nginx**: Serve as static files
- **CDN**: Upload to cloud storage (S3, CloudFront, etc.)

### Example Apache Configuration
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist
    
    # Handle React Router
    <Directory "/path/to/dist">
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

### Example Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if backend on same server)
    location /strata_football/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Common Issues

#### 1. Port 5173 Already in Use
```bash
# Find and kill process using port
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

#### 2. Node Version Issues
```bash
# Check Node version
node --version

# Install Node Version Manager (if needed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18
nvm install 18
nvm use 18
```

#### 3. Dependency Installation Failures
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 4. Build Failures
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Check for lint errors (if configured)
npm run lint

# Clear Vite cache
rm -rf node_modules/.vite
```

#### 5. Backend Connection Issues
- Verify backend server is running
- Check proxy configuration in `vite.config.js`
- Test API endpoints directly with curl
- Check browser network tab for errors

### Debug Mode
Enable debug logging:
```javascript
// In browser console
window.STRATA_CONFIG = { debug: true };

// Or set environment variable
VITE_DEBUG_MODE=true npm run dev
```

## Performance Optimization

### Build Performance
- **Bundle Analysis**: Use `npm run build -- --analyze`
- **Code Splitting**: Already configured via Vite
- **Tree Shaking**: Automatic with ES modules

### Runtime Performance
- **React DevTools**: Install browser extension
- **Lighthouse**: Run performance audits
- **Bundle Size**: Monitor with bundlephobia.com

### Development Performance
- **Hot Reload**: Already optimized
- **Source Maps**: Enabled in development
- **Fast Refresh**: Preserves component state