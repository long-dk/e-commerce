# K8s Deployment Guide for E-Commerce GraphQL System

## Overview

This guide provides step-by-step instructions to deploy a multi-region Kubernetes setup for the e-commerce microservices system.

## Prerequisites

- 2 Kubernetes clusters (1 per region) with 3+ nodes each
- `kubectl` installed and configured for both clusters
- `helm` 3.0+
- `argocd-cli` (optional, for CLI management)
- Git repository access for GitOps
- Local storage provisioner or storage backend available

## Architecture

```
Region 1 K8s Cluster                   Region 2 K8s Cluster
├─ 8 Microservices (2-3 replicas)     ├─ 8 Microservices (2-3 replicas)
├─ PostgreSQL Primary (primary)        ├─ PostgreSQL Replica (read-only)
├─ MongoDB ReplicaSet                  ├─ MongoDB ReplicaSet
├─ Redis Cluster                       ├─ Redis Cluster
├─ Kafka + Zookeeper                   ├─ Kafka + Zookeeper
├─ Prometheus + Grafana                ├─ Prometheus + Grafana
├─ ELK Stack (Elasticsearch/Logstash)  ├─ ELK Stack
├─ Jaeger                              ├─ Jaeger
└─ Nginx Ingress                       └─ Nginx Ingress

Cross-region sync:
- PostgreSQL streaming replication (async)
- Kafka MirrorMaker 2.0 (topic replication)
- MongoDB document sync via Kafka
```

## Deployment Steps

### Phase 1: Prepare K8s Clusters

For each region (Region 1 and Region 2):

1. **Verify cluster health:**
```bash
kubectl get nodes
kubectl get namespaces
```

2. **Run cluster setup script:**
```bash
chmod +x scripts/setup-k8s-cluster.sh
./scripts/setup-k8s-cluster.sh region-1
./scripts/setup-k8s-cluster.sh region-2
```

This creates:
- Namespaces: `production`, `monitoring`, `argocd`, `ingress-nginx`
- RBAC roles and service accounts
- Storage class for local volumes
- Metrics Server
- Cert Manager with Let's Encrypt issuer
- Nginx Ingress Controller

### Phase 2: Prepare Secrets

1. **Edit secrets file:**
```bash
vim k8s/base/services/secrets.yaml
```

2. **Update these values:**
   - `DATABASE_PASSWORD`: PostgreSQL password
   - `MONGODB_PASSWORD`: MongoDB password
   - `JWT_SECRET`: Generate with `openssl rand -hex 32`
   - `STRIPE_API_KEY`: Your Stripe key
   - `OAUTH2_GOOGLE_CLIENT_ID/SECRET`: Google OAuth credentials
   - `SLACK_WEBHOOK_URL`: Slack webhook for alerts

3. **(Optional) Use Sealed Secrets for encryption:**
```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets -n kube-system sealed-secrets/sealed-secrets

# Seal secrets
sealed-secrets seal k8s/base/services/secrets.yaml > k8s/base/services/secrets-sealed.yaml
```

### Phase 3: Configure Region-Specific Settings

1. **Region 1 overlay:**
```bash
vim k8s/overlays/region-1/kustomization.yaml
# Update: domain, clusterName, image tags
```

2. **Region 2 overlay:**
```bash
vim k8s/overlays/region-2/kustomization.yaml
# Update: domain, clusterName, image tags
```

3. **Configure ingress hostnames:**
```bash
vim k8s/base/ingress/ingress.yaml
# Update domain names for your environment
```

### Phase 4: Set Up Git Repository for GitOps

1. **Create Git repository:**
```bash
git clone https://github.com/YOUR_ORG/ecommerce-k8s-manifests.git
cd ecommerce-k8s-manifests
```

2. **Copy manifests to repo:**
```bash
cp -r k8s/ .
git add .
git commit -m "Initial K8s manifests for e-commerce system"
git push
```

### Phase 5: Install ArgoCD (Region 1 Primary)

```bash
chmod +x scripts/setup-argocd.sh
./scripts/setup-argocd.sh https://github.com/YOUR_ORG/ecommerce-k8s-manifests.git main
```

This will:
- Install ArgoCD in `argocd` namespace
- Create ArgoCD applications
- Output admin credentials and access URL

### Phase 6: Connect Region 2 Cluster to ArgoCD (Optional - for centralized ArgoCD)

If using single ArgoCD instance in Region 1 to manage both:

```bash
# Register Region 2 cluster with Region 1 ArgoCD
argocd cluster add <region-2-context> --name region-2
```

### Phase 7: Deploy Applications

Option A: Via ArgoCD UI
1. Access ArgoCD dashboard (from setup script output)
2. Click "Sync" on each application
3. Watch deployment progress

Option B: Via CLI
```bash
chmod +x scripts/deploy-ecommerce.sh
./scripts/deploy-ecommerce.sh region-1
./scripts/deploy-ecommerce.sh region-2
```

### Phase 8: Verify Deployment

```bash
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

Expected output:
- All namespaces created
- All nodes in Ready state
- All PVCs in Bound state
- All pods in Running state
- Services with stable IPs

## Accessing Services

### API Gateway
```bash
# Port-forward for testing
kubectl port-forward -n production svc/api-gateway 4000:4000

# Via ingress (if DNS configured)
curl https://api.ecommerce.local/graphql
```

### Monitoring Dashboards

```bash
# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:3000
# Access: http://localhost:3000 (admin/admin by default)

# Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Access: http://localhost:9090

# Kibana
kubectl port-forward -n monitoring svc/kibana 5601:5601
# Access: http://localhost:5601

# Jaeger
kubectl port-forward -n monitoring svc/jaeger 16686:16686
# Access: http://localhost:16686
```

## Cross-Region Replication Setup

### PostgreSQL Replication

Primary (Region 1) automatically replicates to Replica (Region 2).

**Verify replication status:**
```bash
# On primary
kubectl exec -n production postgres-0 -- psql -U ecommerce_user -c "SELECT slot_name, slot_type, active FROM pg_replication_slots;"

# On replica
kubectl exec -n production postgres-1 -- psql -U ecommerce_user -c "SELECT slot_name, usename, application_name, state FROM pg_stat_replication;"
```

### Kafka MirrorMaker 2.0

**Deploy MirrorMaker connector** (optional, for explicit Kafka replication):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka-mirror-maker
  namespace: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka-mirror-maker
  template:
    metadata:
      labels:
        app: kafka-mirror-maker
    spec:
      containers:
      - name: mirror-maker
        image: confluentinc/cp-kafka:7.5.0
        command:
        - connect-mirror-maker.sh
        - /etc/kafka/mm2.properties
        env:
        - name: CLUSTERS
          value: "region1 region2"
        - name: REGION1_BOOTSTRAP_SERVERS
          value: "kafka-0.kafka-headless,kafka-1.kafka-headless,kafka-2.kafka-headless:9092"
        - name: REGION2_BOOTSTRAP_SERVERS
          value: "kafka-region2-0.kafka-headless,kafka-region2-1.kafka-headless,kafka-region2-2.kafka-headless:9092"
        - name: SYNC_TOPIC_CONFIGS_ENABLED
          value: "true"
```

## Troubleshooting

### Pods not starting

```bash
# Check pod logs
kubectl logs -f deployment/<service-name> -n production

# Describe pod for events
kubectl describe pod <pod-name> -n production
```

### Database connection failures

```bash
# Test PostgreSQL connectivity
kubectl exec -n production postgres-0 -- psql -U ecommerce_user -d auth_db -c "SELECT 1;"

# Test MongoDB connectivity
kubectl exec -n production mongodb-0 -- mongosh --eval "db.adminCommand('ping')"
```

### Ingress not working

```bash
# Check ingress status
kubectl get ingress -n production
kubectl describe ingress api-gateway-ingress -n production

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx
```

### ArgoCD sync failures

```bash
# Check ArgoCD logs
kubectl logs -f deployment/argocd-application-controller -n argocd

# Get application details
argocd app get ecommerce-region1
argocd app describe ecommerce-region1
```

## Failover Procedure

### Manual Failover from Region 1 to Region 2

1. **Promote Region 2 database replicas to primary:**
```bash
# PostgreSQL: Promote replica
kubectl exec -n production postgres-1 -- pg_ctl promote -D /var/lib/postgresql/data

# MongoDB: Initiate new replica set
kubectl exec -n production mongodb-0 -- mongosh --eval "rs.stepDown(); rs.initiate();"
```

2. **Update DNS/load balancer to point to Region 2:**
```bash
# Update DNS records
# api.ecommerce.local -> Region 2 Ingress IP
```

3. **Verify Region 2 services are operational:**
```bash
./scripts/health-check.sh
```

## Scaling Considerations

### Horizontal Scaling

**Increase replicas per service:**
```bash
kubectl scale deployment api-gateway -n production --replicas=5
```

**Or update overlay:**
```yaml
# k8s/overlays/region-1/kustomization.yaml
replicas:
- name: api-gateway
  count: 5
```

### Vertical Scaling

**Update resource requests/limits in deployment manifests:**
```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
```

## Backup & Disaster Recovery

### Database Backups

```bash
# PostgreSQL backup
kubectl exec -n production postgres-0 -- pg_dump -U ecommerce_user -d auth_db > auth_db_backup.sql

# MongoDB backup
kubectl exec -n production mongodb-0 -- mongodump --out /tmp/backup
```

### ArgoCD State Backup

```bash
kubectl get applications -n argocd -o yaml > argocd-applications-backup.yaml
```

## Performance Tuning

### Database Connection Pooling

Update service deployments to configure connection pool sizes:
```yaml
env:
- name: DB_POOL_MIN
  value: "5"
- name: DB_POOL_MAX
  value: "20"
```

### Caching with Redis

Enable Redis caching in services:
```yaml
env:
- name: REDIS_ENABLED
  value: "true"
- name: CACHE_TTL
  value: "3600"
```

### Auto-Scaling

**Configure Horizontal Pod Autoscaler:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Support & Documentation

- **Service Logs**: `kubectl logs -f deployment/<service> -n production`
- **Monitoring**: Access Grafana dashboard for metrics visualization
- **Trace Analysis**: Use Jaeger for distributed tracing
- **Log Analysis**: Query Kibana for centralized logging

---

**Last Updated**: 2026-06-23
**Version**: 1.0
