#!/bin/bash
# Deploy script for football-ai

# Add Homebrew to PATH
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

cd ~/football-merchant

helm upgrade football-ai ./helm \
  -f helm/values.yaml \
  -f helm/values/frontend-values.yaml \
  -f helm/values/backend-values.yaml \
  -f helm/values/postgres-values.yaml \
  -f helm/values/ollama-values.yaml \
  -f helm/values/pgadmin-values.yaml \
  -f helm/values/ingress-values.yaml \
  -f helm/values/redis-values.yaml \
  -f helm/values/pgbouncer-values.yaml \
  --namespace football-ai

echo "Deployment complete!"
kubectl get pods -n football-ai
