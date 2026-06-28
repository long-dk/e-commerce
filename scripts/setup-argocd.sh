#!/bin/bash
# setup-argocd.sh - Install and configure ArgoCD

set -e

ARGOCD_NAMESPACE="argocd"
GIT_REPO=${1:-"https://github.com/YOUR_ORG/ecommerce-k8s-manifests.git"}
GIT_BRANCH=${2:-"main"}

echo "🚀 Installing ArgoCD..."

# Create namespace
kubectl create namespace $ARGOCD_NAMESPACE || true

# Add ArgoCD Helm repo
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install ArgoCD
helm upgrade --install argocd argo/argo-cd \
  --namespace $ARGOCD_NAMESPACE \
  --set configs.secret.argocdServerAdminPassword="CHANGE_ME_ARGOCD_PASSWORD" \
  --set server.insecure=true \
  --set server.service.type=LoadBalancer \
  --set repoServer.autoscaling.enabled=true \
  --set controller.replicas=1 \
  --set redis.enabled=true \
  --set notification.enabled=true

echo "⏳ Waiting for ArgoCD server to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n $ARGOCD_NAMESPACE --timeout=300s

# Create ArgoCD Applications
echo "📋 Creating ArgoCD applications..."
kubectl apply -f k8s/argocd/applications.yaml -n $ARGOCD_NAMESPACE

# Get ArgoCD admin password
echo ""
echo "✅ ArgoCD installed successfully!"
echo ""
echo "ArgoCD Admin Password:"
kubectl get secret argocd-initial-admin-secret -n $ARGOCD_NAMESPACE -o jsonpath="{.data.password}" | base64 -d
echo ""
echo ""
echo "ArgoCD Server URL:"
kubectl get svc argocd-server -n $ARGOCD_NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' || echo "kubectl port-forward -n argocd svc/argocd-server 8080:443"
echo ""

# Configure Git repository secret
echo "🔐 Configuring Git repository access..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ecommerce-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  type: git
  url: $GIT_REPO
  password: CHANGE_ME_GIT_PAT
  username: CHANGE_ME_GIT_USERNAME
EOF

echo "⚙️  Update Git credentials in the secret above"
echo ""
echo "Next steps:"
echo "1. Access ArgoCD dashboard"
echo "2. Configure Git repository credentials"
echo "3. Sync applications to deploy services"
