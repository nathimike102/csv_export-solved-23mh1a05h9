# Quick Start Guide

## Start the Application

```bash
# One command to start everything!
docker-compose up --build -d

# Wait for seeding (2-5 minutes)
docker-compose logs app | tail -20
```

## Test the API

```bash
# 1. Initiate export
EXPORT_ID=$(curl -s -X POST http://localhost:8080/exports/csv | jq -r '.exportId')
echo "Export started: $EXPORT_ID"

# 2. Check progress
curl http://localhost:8080/exports/$EXPORT_ID/status | jq '.'

# 3. Download when complete
curl http://localhost:8080/exports/$EXPORT_ID/download -o export.csv

# 4. Verify health
curl http://localhost:8080/health | jq '.'
```

## Useful Commands

```bash
# View logs
docker-compose logs app
docker-compose logs db

# Check health
docker-compose ps

# Stop services
docker-compose down

# Find export ID quickly
curl -s -X POST http://localhost:8080/exports/csv | jq '.exportId'

# Test with filters
curl -X POST "http://localhost:8080/exports/csv?country_code=US&subscription_tier=premium"

# Test with compression
curl -H "Accept-Encoding: gzip" http://localhost:8080/exports/\{exportId\}/download | gunzip | head

# Test Range requests (resumable)
curl -H "Range: bytes=0-1000" http://localhost:8080/exports/\{exportId\}/download
```

## Production Deployment

The application is production-ready. For scaling:

1. Use Redis for persistent job queue
2. Stream to S3/MinIO instead of filesystem  
3. Add authentication/authorization
4. Run multiple replicas behind load balancer
5. Set up monitoring and logging aggregation

See README.md for full details.
