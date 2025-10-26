from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import *

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'profile_pic', 
                 'background_pic', 'bio', 'location', 'date_joined')
        read_only_fields = ('id', 'date_joined')

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    terms_and_service = serializers.BooleanField(write_only=True)
    
    class Meta:
        model = User
        fields = ('email', 'username', 'first_name', 'last_name', 'password', 'terms_and_service')
    
    def validate_terms_and_service(self, value):
        if not value:
            raise serializers.ValidationError("You must accept terms and service.")
        return value
    
    def create(self, validated_data):
        validated_data.pop('terms_and_service')
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    remember_me = serializers.BooleanField(default=False)

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords don't match")
        return attrs

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    new_password = serializers.CharField()
    confirm_password = serializers.CharField()
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

class CommunitySerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    online_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    
    class Meta:
        model = Community
        fields = '__all__'
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_online_count(self, obj):
        return obj.members.filter(is_online=True).count()
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(user=request.user).exists()
        return False
    
    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.members.filter(user=request.user).first()
            return membership.role if membership else None
        return None

class ChannelSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    community = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Channel
        fields = '__all__'
        read_only_fields = ('community', 'created_by')


class PostSerializer(serializers.ModelSerializer):
    posted_by = UserSerializer(read_only=True)
    community = CommunitySerializer(read_only=True)  # Changed from channel to community
    like_count = serializers.SerializerMethodField()
    reaction_count = serializers.SerializerMethodField()
    user_liked = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    community_uuid = serializers.UUIDField(write_only=True)  # Changed from channel_uuid to community_uuid
    
    class Meta:
        model = Post
        fields = [
            'id', 'community', 'community_uuid', 'caption', 'image', 'posted_by', 
            'like_count', 'reaction_count', 'user_liked', 'user_reaction',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'posted_by', 'created_at', 'updated_at', 'community']
    
    def create(self, validated_data):
        # Get the current user from the request context
        user = self.context['request'].user
        
        # Extract community_uuid from validated_data and get the Community instance
        community_uuid = validated_data.pop('community_uuid')
        try:
            community = Community.objects.get(id=community_uuid)
        except Community.DoesNotExist:
            raise serializers.ValidationError({"community_uuid": "Community not found"})
        
        # Create the post with the Community instance
        post = Post.objects.create(
            posted_by=user,
            community=community,
            **validated_data
        )
        
        return post

    # Remove the get_community method since we now have community as a direct field
    # Keep the other methods (like_count, reaction_count, etc.) the same
    
    def get_like_count(self, obj):
        return obj.likes.count()
    
    def get_reaction_count(self, obj):
        return obj.reactions.count()
    
    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            reaction = obj.reactions.filter(user=request.user).first()
            return reaction.reaction_type if reaction else None
        return None

class EventSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    community = CommunitySerializer(read_only=True)
    channel = ChannelSerializer(read_only=True)
    participant_count = serializers.SerializerMethodField()
    is_participant = serializers.SerializerMethodField()
    
    # Add these fields for creation
    community_uuid = serializers.UUIDField(write_only=True, required=True)
    channel_uuid = serializers.UUIDField(write_only=True, required=False)
    create_new_channel = serializers.BooleanField(write_only=True, default=False)
    channel_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = Event
        fields = [
            'id', 'community', 'community_uuid', 'channel', 'channel_uuid', 
            'create_new_channel', 'channel_name', 'name', 'description', 
            'date', 'time', 'location', 'created_by', 'participant_count', 
            'is_participant', 'created_at'  # REMOVED 'updated_at' from here
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'community', 'channel']  # REMOVED 'updated_at' from here too
    
    def get_participant_count(self, obj):
        return obj.participants.count()
    
    def get_is_participant(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.participants.filter(user=request.user).exists()
        return False
    
    def validate(self, attrs):
        # Validate that either channel_uuid OR create_new_channel is provided
        channel_uuid = attrs.get('channel_uuid')
        create_new_channel = attrs.get('create_new_channel', False)
        channel_name = attrs.get('channel_name')
        
        if not channel_uuid and not create_new_channel:
            raise serializers.ValidationError({
                "error": "Either provide an existing channel_uuid or set create_new_channel=true"
            })
        
        if create_new_channel and not channel_name:
            raise serializers.ValidationError({
                "channel_name": "Channel name is required when creating a new channel"
            })
        
        if channel_uuid and create_new_channel:
            raise serializers.ValidationError({
                "error": "Cannot provide both channel_uuid and create_new_channel=true"
            })
        
        return attrs
    
    def create(self, validated_data):
        request = self.context.get('request')
        community_uuid = validated_data.pop('community_uuid')
        channel_uuid = validated_data.pop('channel_uuid', None)
        create_new_channel = validated_data.pop('create_new_channel', False)
        channel_name = validated_data.pop('channel_name', None)
        
        # Get the community
        try:
            community = Community.objects.get(id=community_uuid)
        except Community.DoesNotExist:
            raise serializers.ValidationError({"community_uuid": "Community not found"})
        
        # Handle channel logic
        channel = None
        if channel_uuid:
            # Use existing channel
            try:
                channel = Channel.objects.get(id=channel_uuid, community=community)
            except Channel.DoesNotExist:
                raise serializers.ValidationError({"channel_uuid": "Channel not found in this community"})
        elif create_new_channel:
            # Create new channel
            channel = Channel.objects.create(
                name=channel_name or f"Event: {validated_data['name']}",
                description=f"Channel for event: {validated_data['name']}",
                community=community,
                created_by=request.user
            )
        
        # Create the event
        event = Event.objects.create(
            community=community,
            channel=channel,
            created_by=request.user,
            **validated_data
        )
        
        return event

class ChatReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatReaction
        fields = ['id', 'user', 'reaction_type', 'created_at']

class ChatMessageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    channel = ChannelSerializer(read_only=True)
    reply_to = serializers.PrimaryKeyRelatedField(queryset=ChatMessage.objects.all(), required=False, allow_null=True)
    mentions = UserSerializer(many=True, read_only=True)
    reactions = ChatReactionSerializer(many=True, read_only=True)
    reaction_count = serializers.SerializerMethodField()
    user_reacted = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'channel', 'user', 'message', 'reply_to', 'mentions', 
            'reactions', 'reaction_count', 'user_reacted',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'mentions']
    
    def get_reaction_count(self, obj):
        return obj.reactions.count()
    
    def get_user_reacted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.reactions.filter(user=request.user).exists()
        return False
    
    def create(self, validated_data):
        mentioned_users = validated_data.pop('mentioned_users', [])
        request = self.context.get('request')
        
        # Create the message
        message = ChatMessage.objects.create(
            user=request.user,
            **validated_data
        )
        
        # Add mentions
        if mentioned_users:
            users_to_mention = User.objects.filter(id__in=mentioned_users)
            message.mentions.set(users_to_mention)
            
            # Create notifications for mentioned users
            for mentioned_user in users_to_mention:
                if mentioned_user != request.user:  # Don't notify self
                    Notification.objects.create(
                        user=mentioned_user,
                        notification_type='chat_mention',
                        title=f"You were mentioned by {request.user.username}",
                        message=f"{request.user.username} mentioned you in {message.channel.name}",
                        community=message.channel.community,
                        channel=message.channel,
                        chat_message=message
                    )
        
        return message

class ChatMessageCreateSerializer(serializers.ModelSerializer):
    mentioned_users = serializers.ListField(
        child=serializers.UUIDField(), 
        required=False,
        write_only=True
    )
    mentions = UserSerializer(many=True, read_only=True)
    channel = serializers.PrimaryKeyRelatedField(
        queryset=Channel.objects.all(), 
        required=False  # Make this field optional
    )
    
    class Meta:
        model = ChatMessage
        fields = ['channel', 'message', 'reply_to', 'mentioned_users', 'mentions']
    
    def create(self, validated_data):
        # Always remove user from validated_data to be safe
        validated_data.pop('user', None)
        
        # Extract mentioned_users
        mentioned_users = validated_data.pop('mentioned_users', [])
        request = self.context.get('request')
        
        # Create the message
        message = ChatMessage.objects.create(
            user=request.user,
            **validated_data
        )
        
        # Add mentions to the message
        if mentioned_users:
            users_to_mention = User.objects.filter(id__in=mentioned_users)
            message.mentions.set(users_to_mention)
            
            # Create notifications for mentioned users
            for mentioned_user in users_to_mention:
                if mentioned_user != request.user:  # Don't notify self
                    Notification.objects.create(
                        user=mentioned_user,
                        notification_type='chat_mention',
                        title=f"You were mentioned by {request.user.username}",
                        message=f"{request.user.username} mentioned you in {message.channel.name}",
                        community=message.channel.community,
                        channel=message.channel,
                        chat_message=message
                    )
        
        return message

class ChatMessageReplySerializer(serializers.ModelSerializer):
    mentioned_users = serializers.ListField(
        child=serializers.UUIDField(), 
        required=False,
        write_only=True
    )
    mentions = UserSerializer(many=True, read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = ['message', 'mentioned_users', 'mentions']  # No channel field
    
    def create(self, validated_data):
        # Extract mentioned_users
        mentioned_users = validated_data.pop('mentioned_users', [])
        request = self.context.get('request')
        
        # Get channel and reply_to from context
        channel = self.context.get('channel')
        reply_to = self.context.get('reply_to')
        
        # Create the message
        message = ChatMessage.objects.create(
            user=request.user,
            channel=channel,
            reply_to=reply_to,
            **validated_data
        )
        
        # Add mentions to the message
        if mentioned_users:
            users_to_mention = User.objects.filter(id__in=mentioned_users)
            message.mentions.set(users_to_mention)
            
            # Create notifications for mentioned users
            for mentioned_user in users_to_mention:
                if mentioned_user != request.user:  # Don't notify self
                    Notification.objects.create(
                        user=mentioned_user,
                        notification_type='chat_mention',
                        title=f"You were mentioned by {request.user.username}",
                        message=f"{request.user.username} mentioned you in {message.channel.name}",
                        community=message.channel.community,
                        channel=message.channel,
                        chat_message=message
                    )
        
        return message

class NotificationSerializer(serializers.ModelSerializer):
    community = CommunitySerializer(read_only=True)
    channel = ChannelSerializer(read_only=True)
    post = PostSerializer(read_only=True)
    chat_message = ChatMessageSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = '__all__'
