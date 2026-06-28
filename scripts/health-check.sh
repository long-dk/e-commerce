#!/bin/bash
# health-check.sh - Verify deployment health

set -e

NAMESPACE="production"

echo "🏥 E-Commerce Deployment Health Check"
echo "======================================"
echo ""

# Check namespaces
echo "📦 Namespaces:"
kubectl get namespaces | grep -E "production|monitoring|argocd|ingress"
echo ""

# Check nodes
echo "💻 Cluster Nodes:"
kubectl get nodes -o wide
echo ""

# Check PVCs
echo "💾 Persistent Volumes:"
kubectl get pvc -n $NAMESPACE
echo ""

# Check services
echo "🌐 Services:"
kubectl get svc -n $NAMESPACE
echo ""

# Check deployments
echo "📦 Deployments:"
kubectl get deployments -n $NAMESPACE -o wide
echo ""

# Check StatefulSets
echo "🗄️  StatefulSets:"
kubectl get statefulsets -n $NAMESPACE -o wide
echo ""

# Check pods
echo "🐳 Pods:"
kubectl get pods -n $NAMESPACE -o wide
echo ""

# Check for pod errors
FAILED_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --field-selector=status.phase!=Succeeded)
if [ ! -z "$FAILED_PODS" ]; then
    echo "⚠️  Failed Pods:"
    echo "$FAILED_PODS"
    echo ""
fi

# Check ingress
echo "🚪 Ingress:"
kubectl get ingress -n $NAMESPACE
echo ""

# Health endpoints
echo "🏥 Service Health Endpoints:"
API_GW_POD=$(kubectl get pods -n $NAMESPACE -l app=api-gateway -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$API_GW_POD" ]; then
    echo "  API Gateway: /health"
    kubectl exec -n $NAMESPACE $API_GW_POD -- curl -s http://localhost:4000/health || echo "  ⚠️  Connection failed"
fi
echo ""

# Database connectivity
echo "🗄️  Database Connectivity:"
PG_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$PG_POD" ]; then
    echo "  PostgreSQL: Checking..."
    kubectl exec -n $NAMESPACE $PG_POD -- psql -U ecommerce_user -c "SELECT version();" || echo "  ⚠️  Connection failed"
fi
echo ""

# Monitoring
echo "📊 Monitoring Stack:"
kubectl get pods -n monitoring
echo ""

echo "✅ Health check complete!"
