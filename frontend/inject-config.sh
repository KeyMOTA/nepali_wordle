#!/bin/sh

echo "window.CONFIG = { API_BASE: '${API_BASE:-/api}' };" > /usr/share/nginx/html/config.js
