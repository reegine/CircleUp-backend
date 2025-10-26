# api/notification_service.py
import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

class NotificationService:
    
    @staticmethod
    def send_chat_notification(channel_id, message_data):
        """Send real-time chat notification via WebSocket"""
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{channel_id}",
                {
                    'type': 'chat_message',
                    'message': message_data
                }
            )
            logger.info(f"Chat notification sent to channel {channel_id}")
        except Exception as e:
            logger.error(f"Error sending chat notification: {e}")
    
    @staticmethod
    def send_user_notification(user_id, notification_data):
        """Send personal notification to user via WebSocket"""
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"notifications_{user_id}",
                {
                    'type': 'user_notification', 
                    'notification': notification_data
                }
            )
            logger.info(f"Notification sent to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending user notification: {e}")
    
    @staticmethod
    def notify_mentioned_users(mentioned_users, message_data):
        """Notify users when they're mentioned"""
        for user_id in mentioned_users:
            NotificationService.send_user_notification(
                user_id,
                {
                    'type': 'mention',
                    'message': f"You were mentioned in a chat",
                    'channel_id': message_data.get('channel_id'),
                    'message_id': message_data.get('message_id')
                }
            )