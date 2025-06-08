#!/usr/bin/env bash

# Download the latest yt-dlp binary from GitHub
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp

# Make it executable
chmod +x yt-dlp
