#!/bin/sh
ssh root@194.163.180.21 <<EOF
 cd ~/home/blockchain/backend/server
 git pull
 npm install
 pm2 restart 31
 exit
EOF