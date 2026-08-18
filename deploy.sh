#!/bin/bash
# Local script to deploy the backend to the remote EC2 server.
# Make sure to run this script from inside the 'server' directory.

echo "Deploying backend to EC2 server (3.238.222.207)..."

# Connect via SSH and run deployment commands on the remote server
ssh -o StrictHostKeyChecking=no -i "Advocateai.pem" ubuntu@3.238.222.207 << 'EOF'
  echo "Navigating to the server directory..."
  cd ~/server || exit 1

  echo "Pulling latest code from GitHub..."
  git pull origin main

  echo "Installing any new dependencies..."
  npm install

  echo "Restarting the backend process via PM2..."
  pm2 restart all

  echo "Deployment complete! Your backend is up to date."
EOF
