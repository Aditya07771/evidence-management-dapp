This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Session 9: UI Pages Complete ✅

### Available Pages

**Public:**
- `/login` - User login
- `/register` - New user registration

**Protected:**
- `/dashboard` - System overview & statistics
- `/evidence` - Evidence list with filters
- `/evidence/upload` - Upload new evidence
- `/evidence/[id]` - Evidence details with custody history
- `/cases` - Case list
- `/cases/create` - Create new case
- `/cases/[id]` - Case details with evidence list

**Admin Only:**
- `/admin/officers` - Officer management
- `/admin/audit-logs` - System audit trail

### Running the Application

```bash
# Start Next.js development server
npm run dev

# Application runs at http://localhost:3000
```

### Complete Test Flow

1. **Login**
   - Go to http://localhost:3000
   - Login with: `officer.smith@evidence.gov` / `password123`

2. **Create a Case**
   - Click "Create Case" from dashboard
   - Fill in case details
   - Submit

3. **Upload Evidence**
   - Click "Upload Evidence"
   - Select the case
   - Choose a file
   - Fill in metadata
   - Submit (file is hashed and registered on blockchain)

4. **View Evidence**
   - Go to Evidence list
   - Click "View" on any item
   - See custody history, blockchain status, verifications

5. **Admin Features** (login as admin@evidence.gov)
   - View system statistics
   - Manage officers (activate/deactivate)
   - View complete audit trail

### Features Demonstrated

✅ File upload with blockchain registration  
✅ Dual-write pattern (PostgreSQL + Ethereum)  
✅ Chain of custody tracking  
✅ Evidence verification  
✅ Multi-signature transfers (for sensitive evidence)  
✅ Role-based access control  
✅ Complete audit trail  
✅ Case management  
✅ Officer management  
✅ System statistics

### Test Credentials

```text
Admin:
  Email: admin@evidence.gov
  Password: password123

Investigator:
  Email: officer.smith@evidence.gov
  Password: password123

Auditor:
  Email: auditor@evidence.gov
  Password: password123
```

## Run the Complete System

```bash
# Make sure all dependencies are installed
npm install

# Database should be running
docker-compose up -d

# Compile smart contract
npm run compile

# Deploy to Sepolia (or local network)
npm run deploy:sepolia

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start Next.js
npm run dev
```
