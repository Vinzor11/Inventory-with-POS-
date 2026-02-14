#!/bin/bash
set -e

# Railway env vars are raw process env; strip accidental wrapping quotes.
strip_wrapping_quotes() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    return
  fi

  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  export "$name=$value"
}

for key in APP_ENV APP_DEBUG APP_URL APP_KEY DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD QUEUE_CONNECTION FILESYSTEM_DISK; do
  strip_wrapping_quotes "$key"
done

echo "Clearing cached config/routes/views..."
php artisan optimize:clear

echo "Running migrations..."
php artisan migrate --force

echo "Running bootstrap seeders..."
PRODUCT_COUNT=$(php artisan tinker --execute="echo \\App\\Models\\Product::query()->count();" | tr -d '\r\n')
if [[ "$PRODUCT_COUNT" == "0" ]]; then
  echo "No products found, running ProductSeeder..."
  php artisan db:seed --class=Database\\Seeders\\ProductSeeder --force --no-interaction
fi

echo "Ensuring agricultural products and weigh-in prices exist..."
php artisan db:seed --class=Database\\Seeders\\AgriculturalProductsSeeder --force --no-interaction
php artisan db:seed --class=Database\\Seeders\\WeighInPriceSeeder --force --no-interaction

echo "Creating storage link..."
php artisan storage:link || true

echo "Running ProductImageSeeder..."
php artisan db:seed --class=Database\\Seeders\\ProductImageSeeder --force --no-interaction

echo "Rebuilding optimized caches with runtime environment..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Starting application..."
exec /start-container.sh
