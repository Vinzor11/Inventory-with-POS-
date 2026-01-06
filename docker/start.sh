#!/bin/bash
set -e

echo "Running migrations..."
php artisan migrate --force

echo "Creating storage link..."
php artisan storage:link || true

echo "Running ProductImageSeeder..."
php artisan db:seed --class=Database\\Seeders\\ProductImageSeeder --force

echo "Starting application..."
exec /start-container.sh

