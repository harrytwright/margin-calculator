# Menu Book Landing Page

Marketing landing page for getmenubook.com

## 🛠️ Tech Stack

- **Parcel** - Zero-config build tool
- **Tailwind CSS** - Utility-first CSS framework
- **PostHog** - Product analytics
- **Formsubmit.co** - Email capture service

## 📦 Development

```bash
# Install dependencies
npm install

# Start development server (auto-opens browser)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment to Cloudflare Pages

### Via Cloudflare Dashboard

1. Go to **Cloudflare Pages** dashboard
2. Create new project
3. Connect your Git repository
4. Configure build settings:
   - **Build command**: `cd apps/landing && npm install && npm run build`
   - **Build output directory**: `apps/landing/dist`
   - **Root directory**: `/` (leave blank)
5. Deploy!

### Via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
cd apps/landing
npm run build
wrangler pages deploy dist --project-name=menu-book-landing
```

## 📊 Analytics

### PostHog

PostHog is already configured and tracking:

- Page views (automatic)
- Waitlist signups (custom event)

Dashboard: https://eu.posthog.com

### Formsubmit.co Setup

**First-time activation:**

1. Deploy the site
2. Submit a test email through the form
3. Check `info@getmenubook.com` for activation email
4. Click the activation link
5. All future signups will be delivered instantly

## 📁 Project Structure

```
apps/landing/
├── src/
│   ├── index.html           # Main HTML
│   ├── styles.css           # Tailwind + custom CSS
│   ├── scripts/
│   │   ├── main.js          # Entry point
│   │   ├── analytics.js     # PostHog integration
│   │   ├── forms.js         # Form handling
│   │   └── navigation.js    # Smooth scroll
│   └── assets/              # Images, fonts (future)
├── dist/                    # Build output (gitignored)
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🎨 Customization

### Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      'menu-blue': '#667eea',
      'menu-purple': '#764ba2',
    },
  },
}
```

### Analytics

Update PostHog API key in `src/scripts/analytics.js`:

```javascript
posthog.init('YOUR_API_KEY_HERE', {
  api_host: 'https://eu.i.posthog.com',
})
```

## 📝 License

MIT - Created by GoBowling Shipley Lanes
