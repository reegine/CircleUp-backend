// frontend/src/services/websocketService.js
class WebSocketService {
    constructor() {
        this.chatConnections = new Map();
        this.notificationConnection = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    // Chat WebSocket
    connectToChat(channelId, onMessage, onUserJoin, onUserLeave, onTyping) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat/${channelId}/`;
        
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log(`Connected to chat channel ${channelId}`);
            this.reconnectAttempts = 0;
        };
        
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'chat_message':
                    onMessage(data.message);
                    break;
                case 'user_joined':
                    onUserJoin(data);
                    break;
                case 'user_left':
                    onUserLeave(data);
                    break;
                case 'user_typing':
                    onTyping(data);
                    break;
                case 'message_read':
                    // Handle read receipts
                    break;
            }
        };
        
        socket.onclose = (event) => {
            console.log('Chat WebSocket disconnected');
            this.handleReconnection(channelId, onMessage, onUserJoin, onUserLeave, onTyping);
        };
        
        socket.onerror = (error) => {
            console.error('Chat WebSocket error:', error);
        };
        
        this.chatConnections.set(channelId, socket);
        return socket;
    }
    
    // Notification WebSocket  
    connectToNotifications(onNotification) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
        
        this.notificationConnection = new WebSocket(wsUrl);
        
        this.notificationConnection.onopen = () => {
            console.log('Connected to notifications');
        };
        
        this.notificationConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onNotification(data);
        };
        
        this.notificationConnection.onclose = () => {
            console.log('Notification WebSocket disconnected');
            setTimeout(() => this.connectToNotifications(onNotification), 3000);
        };
        
        return this.notificationConnection;
    }
    
    // Send chat message
    sendChatMessage(channelId, message) {
        const socket = this.chatConnections.get(channelId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'chat_message',
                message: message
            }));
        }
    }
    
    // Typing indicators
    startTyping(channelId) {
        const socket = this.chatConnections.get(channelId);
        if (socket) {
            socket.send(JSON.stringify({ type: 'typing_start' }));
        }
    }
    
    stopTyping(channelId) {
        const socket = this.chatConnections.get(channelId);
        if (socket) {
            socket.send(JSON.stringify({ type: 'typing_stop' }));
        }
    }
    
    // Reconnection logic
    handleReconnection(channelId, onMessage, onUserJoin, onUserLeave, onTyping) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Reconnecting to chat ${channelId}... Attempt ${this.reconnectAttempts}`);
                this.connectToChat(channelId, onMessage, onUserJoin, onUserLeave, onTyping);
            }, 3000 * this.reconnectAttempts); // Exponential backoff
        }
    }
    
    // Close connections
    disconnectFromChannel(channelId) {
        const socket = this.chatConnections.get(channelId);
        if (socket) {
            socket.close();
            this.chatConnections.delete(channelId);
        }
    }
    
    disconnectAll() {
        this.chatConnections.forEach(socket => socket.close());
        this.chatConnections.clear();
        
        if (this.notificationConnection) {
            this.notificationConnection.close();
            this.notificationConnection = null;
        }
    }
}

export default new WebSocketService();