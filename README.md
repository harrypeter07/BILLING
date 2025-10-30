# Billing Solutions - PWA for Small Businesses

A production-ready Progressive Web App (PWA) designed for small businesses to manage products, create professional invoices with GST calculations, track customers, and generate reports. Works seamlessly offline with automatic synchronization when online.

## Features

### Core Functionality
- **Product Management**: Create, edit, and manage product inventory with SKU, pricing, and stock tracking
- **Customer Management**: Maintain customer database with contact information and purchase history
- **Invoice Creation**: Generate professional invoices with GST/Non-GST support
- **GST Calculations**: Automatic CGST, SGST, and IGST calculations based on state
- **Reports & Analytics**: Sales reports, tax reports, and inventory reports with export functionality
- **Business Settings**: Configure business information, invoice defaults, and tax settings

### Offline-First Architecture
- **Full Offline Support**: All features work without internet connectivity
- **Automatic Sync**: Data automatically syncs when connection is restored
- **IndexedDB Storage**: Local data persistence using Dexie.js
- **Conflict Resolution**: Last-write-wins strategy for sync conflicts

### PWA Capabilities
- **Installable**: Install as a native app on mobile and desktop
- **Offline Access**: Complete functionality without internet
- **Fast Loading**: Optimized performance with service workers
- **Responsive Design**: Works on all devices (mobile, tablet, desktop)

## Tech Stack

- **Frontend**: Next.js 16+, React 19+, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **State Management**: Zustand
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Charts**: Recharts
- **PDF Generation**: jsPDF
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd billing-solutions
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Add your Supabase credentials to `.env.local`:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

5. Run database migrations:
\`\`\`bash
npm run db:migrate
\`\`\`

6. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

\`\`\`
billing-solutions/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Authentication pages
│   ├── (dashboard)/             # Protected dashboard routes
│   │   ├── dashboard/           # Main dashboard
│   │   ├── products/            # Product management
│   │   ├── customers/           # Customer management
│   │   ├── invoices/            # Invoice management
│   │   ├── reports/             # Reports & analytics
│   │   └── settings/            # Settings pages
│   └── api/                     # API routes
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── layout/                  # Layout components
│   ├── forms/                   # Form components
│   ├── features/                # Feature-specific components
│   └── shared/                  # Shared utilities
├── lib/
│   ├── supabase/               # Supabase clients
│   ├── db/                     # Database queries
│   ├── sync/                   # Offline sync logic
│   ├── utils/                  # Utility functions
│   ├── hooks/                  # Custom React hooks
│   └── api/                    # API client functions
├── stores/                      # Zustand stores
├── types/                       # TypeScript types
├── public/                      # Static assets
└── scripts/                     # Database migrations
\`\`\`

## Key Features Explained

### GST Calculations
The app automatically calculates GST based on:
- **Same State**: CGST (50%) + SGST (50%)
- **Different State**: IGST (100%)
- **Non-GST Invoices**: No tax calculation

### Offline Functionality
1. All data is stored locally in IndexedDB
2. Changes are queued for sync
3. When online, changes are automatically pushed to Supabase
4. Remote changes are pulled and merged locally

### Reports
- **Sales Report**: Track daily/monthly sales with trends
- **Tax Report**: GST breakdown (CGST, SGST, IGST)
- **Inventory Report**: Stock levels, low stock alerts, stock value

## Database Schema

### Tables
- `user_profiles`: Extended user information
- `products`: Product inventory
- `customers`: Customer information
- `invoices`: Invoice headers
- `invoice_items`: Invoice line items
- `business_settings`: User-specific business configuration
- `sync_log`: Offline sync tracking

All tables have Row-Level Security (RLS) enabled for data protection.

## Security

- **Authentication**: Supabase Auth with email/password
- **Authorization**: Row-Level Security (RLS) policies
- **Data Protection**: All user data is isolated by user_id
- **HTTPS Only**: Enforced in production
- **Session Management**: HTTP-only cookies for session storage

## Performance Optimization

- Server Components for faster initial load
- Lazy loading of heavy components
- Pagination for large datasets
- Debounced search inputs
- Image optimization with Next.js Image component
- Service Worker caching strategy

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy

\`\`\`bash
vercel deploy
\`\`\`

### Custom Domain
Configure custom domain in Vercel settings and update `NEXT_PUBLIC_APP_URL` environment variable.

## Development

### Running Tests
\`\`\`bash
npm run test
\`\`\`

### Building for Production
\`\`\`bash
npm run build
npm start
\`\`\`

### Database Migrations
\`\`\`bash
npm run db:migrate
npm run db:reset
\`\`\`

## Troubleshooting

### Offline Sync Issues
- Check browser's IndexedDB in DevTools
- Verify Supabase connection
- Check sync queue in browser console

### Authentication Issues
- Clear browser cookies
- Check Supabase auth configuration
- Verify environment variables

### Performance Issues
- Check Lighthouse score
- Monitor bundle size
- Use React DevTools Profiler

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Email: support@billingsolutions.com

## Roadmap

- [ ] Multi-user support with team management
- [ ] Payment gateway integration
- [ ] Email invoice delivery
- [ ] Advanced reporting with custom date ranges
- [ ] Inventory alerts and notifications
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations
- [ ] Accounting software integration

## Changelog

### v1.0.0 (Initial Release)
- Core product management
- Customer management
- Invoice creation with GST
- Offline-first architecture
- Reports and analytics
- PWA capabilities
