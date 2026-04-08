# Instant Stock Alerts System

A comprehensive real-time alert system for inventory management, providing instant notifications for stock level changes, low stock warnings, and critical inventory events.

## Features

- **Real-time Stock Alerts**: Instant notifications when stock levels change
- **Low Stock Warnings**: Configurable thresholds for different alert levels
- **Multi-channel Notifications**: WebSocket, email, and SMS alerts
- **Alert Prioritization**: Critical, warning, and info level alerts
- **Alert History**: Track and manage alert responses
- **Bulk Alert Management**: Handle multiple simultaneous alerts

## Implementation

### Alert Service

```javascript
// alert.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductGateway } from './product.gateway';
import { EmailService } from '../email/email.service';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStockLevel: number;
  alertType: 'low_stock' | 'out_of_stock' | 'critical' | 'restocked';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: ('websocket' | 'email' | 'sms')[];
}

@Injectable()
export class AlertService {
  private activeAlerts = new Map<string, StockAlert>();
  private alertThresholds = {
    critical: 0,
    low: 5,
    medium: 10,
    high: 25
  };

  constructor(
    @InjectModel('Alert') private alertModel: Model<StockAlert>,
    private productGateway: ProductGateway,
    private emailService: EmailService,
  ) {}

  async checkStockAlert(productId: string, currentStock: number, minStockLevel: number, productName: string) {
    const alertKey = `product_${productId}`;

    // Determine alert type and priority
    const alertInfo = this.determineAlertType(currentStock, minStockLevel);

    if (alertInfo.shouldAlert) {
      const alert: StockAlert = {
        id: `${alertKey}_${Date.now()}`,
        productId,
        productName,
        currentStock,
        minStockLevel,
        alertType: alertInfo.type,
        message: this.generateAlertMessage(alertInfo.type, productName, currentStock),
        timestamp: new Date(),
        acknowledged: false,
        priority: alertInfo.priority,
        channels: this.getAlertChannels(alertInfo.priority)
      };

      // Store alert
      await this.saveAlert(alert);

      // Send notifications
      await this.sendAlertNotifications(alert);

      // Emit WebSocket event
      this.productGateway.emitLowStockAlert(alert);

      // Update active alerts
      this.activeAlerts.set(alertKey, alert);
    } else {
      // Clear any existing alerts for this product
      if (this.activeAlerts.has(alertKey)) {
        this.activeAlerts.delete(alertKey);
      }
    }
  }

  private determineAlertType(currentStock: number, minStockLevel: number) {
    if (currentStock === 0) {
      return {
        shouldAlert: true,
        type: 'out_of_stock' as const,
        priority: 'critical' as const
      };
    }

    if (currentStock <= minStockLevel) {
      return {
        shouldAlert: true,
        type: 'low_stock' as const,
        priority: currentStock <= this.alertThresholds.critical ? 'critical' :
                currentStock <= this.alertThresholds.low ? 'high' :
                currentStock <= this.alertThresholds.medium ? 'medium' : 'low'
      };
    }

    return { shouldAlert: false };
  }

  private generateAlertMessage(type: string, productName: string, currentStock: number): string {
    switch (type) {
      case 'out_of_stock':
        return `${productName} is now out of stock!`;
      case 'low_stock':
        return `${productName} is running low (${currentStock} remaining)`;
      case 'critical':
        return `CRITICAL: ${productName} has only ${currentStock} units left!`;
      default:
        return `${productName} stock alert: ${currentStock} remaining`;
    }
  }

  private getAlertChannels(priority: string): ('websocket' | 'email' | 'sms')[] {
    const baseChannels: ('websocket' | 'email' | 'sms')[] = ['websocket'];

    if (priority === 'critical' || priority === 'high') {
      baseChannels.push('email');
    }

    if (priority === 'critical') {
      baseChannels.push('sms');
    }

    return baseChannels;
  }

  private async sendAlertNotifications(alert: StockAlert) {
    const promises = [];

    if (alert.channels.includes('email')) {
      promises.push(this.sendEmailAlert(alert));
    }

    if (alert.channels.includes('sms')) {
      promises.push(this.sendSMSAlert(alert));
    }

    // WebSocket is handled by the gateway
    await Promise.all(promises);
  }

  private async sendEmailAlert(alert: StockAlert) {
    const subject = `Stock Alert: ${alert.alertType.replace('_', ' ').toUpperCase()}`;
    const html = `
      <h2>${subject}</h2>
      <p><strong>Product:</strong> ${alert.productName}</p>
      <p><strong>Current Stock:</strong> ${alert.currentStock}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Priority:</strong> ${alert.priority.toUpperCase()}</p>
      <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
      <br>
      <a href="${process.env.FRONTEND_URL}/inventory/alerts/${alert.id}">View in Dashboard</a>
    `;

    await this.emailService.sendAlertEmail(
      process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      subject,
      html
    );
  }

  private async sendSMSAlert(alert: StockAlert) {
    // Implementation would depend on SMS service (Twilio, AWS SNS, etc.)
    // For now, just log the alert
    console.log(`SMS Alert: ${alert.message}`);
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.alertModel.findById(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      await alert.save();

      // Emit acknowledgment event
      this.productGateway.emitAlertAcknowledged(alert);
    }
  }

  async getActiveAlerts(): Promise<StockAlert[]> {
    return Array.from(this.activeAlerts.values());
  }

  async getAlertHistory(limit = 50): Promise<StockAlert[]> {
    return this.alertModel
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  private async saveAlert(alert: StockAlert) {
    const alertDoc = new this.alertModel(alert);
    await alertDoc.save();
  }
}
```

### Alert Schema

```javascript
// alert.schema.ts
import { Schema, Document } from 'mongoose';

export const AlertSchema = new Schema({
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  currentStock: { type: Number, required: true },
  minStockLevel: { type: Number, required: true },
  alertType: {
    type: String,
    enum: ['low_stock', 'out_of_stock', 'critical', 'restocked'],
    required: true
  },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String },
  acknowledgedAt: { type: Date },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  channels: [{ type: String, enum: ['websocket', 'email', 'sms'] }]
}, {
  timestamps: true
});

export interface AlertDocument extends Document, StockAlert {}
```

### Alert Gateway Extensions

```javascript
// product.gateway.ts (extended)
export class ProductGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // ... existing code ...

  emitLowStockAlert(alert: StockAlert) {
    this.server.emit('lowStockAlert', {
      ...alert,
      timestamp: alert.timestamp.toISOString()
    });
  }

  emitAlertAcknowledged(alert: StockAlert) {
    this.server.emit('alertAcknowledged', {
      alertId: alert.id,
      acknowledgedBy: alert.acknowledgedBy,
      timestamp: alert.acknowledgedAt?.toISOString()
    });
  }

  emitBulkAlerts(alerts: StockAlert[]) {
    this.server.emit('bulkAlerts', {
      alerts: alerts.map(alert => ({
        ...alert,
        timestamp: alert.timestamp.toISOString()
      })),
      count: alerts.length
    });
  }

  @SubscribeMessage('acknowledgeAlert')
  async handleAcknowledgeAlert(
    @MessageBody() data: { alertId: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      // In a real app, you'd get userId from authentication
      const userId = 'system'; // Placeholder
      await this.alertService.acknowledgeAlert(data.alertId, userId);

      client.emit('alertAcknowledged', { alertId: data.alertId });
    } catch (error) {
      client.emit('error', { message: 'Failed to acknowledge alert' });
    }
  }

  @SubscribeMessage('getActiveAlerts')
  async handleGetActiveAlerts(@ConnectedSocket() client: Socket) {
    try {
      const alerts = await this.alertService.getActiveAlerts();
      client.emit('activeAlerts', { alerts });
    } catch (error) {
      client.emit('error', { message: 'Failed to get active alerts' });
    }
  }
}
```

### Alert Dashboard

```html
<!-- alerts-dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Alerts Dashboard</title>
    <link rel="stylesheet" href="alerts.css">
</head>
<body>
    <div class="alerts-dashboard">
        <header class="dashboard-header">
            <h1>Stock Alerts Dashboard</h1>
            <div class="alert-stats">
                <span id="active-count">0</span> Active Alerts
            </div>
        </header>

        <div class="alerts-controls">
            <div class="filter-controls">
                <select id="priority-filter">
                    <option value="">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select id="type-filter">
                    <option value="">All Types</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="critical">Critical</option>
                </select>
                <label>
                    <input type="checkbox" id="show-acknowledged"> Show Acknowledged
                </label>
            </div>
            <button id="refresh-btn">Refresh</button>
        </div>

        <div class="alerts-container">
            <div id="alerts-list" class="alerts-list">
                <!-- Alerts will be loaded here -->
            </div>
        </div>

        <div class="alert-history">
            <h2>Recent Alert History</h2>
            <div id="alert-history-list" class="alert-history-list">
                <!-- Historical alerts -->
            </div>
        </div>
    </div>

    <!-- Alert Detail Modal -->
    <div id="alert-modal" class="alert-modal">
        <div class="alert-modal-content">
            <div class="alert-modal-header">
                <h3 id="modal-title">Alert Details</h3>
                <button id="modal-close">&times;</button>
            </div>
            <div id="modal-body" class="alert-modal-body">
                <!-- Alert details -->
            </div>
            <div class="alert-modal-actions">
                <button id="acknowledge-btn">Acknowledge Alert</button>
                <button id="view-product-btn">View Product</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="alerts-dashboard.js"></script>
</body>
</html>
```

### Alert Dashboard JavaScript

```javascript
// alerts-dashboard.js
class AlertsDashboard {
  constructor() {
    this.socket = io('http://localhost:4002/products');
    this.alerts = new Map();
    this.setupSocketListeners();
    this.loadAlerts();
    this.setupEventListeners();
  }

  setupSocketListeners() {
    // Real-time alert updates
    this.socket.on('lowStockAlert', (alert) => {
      this.addAlert(alert);
      this.showNotification(alert);
      this.playAlertSound(alert.priority);
    });

    this.socket.on('alertAcknowledged', (data) => {
      this.markAlertAcknowledged(data.alertId, data.acknowledgedBy);
    });

    this.socket.on('bulkAlerts', (data) => {
      data.alerts.forEach(alert => this.addAlert(alert));
    });
  }

  addAlert(alert) {
    this.alerts.set(alert.id, alert);
    this.renderAlert(alert);
    this.updateActiveCount();
  }

  renderAlert(alert) {
    const alertElement = this.createAlertElement(alert);
    const alertsList = document.getElementById('alerts-list');

    // Insert critical alerts at the top
    if (alert.priority === 'critical') {
      alertsList.insertBefore(alertElement, alertsList.firstChild);
    } else {
      alertsList.appendChild(alertElement);
    }
  }

  createAlertElement(alert) {
    const div = document.createElement('div');
    div.className = `alert-item ${alert.priority} ${alert.acknowledged ? 'acknowledged' : 'unacknowledged'}`;
    div.setAttribute('data-alert-id', alert.id);

    div.innerHTML = `
      <div class="alert-header">
        <span class="alert-priority ${alert.priority}">${alert.priority.toUpperCase()}</span>
        <span class="alert-type">${alert.alertType.replace('_', ' ').toUpperCase()}</span>
        <span class="alert-time">${this.formatTime(alert.timestamp)}</span>
      </div>
      <div class="alert-content">
        <h4 class="alert-product">${alert.productName}</h4>
        <p class="alert-message">${alert.message}</p>
        <div class="alert-details">
          <span>Current Stock: ${alert.currentStock}</span>
          <span>Min Level: ${alert.minStockLevel}</span>
        </div>
      </div>
      <div class="alert-actions">
        ${!alert.acknowledged ? '<button class="acknowledge-btn">Acknowledge</button>' : '<span class="acknowledged-text">Acknowledged</span>'}
        <button class="view-details-btn">Details</button>
      </div>
    `;

    // Add event listeners
    const acknowledgeBtn = div.querySelector('.acknowledge-btn');
    if (acknowledgeBtn) {
      acknowledgeBtn.addEventListener('click', () => this.acknowledgeAlert(alert.id));
    }

    const viewDetailsBtn = div.querySelector('.view-details-btn');
    viewDetailsBtn.addEventListener('click', () => this.showAlertDetails(alert));

    return div;
  }

  acknowledgeAlert(alertId) {
    this.socket.emit('acknowledgeAlert', { alertId });
  }

  markAlertAcknowledged(alertId, acknowledgedBy) {
    const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
    if (alertElement) {
      alertElement.classList.remove('unacknowledged');
      alertElement.classList.add('acknowledged');

      const actionsDiv = alertElement.querySelector('.alert-actions');
      actionsDiv.innerHTML = `<span class="acknowledged-text">Acknowledged by ${acknowledgedBy}</span>`;
    }

    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
    }

    this.updateActiveCount();
  }

  showAlertDetails(alert) {
    const modal = document.getElementById('alert-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    title.textContent = `${alert.alertType.replace('_', ' ').toUpperCase()} Alert`;
    body.innerHTML = `
      <div class="alert-detail">
        <p><strong>Product:</strong> ${alert.productName}</p>
        <p><strong>Current Stock:</strong> ${alert.currentStock}</p>
        <p><strong>Minimum Level:</strong> ${alert.minStockLevel}</p>
        <p><strong>Priority:</strong> ${alert.priority.toUpperCase()}</p>
        <p><strong>Time:</strong> ${this.formatTime(alert.timestamp)}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        ${alert.acknowledged ?
          `<p><strong>Status:</strong> Acknowledged by ${alert.acknowledgedBy} at ${this.formatTime(alert.acknowledgedAt)}</p>` :
          '<p><strong>Status:</strong> Unacknowledged</p>'
        }
      </div>
    `;

    modal.style.display = 'flex';
  }

  showNotification(alert) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Stock Alert: ${alert.productName}`, {
        body: alert.message,
        icon: '/alert-icon.png',
        tag: `alert-${alert.id}`
      });
    }
  }

  playAlertSound(priority) {
    // Play different sounds based on priority
    const audio = new Audio();
    switch (priority) {
      case 'critical':
        audio.src = '/sounds/critical-alert.mp3';
        break;
      case 'high':
        audio.src = '/sounds/high-alert.mp3';
        break;
      default:
        audio.src = '/sounds/normal-alert.mp3';
    }
    audio.play().catch(e => console.log('Audio play failed:', e));
  }

  updateActiveCount() {
    const activeCount = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged).length;
    document.getElementById('active-count').textContent = activeCount;
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  async loadAlerts() {
    try {
      // Get active alerts
      this.socket.emit('getActiveAlerts');
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }

  setupEventListeners() {
    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('alert-modal').style.display = 'none';
    });

    // Filter controls
    document.getElementById('priority-filter').addEventListener('change', () => this.filterAlerts());
    document.getElementById('type-filter').addEventListener('change', () => this.filterAlerts());
    document.getElementById('show-acknowledged').addEventListener('change', () => this.filterAlerts());

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadAlerts());
  }

  filterAlerts() {
    const priorityFilter = document.getElementById('priority-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const showAcknowledged = document.getElementById('show-acknowledged').checked;

    const alertElements = document.querySelectorAll('.alert-item');

    alertElements.forEach(element => {
      const alertId = element.getAttribute('data-alert-id');
      const alert = this.alerts.get(alertId);

      let show = true;

      if (priorityFilter && alert.priority !== priorityFilter) {
        show = false;
      }

      if (typeFilter && alert.alertType !== typeFilter) {
        show = false;
      }

      if (!showAcknowledged && alert.acknowledged) {
        show = false;
      }

      element.style.display = show ? 'block' : 'none';
    });
  }
}

// Request notification permission
if ('Notification' in window) {
  Notification.requestPermission();
}

// Initialize dashboard
new AlertsDashboard();
```

### CSS Styling

```css
/* alerts.css */
.alerts-dashboard {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}

.alert-stats {
    background: #ff4444;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
}

.alerts-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.filter-controls {
    display: flex;
    gap: 15px;
    align-items: center;
}

.alerts-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 40px;
}

.alert-item {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
    border-left: 5px solid #ddd;
    transition: all 0.3s ease;
}

.alert-item.critical {
    border-left-color: #d63031;
    background: linear-gradient(90deg, #ffeaa7 0%, white 20%);
}

.alert-item.high {
    border-left-color: #ff6b35;
    background: linear-gradient(90deg, #fdcb6e 0%, white 20%);
}

.alert-item.medium {
    border-left-color: #fdcb6e;
}

.alert-item.low {
    border-left-color: #00b894;
}

.alert-item.acknowledged {
    opacity: 0.7;
    background: #f8f9fa;
}

.alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.alert-priority {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    color: white;
}

.alert-priority.critical {
    background: #d63031;
}

.alert-priority.high {
    background: #ff6b35;
}

.alert-priority.medium {
    background: #fdcb6e;
    color: #333;
}

.alert-priority.low {
    background: #00b894;
}

.alert-type {
    font-size: 14px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.alert-time {
    font-size: 12px;
    color: #999;
}

.alert-product {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #333;
}

.alert-message {
    margin: 0 0 10px 0;
    color: #555;
    font-size: 16px;
}

.alert-details {
    display: flex;
    gap: 20px;
    font-size: 14px;
    color: #666;
}

.alert-actions {
    margin-top: 15px;
    display: flex;
    gap: 10px;
}

.acknowledge-btn, .view-details-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
}

.acknowledge-btn {
    background: #0984e3;
    color: white;
}

.acknowledge-btn:hover {
    background: #0761b7;
}

.view-details-btn {
    background: #6c757d;
    color: white;
}

.view-details-btn:hover {
    background: #5a6268;
}

.acknowledged-text {
    color: #28a745;
    font-weight: bold;
    font-style: italic;
}

.alert-history {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 20px;
}

.alert-history-list {
    max-height: 300px;
    overflow-y: auto;
}

/* Modal */
.alert-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    align-items: center;
    justify-content: center;
}

.alert-modal.show {
    display: flex;
}

.alert-modal-content {
    background: white;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
}

.alert-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
}

.alert-modal-header h3 {
    margin: 0;
}

#modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
}

.alert-modal-body {
    padding: 20px;
}

.alert-modal-actions {
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

/* Animations */
@keyframes alertPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}

.alert-item.unacknowledged.critical {
    animation: alertPulse 1s ease-in-out infinite;
}

@keyframes slideIn {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.alert-item {
    animation: slideIn 0.3s ease-out;
}
```

## Usage

1. **Start the Products Service:**
   ```bash
   npm run start:products
   ```

2. **Open the alerts dashboard:**
   ```bash
   npx http-server . -p 8080
   # Visit http://localhost:8080/alerts-dashboard.html
   ```

3. **Test alert system:**
   - Modify product stock via GraphQL
   - Watch real-time alerts appear
   - Test acknowledgment system
   - Check email notifications (if configured)

## Configuration

Add to your `.env` file:

```env
# Alert System Configuration
ALERT_EMAIL_RECIPIENTS=admin@company.com,manager@company.com
FRONTEND_URL=http://localhost:3000

# Alert Thresholds
ALERT_CRITICAL_THRESHOLD=0
ALERT_LOW_THRESHOLD=5
ALERT_MEDIUM_THRESHOLD=10
ALERT_HIGH_THRESHOLD=25
```

This creates a comprehensive real-time alert system that keeps inventory managers informed of critical stock changes instantly.