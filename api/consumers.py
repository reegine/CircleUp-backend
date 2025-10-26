# api/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Channel, CommunityMember, ChatMessage
from asgiref.sync import sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.channel_id = self.scope['url_route']['kwargs']['channel_id']
        self.room_group_name = f'chat_{self.channel_id}'
        
        # Check if user has access to this channel
        if await self.has_channel_access():
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
            
            # Notify others that user joined
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_joined',
                    'user_id': str(self.scope["user"].id),
                    'username': self.scope["user"].username
                }
            )
        else:
            await self.close()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            # Notify others that user left
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left', 
                    'user_id': str(self.scope["user"].id),
                    'username': self.scope["user"].username
                }
            )
    
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_type = text_data_json.get('type', 'chat_message')
        
        if message_type == 'chat_message':
            await self.handle_chat_message(text_data_json)
        elif message_type == 'typing_start':
            await self.handle_typing_start()
        elif message_type == 'typing_stop':
            await self.handle_typing_stop()
        elif message_type == 'message_read':
            await self.handle_message_read(text_data_json)
    
    async def handle_chat_message(self, data):
        # Save message to database
        message = await self.save_message(data['message'])
        
        # Broadcast to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': str(message.id),
                    'user_id': str(self.scope["user"].id),
                    'username': self.scope["user"].username,
                    'profile_pic': await self.get_user_profile_pic(),
                    'message': data['message'],
                    'timestamp': message.created_at.isoformat(),
                    'type': 'chat_message'
                }
            }
        )
    
    async def handle_typing_start(self):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_typing',
                'user_id': str(self.scope["user"].id),
                'username': self.scope["user"].username,
                'typing': True
            }
        )
    
    async def handle_typing_stop(self):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_typing', 
                'user_id': str(self.scope["user"].id),
                'username': self.scope["user"].username,
                'typing': False
            }
        )
    
    async def handle_message_read(self, data):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_read',
                'user_id': str(self.scope["user"].id),
                'username': self.scope["user"].username,
                'message_id': data['message_id']
            }
        )
    
    # WebSocket event handlers
    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))
    
    async def user_joined(self, event):
        await self.send(text_data=json.dumps(event))
    
    async def user_left(self, event):
        await self.send(text_data=json.dumps(event))
    
    async def user_typing(self, event):
        await self.send(text_data=json.dumps(event))
    
    async def message_read(self, event):
        await self.send(text_data=json.dumps(event))
    
    @database_sync_to_async
    def has_channel_access(self):
        try:
            channel = Channel.objects.get(id=self.channel_id)
            return CommunityMember.objects.filter(
                community=channel.community,
                user=self.scope["user"]
            ).exists()
        except Channel.DoesNotExist:
            return False
    
    @database_sync_to_async 
    def save_message(self, message_text):
        channel = Channel.objects.get(id=self.channel_id)
        message = ChatMessage.objects.create(
            channel=channel,
            user=self.scope["user"],
            message=message_text
        )
        return message
    
    @database_sync_to_async
    def get_user_profile_pic(self):
        user = self.scope["user"]
        return user.profile_pic.url if user.profile_pic else None

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_authenticated:
            self.user_id = str(self.scope["user"].id)
            self.room_group_name = f'notifications_{self.user_id}'
            
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def user_notification(self, event):
        """Handle user-specific notifications"""
        await self.send(text_data=json.dumps(event))
    
    async def receive(self, text_data):
        # User can mark notifications as read via WebSocket
        data = json.loads(text_data)
        if data.get('type') == 'mark_read':
            await self.mark_notification_read(data['notification_id'])
    
    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        from .models import Notification
        try:
            notification = Notification.objects.get(id=notification_id, user=self.scope["user"])
            notification.is_read = True
            notification.save()
        except Notification.DoesNotExist:
            pass