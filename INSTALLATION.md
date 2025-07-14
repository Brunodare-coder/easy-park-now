# EasyParkNow - Complete Installation & Setup Guide

This guide provides step-by-step instructions for setting up the EasyParkNow full-stack parking booking platform on your local development environment.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v13 or higher) - [Download here](https://www.postgresql.org/download/)
- **Git** - [Download here](https://git-scm.com/)
- **VS Code** (recommended) - [Download here](https://code.visualstudio.com/)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd easyparkNow
```

### 2. Install Dependencies

#### Backend Dependencies
```bash
cd backend
npm install
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 3. Environment Setup

#### Backend Environment
```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/easyparkNow"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"

# AWS S3
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_BUCKET_NAME="easyparkNow-uploads"

# Email
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

#### Frontend Environment
```bash
cd ../frontend
cp .env.example .env.local
```

Edit the `.env.local` file:

```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_stripe_publishable_key"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
```

### 4. Database Setup

#### Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE easyparkNow;
\q
```

#### Run Migrations
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

#### Seed Database (Optional)
```bash
npx prisma db seed
```

### 5. Start Development Servers

#### Backend Server (Terminal 1)
```bash
cd backend
npm run dev
```
Server will start on http://localhost:5000

#### Frontend Server (Terminal 2)
```bash
cd frontend
npm run dev
```
Frontend will start on http://localhost:3000

## 🔧 Detailed Setup Instructions

### Node.js Installation

#### Windows
1. Download the Windows installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the setup wizard
3. Verify installation: `node --version` and `npm --version`

#### macOS
```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
```

#### Linux (Ubuntu/Debian)
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### PostgreSQL Installation

#### Windows
1. Download PostgreSQL installer from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run installer and remember the password for the `postgres` user
3. Add PostgreSQL bin directory to your PATH

#### macOS
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Create a database user
createuser --interactive
```

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser --interactive
```

### VS Code Extensions

Install these recommended extensions for the best development experience:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "prisma.prisma",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-thunder-client"
  ]
}
```

## 🔑 API Keys Setup

### Stripe Setup
1. Create account at [stripe.com](https://stripe.com)
2. Go to Dashboard > Developers > API keys
3. Copy the publishable and secret keys
4. Set up webhook endpoint for payment events:
   - URL: `http://localhost:5000/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### Google Maps Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Maps JavaScript API and Places API
4. Create API key and restrict it to your domain
5. Add the key to your environment variables

### AWS S3 Setup
1. Create AWS account and S3 bucket
2. Create IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```
3. Get access keys and add to environment variables

### Email Setup (Gmail)
1. Enable 2-factor authentication on your Gmail account
2. Generate an app-specific password:
   - Go to Google Account settings
   - Security > 2-Step Verification > App passwords
   - Generate password for "Mail"
3. Use this password in EMAIL_PASS environment variable

## 🧪 Testing the Setup

### Backend API Testing
```bash
# Test health endpoint
curl http://localhost:5000/health

# Test user registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Frontend Testing
1. Open http://localhost:3000 in your browser
2. Check that the homepage loads correctly
3. Test navigation between pages
4. Verify responsive design on different screen sizes

## 🚀 Deployment

### Frontend Deployment (Vercel)

1. **Prepare for deployment:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### Backend Deployment (Railway/Render)

1. **Prepare for deployment:**
   ```bash
   cd backend
   npm run build  # if you have a build script
   ```

2. **Deploy to Railway:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway init
   railway up
   ```

3. **Set environment variables in Railway dashboard:**
   - All variables from `.env.example`
   - Add PostgreSQL database add-on

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 5000
npx kill-port 5000
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check database exists
psql -U postgres -l
```

#### Node Modules Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Prisma Issues
```bash
# Reset database
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

### Environment Variable Issues
- Ensure all required environment variables are set
- Check for typos in variable names
- Restart servers after changing environment variables
- Use `console.log(process.env.VARIABLE_NAME)` to debug

### CORS Issues
- Ensure `FRONTEND_URL` in backend matches your frontend URL
- Check CORS configuration in `backend/src/server.js`

## 📚 Additional Resources

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Learning Resources
- [React Tutorial](https://reactjs.org/tutorial/tutorial.html)
- [Node.js Guide](https://nodejs.org/en/docs/guides/)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs:**
   - Backend: Check terminal output where `npm run dev` is running
   - Frontend: Check browser console and terminal output
   - Database: Check PostgreSQL logs

2. **Common solutions:**
   - Restart both servers
   - Clear browser cache
   - Check environment variables
   - Verify database connection

3. **Debug mode:**
   ```bash
   # Backend with debug logs
   DEBUG=* npm run dev
   
   # Frontend with verbose logging
   npm run dev -- --verbose
   ```

4. **Database debugging:**
   ```bash
   # Open Prisma Studio
   npx prisma studio
   
   # Check database schema
   npx prisma db pull
   ```

## ✅ Verification Checklist

- [ ] Node.js and npm installed
- [ ] PostgreSQL installed and running
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Homepage loads at http://localhost:3000
- [ ] API health check responds at http://localhost:5000/health
- [ ] User registration works
- [ ] Database connection successful

## 🎉 Success!

If all steps are completed successfully, you should have:
- ✅ Backend API running on http://localhost:5000
- ✅ Frontend application running on http://localhost:3000
- ✅ Database connected and migrated
- ✅ All environment variables configured
- ✅ Ready for development!

Happy coding! 🚀
