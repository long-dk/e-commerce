#!/bin/bash
# deploy-ecommerce.sh - Deploy all e-commerce services via ArgoCD

set -e

REGION=${1:-"region-1"}
NAMESPACE="production"

echo "🚀 Deploying e-commerce system to region: $REGION"

# Ensure ArgoCD is ready
echo "⏳ Checking ArgoCD readiness..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Create secrets from environment variables
echo "🔐 Creating secrets from environment..."

# Read from secret files or environment
DB_PASSWORD=${DATABASE_PASSWORD:-$(openssl rand -base64 32)}
MONGO_PASSWORD=${MONGODB_PASSWORD:-$(openssl rand -base64 32)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}

kubectl create secret generic ecommerce-secrets \
  --from-literal=DATABASE_PASSWORD="$DB_PASSWORD" \
  --from-literal=MONGODB_PASSWORD="$MONGO_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  -n $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secrets created"

# Sync ArgoCD applications
echo "📋 Syncing ArgoCD applications..."

# Get all applications
APPS=$(kubectl get applications -n argocd -l region=$REGION -o jsonpath='{.items[*].metadata.name}')

for app in $APPS; do
    echo "  Syncing: $app"
    argocd app sync $app --grpc-web || kubectl port-forward -n argocd svc/argocd-server 8080:443 &
done

# Monitor deployment status
echo ""
echo "📊 Monitoring deployment status..."
kubectl rollout status deployment -l region=$REGION -n $NAMESPACE --timeout=5m || true

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Check status with:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  argocd app list"
echo "  kubectl logs -f deployment/api-gateway -n $NAMESPACE"
