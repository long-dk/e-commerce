#!/bin/bash
# setup-k8s-cluster.sh - One-time setup script for K8s cluster prerequisites

set -e

CLUSTER_NAME=${1:-"region-1"}
REGION=${2:-"region-1"}
STORAGE_PATH=${3:-"/mnt/local-storage"}

echo "🔧 Setting up K8s cluster for: $CLUSTER_NAME ($REGION)"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi

# Create namespaces
echo "📦 Creating namespaces..."
kubectl apply -f k8s/base/namespaces/namespaces.yaml

# Create RBAC resources
echo "🔐 Setting up RBAC..."
kubectl apply -f k8s/base/rbac/rbac.yaml

# Create storage class for local volumes
echo "💾 Setting up local storage provisioner..."
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
EOF

# Create local PVs (assumes 3 worker nodes)
echo "📍 Creating local PersistentVolumes..."
for i in 0 1 2; do
    NODE=$(kubectl get nodes | tail -n $((i+2)) | awk '{print $1}')
    echo "  Creating PVs on node: $NODE"
    
    # Create directories on node
    kubectl debug node/$NODE -it --image=ubuntu -- chroot /host bash -c \
        "mkdir -p $STORAGE_PATH/postgres-$i $STORAGE_PATH/mongodb-$i $STORAGE_PATH/kafka-$i $STORAGE_PATH/prometheus" \
        || echo "  ⚠️  Could not create directories (may need manual setup)"
done

# Install Metrics Server (required for HPA)
echo "📊 Installing Metrics Server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml || true

# Install cert-manager for TLS
echo "🔒 Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml || true

# Wait for cert-manager to be ready
echo "⏳ Waiting for cert-manager to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s || true

# Create ClusterIssuer for Let's Encrypt
echo "📜 Creating ClusterIssuer for Let's Encrypt..."
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@ecommerce.local
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Install Nginx Ingress Controller
echo "🌐 Installing Nginx Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.metrics.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"=true \
  --set controller.podAnnotations."prometheus\.io/port"=10254

echo "✅ K8s cluster setup complete!"
echo ""
echo "Next steps:"
echo "1. Update secrets in k8s/base/services/secrets.yaml"
echo "2. Configure ingress hostnames in k8s/base/ingress/ingress.yaml"
echo "3. Set up Git repository for ArgoCD"
echo "4. Run: ./scripts/setup-argocd.sh"
