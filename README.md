# EasyParkNow - Full-Stack Parking Space Booking Platform

A comprehensive parking space booking platform built with Next.js, Node.js, Express, and PostgreSQL.

## 🚀 Features

### For Drivers
- Search and book parking spaces by location and time
- Interactive map view with available spaces
- Secure payment processing (Stripe)
- Booking management (view, cancel, extend)
- Real-time notifications

### For Space Owners (Hosts)
- List parking spaces with photos and pricing
- Manage availability and bookings
- Earnings dashboard
- Automated payouts

### For Admins
- User and space management
- Booking oversight
- Analytics dashboard
- Payment monitoring

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety
- **Google Maps API** - Map integration
- **Stripe Elements** - Payment processing
- **React Hook Form** - Form handling
- **Zustand** - State management

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Prisma** - Database ORM
- **JWT** - Authentication
- **Stripe API** - Payment processing
- **Multer + AWS S3** - File uploads
- **Nodemailer** - Email notifications

## 📁 Project Structure

```
easyparkNow/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # Reusable UI components
│   │   ├── lib/            # Utility functions and configurations
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # State management
│   │   └── types/          # TypeScript type definitions
│   ├── public/             # Static assets
│   └── package.json
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Custom middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Helper functions
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── .env.example            # Environment variables template
└── README.md              # This file
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Git
- VS Code (recommended)

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd easyparkNow
```

### Step 2: Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd ../backend
npm install
```

### Step 3: Environment Setup

Create `.env` files in both frontend and backend directories using the provided `.env.example` templates.

#### Backend Environment Variables
```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your configuration:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/easyparkNow"
JWT_SECRET="your-super-secret-jwt-key"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_BUCKET_NAME="your-s3-bucket"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

#### Frontend Environment Variables
```bash
cd ../frontend
cp .env.example .env.local
```

Edit the `.env.local` file:
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

### Step 4: Database Setup
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

### Step 5: Start Development Servers

#### Backend (Terminal 1)
```bash
cd backend
npm run dev
```

#### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔑 API Keys Setup

### Stripe
1. Create account at https://stripe.com
2. Get test keys from Dashboard > Developers > API keys
3. Set up webhook endpoint for payment events

### Google Maps
1. Go to Google Cloud Console
2. Enable Maps JavaScript API and Places API
3. Create API key and restrict it to your domain

### AWS S3 (for file uploads)
1. Create AWS account and S3 bucket
2. Create IAM user with S3 permissions
3. Get access keys

## 📱 VS Code Extensions (Recommended)

Install these extensions for the best development experience:

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
    "christian-kohler.path-intellisense"
  ]
}
```

## 🚀 Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Backend (Railway/Render)
1. Create account on Railway or Render
2. Connect GitHub repository
3. Set environment variables
4. Deploy with PostgreSQL add-on

## 🧪 Testing

### Backend API Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 📊 Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts (drivers, hosts, admins)
- `parking_spaces` - Listed parking spaces
- `bookings` - Parking reservations
- `payments` - Payment records
- `reviews` - User reviews and ratings

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- Rate limiting
- SQL injection prevention with Prisma

## 📧 Email Notifications

Automated emails are sent for:
- Account registration
- Booking confirmations
- Payment receipts
- Booking reminders
- Cancellation notifications

## 💳 Payment Processing

Secure payment handling with Stripe:
- Credit/debit cards
- Apple Pay
- Google Pay
- Automatic refunds for cancellations
- Webhook handling for payment events

## 🗺 Map Integration

Interactive maps powered by Google Maps:
- Real-time space availability
- Directions to parking spaces
- Street view integration
- Location search and autocomplete

## 📈 Analytics & Monitoring

- User activity tracking
- Booking analytics
- Revenue reporting
- Performance monitoring
- Error logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Email: support@easyparkNow.com
- Documentation: [Link to docs]
- Issues: GitHub Issues page
