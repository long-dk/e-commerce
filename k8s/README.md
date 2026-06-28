# Kubernetes Deployment for E-Commerce Microservices

This directory contains all Kubernetes manifests and configurations for deploying the e-commerce GraphQL system across multiple regions.

## Directory Structure

```
k8s/
├── base/                           # Base manifests (applied to all environments)
│   ├── namespaces/                # Namespace definitions
│   ├── rbac/                      # RBAC configurations
│   ├── services/                  # 8 microservices + ConfigMaps + Secrets
│   ├── databases/                 # PostgreSQL, MongoDB, Redis, Kafka StatefulSets
│   ├── monitoring/                # Prometheus, Grafana, ELK, Jaeger
│   └── ingress/                   # Ingress rules and TLS
│
├── overlays/                       # Region-specific customizations
│   ├── region-1/                  # Region 1 configuration (kustomize)
│   └── region-2/                  # Region 2 configuration (kustomize)
│
├── argocd/                        # GitOps ArgoCD configuration
│   └── applications.yaml          # ApplicationSet and Applications
│
└── README.md                      # This file
```

## Quick Start

### 1. Prepare Secrets

```bash
# Edit with your actual values
vim k8s/base/services/secrets.yaml

# Required values:
# - DATABASE_PASSWORD
# - MONGODB_PASSWORD  
# - JWT_SECRET
# - STRIPE_API_KEY
# - OAUTH2_GOOGLE_CLIENT_ID/SECRET
```

### 2. Deploy to Region 1

```bash
# Validate manifests
kubectl apply -f k8s/base -n production --dry-run=client

# Apply manifests
kubectl apply -f k8s/base -n production

# Apply region-specific overlays
kustomize build k8s/overlays/region-1 | kubectl apply -f -
```

### 3. Deploy to Region 2

```bash
# Switch to Region 2 cluster context
kubectl config use-context region-2

# Apply same manifests
kustomize build k8s/overlays/region-2 | kubectl apply -f -
```

### 4. Set Up GitOps (Optional - Recommended)

```bash
# Install ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd -n argocd --create-namespace

# Apply ArgoCD applications
kubectl apply -f k8s/argocd/applications.yaml -n argocd
```

## Component Overview

### Microservices (k8s/base/services/)

- **API Gateway** (4000): Single entry point, GraphQL federation
- **Auth Service** (4001): Authentication & authorization
- **Products Service** (4002): Product catalog with real-time updates
- **Orders Service** (4003): Order management
- **Payments Service** (4004): Payment processing
- **Inventory Service** (4005): Stock management
- **Shipping Service** (4006): Shipment tracking
- **Notifications Service** (4007): Email/SMS notifications

### Databases (k8s/base/databases/)

- **PostgreSQL**: 3-replica StatefulSet (auth, orders, payments, shipping, notifications)
- **MongoDB**: 3-node ReplicaSet (products, inventory)
- **Redis**: 3-node cluster (caching, sessions)
- **Kafka + Zookeeper**: Message broker for event streaming

### Monitoring (k8s/base/monitoring/)

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Metrics visualization
- **Elasticsearch/Logstash/Kibana**: Centralized logging
- **Jaeger**: Distributed tracing
- **AlertManager**: Alert routing (Slack, email)

### Ingress (k8s/base/ingress/)

- Nginx Ingress Controller
- TLS certificates (cert-manager + Let's Encrypt)
- Routing rules for all services

## Configuration

### Environment Variables

**Global** (ConfigMap: `ecommerce-config`):
- `NODE_ENV`: production
- `LOG_LEVEL`: info/debug
- Service discovery DNS names
- Monitoring endpoints

**Secrets** (Secret: `ecommerce-secrets`):
- Database credentials
- API keys (Stripe, OAuth2)
- JWT secret
- Slack webhook for alerts

### Region-Specific Customization

Use Kustomize overlays to customize per region:

```yaml
# k8s/overlays/region-1/kustomization.yaml
replicas:
- name: api-gateway
  count: 3
commonLabels:
  region: region-1
```

## Deployment Validation

### Check Cluster Health

```bash
# Nodes
kubectl get nodes

# Namespaces
kubectl get namespaces

# Pods
kubectl get pods -n production -o wide

# PVCs
kubectl get pvc -n production
```

### Test Service Connectivity

```bash
# Port-forward to API Gateway
kubectl port-forward -n production svc/api-gateway 4000:4000

# Test GraphQL endpoint
curl http://localhost:4000/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'
```

### Access Monitoring

```bash
# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# http://localhost:3000

# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# http://localhost:9090

# Kibana
kubectl port-forward -n monitoring svc/kibana 5601:5601
# http://localhost:5601

# Jaeger
kubectl port-forward -n monitoring svc/jaeger 16686:16686
# http://localhost:16686
```

## Scaling & Updates

### Scale Service

```bash
kubectl scale deployment api-gateway -n production --replicas=5
```

### Rolling Update

```bash
# Update image
kubectl set image deployment/api-gateway \
  api-gateway=ecommerce-api-gateway:2.0.0 \
  -n production

# Watch rollout
kubectl rollout status deployment/api-gateway -n production
```

### GitOps Update

```bash
# Commit changes to git repo
git add . && git commit -m "Update replicas" && git push

# ArgoCD auto-syncs (if enabled)
# Or manually: argocd app sync ecommerce-region1
```

## Troubleshooting

### Pod Debugging

```bash
# View logs
kubectl logs <pod-name> -n production

# Execute command in pod
kubectl exec -it <pod-name> -n production -- /bin/sh

# Port-forward to pod
kubectl port-forward <pod-name> 8080:4000 -n production
```

### Database Issues

```bash
# PostgreSQL connectivity
kubectl exec -n production postgres-0 -- \
  psql -U ecommerce_user -c "SELECT 1;"

# MongoDB connectivity  
kubectl exec -n production mongodb-0 -- \
  mongosh --eval "db.adminCommand('ping')"
```

### Ingress Issues

```bash
# Check ingress status
kubectl get ingress -n production -o wide

# View ingress controller logs
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Check DNS resolution
nslookup api.ecommerce.local
```

## Cross-Region Sync

### PostgreSQL Replication

Primary (Region 1) → Replica (Region 2)

```bash
# Check replication status on primary
kubectl exec -n production postgres-0 -- \
  psql -U ecommerce_user -c "SELECT * FROM pg_stat_replication;"
```

### Kafka MirrorMaker

Topics automatically replicate between regions via Kafka MirrorMaker.

```bash
# List topics on Region 1
kubectl exec kafka-0 -n production -- \
  kafka-topics.sh --list --bootstrap-server=kafka:9092
```

## Security

### RBAC

- Service accounts scoped to production namespace
- Network policies restrict inter-pod communication
- ClusterRoles limit API access

### Secrets Management

Secrets stored in etcd encrypted at rest. Options:

1. **Native K8s Secrets** (default)
2. **Sealed Secrets** (for git-safe encryption)
3. **External Secrets Operator** (for external secret stores)

### TLS/HTTPS

- Certificates managed by cert-manager
- Let's Encrypt for public certificates
- Internal CA for private services

## Best Practices

1. **Use GitOps** - All changes via Git + ArgoCD
2. **Monitor Everything** - Metrics, logs, traces
3. **Test Scaling** - Load test before production
4. **Automate Backups** - Database and etcd backups
5. **Document Changes** - Use GitOps commit messages
6. **Security Scanning** - Scan images, manifests
7. **Resource Limits** - Prevent resource starvation

## Documentation

- [Deployment Guide](../docs/K8S_DEPLOYMENT_GUIDE.md)
- [Architecture Overview](../docs/ARCHITECTURE_OVERVIEW.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)

## Support

For issues or questions:
1. Check logs: `kubectl logs`
2. Check events: `kubectl describe pod/svc`
3. Review monitoring dashboards
4. Check this README and docs/

---

**Maintained by**: DevOps Team  
**Last Updated**: 2026-06-23
