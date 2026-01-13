# GitHub Storage Setup Instructions

Your coin tracker now stores data directly in your GitHub repository!

## Step 1: Create a Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Set description: `APS Coin Tracker`
3. Check the box for `repo` (full control of private repositories)
4. Click "Generate token" at the bottom
5. **IMPORTANT:** Copy the token immediately (you won't see it again!)
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Create data folder in your GitHub repository

1. Go to: https://github.com/annpasz/APSCoinTracker
2. Click "Add file" → "Create new file"
3. Type: `data/.gitkeep`
4. Scroll down and click "Commit new file"

This creates an empty `data` folder where your coin data will be stored.

## Step 3: Configure the app

1. Open your deployed site: https://annpasz.github.io/APSCoinTracker
2. Click "⚙️ GitHub Settings" in the sidebar
3. Paste your Personal Access Token
4. Click "💾 Save Settings"
5. Click "🔌 Test Connection" to verify it works

## Step 4: Upload your existing data

1. Click "⬆️ Upload Local Data to GitHub"
2. Wait for confirmation
3. Your data is now stored in GitHub!

## How it works

- **Automatic sync**: Every time you add/edit/delete a coin, it's saved to GitHub
- **Access anywhere**: Your data is in GitHub, accessible from any device/browser
- **Version control**: GitHub tracks all changes to your data
- **Backup**: Your data is safely stored in the cloud

## Important notes

- Keep your Personal Access Token secret (like a password)
- The token is stored in your browser's localStorage
- You'll need to configure GitHub settings on each new device/browser
- Data files are stored in: `https://github.com/annpasz/APSCoinTracker/tree/main/data`

## Troubleshooting

**"Connection failed"** → Check your token and make sure the `data` folder exists

**"Upload failed"** → Make sure the `data` folder exists in your repository

**Need to revoke token?** → Go to https://github.com/settings/tokens and delete it
