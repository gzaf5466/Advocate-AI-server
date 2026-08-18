#!/bin/bash
git pull origin main
npm install
  npx prisma generate
pm2 restart all
