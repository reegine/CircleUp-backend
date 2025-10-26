from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.conf import settings
import random
import string
from .models import *
from .serializers import *
from .permissions import *
from rest_framework_simplejwt.views import TokenBlacklistView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count
import json
from .notification_service import NotificationService  # Add this instead



# Make API root public
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def api_root(request):
    return Response({
        'message': 'CircleUp API - JWT Authentication Enabled',
        'endpoints': {
            'auth': {
                'login': '/api/auth/login/',
                'register': '/api/auth/register/',
                'logout': '/api/auth/jwt/blacklist/',
                'forgot_password': {
                    'generate_otp': '/api/generate-otp/',
                    'verify_otp': '/api/verify-otp/',
                    'reset_password': '/api/reset-password/'
                }
            },
            'users': '/api/users/',
            'communities': '/api/communities/',
            'posts': '/api/posts/',
            'events': '/api/events/',
            'notifications': '/api/notifications/',
            'home': '/api/home/'
        },
        'authentication': 'Use JWT tokens in Authorization header: Bearer <token>'
    })


# Make auth endpoints public
class CustomTokenObtainPairView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            remember_me = serializer.validated_data['remember_me']
            
            # Use Django's authenticate with our custom backend
            # Note: we pass email as 'username' parameter
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                refresh = RefreshToken.for_user(user)
                return Response({
                    'message': 'Login successful',
                    'user': UserSerializer(user).data,
                    'tokens': {
                        'access': str(refresh.access_token),
                        'refresh': str(refresh),
                    }
                })
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenBlacklistView(TokenBlacklistView):
    def post(self, request, *args, **kwargs):
        # Call the parent class's post method to perform the blacklisting
        response = super().post(request, *args, **kwargs)
        
        # If the blacklist was successful (status code 200), customize the response
        if response.status_code == status.HTTP_200_OK:
            return Response({
                "message": "Token blacklisted successfully"
            }, status=status.HTTP_200_OK)
        
        # Return the original response for error cases
        return response

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'User registered successfully',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GenerateOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            
            # Generate 6-digit OTP
            otp_code = ''.join(random.choices(string.digits, k=6))
            
            # Save OTP to database
            OTP.objects.create(email=email, otp_code=otp_code)
            
            # Send email (configure email settings in your Django settings)
            send_mail(
                'Password Reset OTP',
                f'Your OTP code is: {otp_code}',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
            
            return Response({'message': 'OTP sent to email'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            otp_code = serializer.validated_data['otp_code']
            
            otp = OTP.objects.filter(email=email, otp_code=otp_code, is_used=False).first()
            if otp:
                otp.is_used = True
                otp.save()
                return Response({'message': 'OTP verified successfully'})
            return Response({'error': 'Invalid OTP'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            new_password = serializer.validated_data['new_password']
            
            try:
                user = User.objects.get(email=email)
                user.set_password(new_password)
                user.save()
                return Response({'message': 'Password reset successfully'})
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.IsAuthenticated]  # Require authentication

    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({'error': 'Wrong old password'}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password changed successfully'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def profile(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class CommunityViewSet(viewsets.ModelViewSet):
    queryset = Community.objects.all()
    serializer_class = CommunitySerializer
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.IsAuthenticated]  # Require authentication
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        # Save the community first
        community = serializer.save(created_by=self.request.user)
        
        # Automatically make the creator an admin member
        CommunityMember.objects.create(
            community=community,
            user=self.request.user,
            role='admin'  # Set the creator as admin
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Get the total count
        total_count = queryset.count()
        
        # Paginate if needed (optional, but good practice)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                'count': total_count,
                'results': serializer.data
            })
        
        # If not using pagination
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': total_count,
            'results': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        community = self.get_object()
        CommunityMember.objects.get_or_create(
            community=community,
            user=request.user,
            defaults={'role': 'member'}
        )
        return Response({'message': 'Joined community successfully'})
    
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        community = self.get_object()
        CommunityMember.objects.filter(community=community, user=request.user).delete()
        return Response({'message': 'Left community successfully'})
    
    @action(detail=False, methods=['get'])
    def joined(self, request):
        joined_communities = Community.objects.filter(members__user=request.user)
        serializer = self.get_serializer(joined_communities, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def explore(self, request):
        # Get communities not joined by user, ordered by member count (popularity)
        explored_communities = Community.objects.exclude(
            members__user=request.user
        ).annotate(
            member_count=Count('members')
        ).order_by('-member_count')
        
        serializer = self.get_serializer(explored_communities, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.GET.get('q', '')
        communities = Community.objects.filter(name__icontains=query)
        serializer = self.get_serializer(communities, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsCommunityAdmin])
    def add_channel(self, request, pk=None):
        community = self.get_object()
        serializer = ChannelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(community=community, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def channels(self, request, pk=None):
        community = self.get_object()
        channels = community.channels.all()
        serializer = ChannelSerializer(channels, many=True)
        return Response(serializer.data)

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    # permission_classes = [permissions.IsAuthenticated, IsChannelAdmin]
    permission_classes = [permissions.IsAuthenticated]  # Require authentication
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
            return Response({'message': 'Post unliked'})
        return Response({'message': 'Post liked'})
    
    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        post = self.get_object()
        reaction_type = request.data.get('reaction_type')
        
        if reaction_type not in dict(Reaction.REACTION_TYPES):
            return Response({'error': 'Invalid reaction type'}, status=status.HTTP_400_BAD_REQUEST)
        
        reaction, created = Reaction.objects.get_or_create(
            post=post, 
            user=request.user,
            defaults={'reaction_type': reaction_type}
        )
        
        if not created:
            if reaction.reaction_type == reaction_type:
                reaction.delete()
                return Response({'message': 'Reaction removed'})
            else:
                reaction.reaction_type = reaction_type
                reaction.save()
        
        return Response({'message': 'Reaction added'})

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        # The creation logic is now handled in the serializer
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        event = self.get_object()
        EventParticipant.objects.get_or_create(event=event, user=request.user)
        return Response({'message': 'Joined event successfully'})
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        event = self.get_object()
        EventParticipant.objects.filter(event=event, user=request.user).delete()
        return Response({'message': 'Cancelled event participation'})


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    # permission_classes = [permissions.IsAuthenticated]
    permission_classes = [permissions.IsAuthenticated]  # Require authentication
    
    def get_queryset(self):
        return self.queryset.filter(user=self.request.user).order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'message': 'All notifications marked as read'})

class HomeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        from django.db.models import Count
        
        # Get user's joined communities
        joined_communities = Community.objects.filter(members__user=request.user)
        
        # Get posts from joined communities (CHANGED THIS LINE)
        posts = Post.objects.filter(community__in=joined_communities).order_by('-created_at')
        
        # Get community suggestions (not joined, popular ones)
        suggestions = Community.objects.exclude(
            members__user=request.user
        ).annotate(
            member_count=Count('members')
        ).order_by('-member_count')[:10]
        
        community_serializer = CommunitySerializer(joined_communities, many=True, context={'request': request})
        post_serializer = PostSerializer(posts, many=True, context={'request': request})
        suggestion_serializer = CommunitySerializer(suggestions, many=True, context={'request': request})
        
        return Response({
            'joined_communities': community_serializer.data,
            'posts': post_serializer.data,
            'suggestions': suggestion_serializer.data
        })
    
class ChatMessageViewSet(viewsets.ModelViewSet):
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ChatMessageCreateSerializer
        return ChatMessageSerializer
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        queryset = ChatMessage.objects.all()
        channel_id = self.request.query_params.get('channel_id')
        
        if channel_id:
            queryset = queryset.filter(channel_id=channel_id)
        
        return queryset.select_related('user', 'channel').prefetch_related('reactions', 'mentions')
    
    def perform_create(self, serializer):
        # Make a copy of validated_data and remove user if it exists
        validated_data = serializer.validated_data.copy()
        if 'user' in validated_data:
            validated_data.pop('user')
        
        # Now save with the cleaned data
        message = serializer.save(user=self.request.user)
        
        # Prepare data for WebSocket
        message_data = {
            'id': str(message.id),
            'channel_id': str(message.channel.id),
            'user': {
                'id': str(self.request.user.id),
                'username': self.request.user.username,
                'profile_pic': self.request.user.profile_pic.url if self.request.user.profile_pic else None
            },
            'message': message.message,
            'created_at': message.created_at.isoformat(),
            'type': 'new_message'
        }
        
        # Send via WebSocket with error handling
        try:
            NotificationService.send_chat_notification(str(message.channel.id), message_data)
        except Exception as e:
            print(f"WebSocket notification failed: {e}")
            # Continue anyway - the message was created successfully
        
        # Handle mentions with error handling
        mentioned_users = [str(user.id) for user in message.mentions.all()]
        if mentioned_users:
            try:
                NotificationService.notify_mentioned_users(mentioned_users, message_data)
            except Exception as e:
                print(f"Mention notification failed: {e}")
                # Continue anyway
    
    
    @action(detail=False, methods=['post'])
    def update_presence(self, request):
        channel_id = request.data.get('channel_id')
        is_online = request.data.get('is_online', True)
        
        if channel_id:
            FirebaseService.update_user_presence(
                str(request.user.id),
                channel_id,
                is_online
            )
            return Response({'message': 'Presence updated'})
        return Response({'error': 'Channel ID required'}, status=400)
    
    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        message = self.get_object()
        reaction_type = request.data.get('reaction_type')
        
        if reaction_type not in dict(ChatReaction.REACTION_TYPES):
            return Response({'error': 'Invalid reaction type'}, status=status.HTTP_400_BAD_REQUEST)
        
        reaction, created = ChatReaction.objects.get_or_create(
            message=message, 
            user=request.user,
            reaction_type=reaction_type
        )
        
        if not created:
            reaction.delete()
            action_type = 'removed'
        else:
            action_type = 'added'
            
            # Create notification for message owner if it's not the reactor
            if message.user != request.user:
                Notification.objects.create(
                    user=message.user,
                    notification_type='chat_reaction',
                    title=f"New reaction to your message",
                    message=f"{request.user.username} reacted with {reaction_type} to your message",
                    community=message.channel.community,
                    channel=message.channel,
                    chat_message=message
                )
        
        return Response({'message': f'Reaction {action_type}'})
    
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        original_message = self.get_object()
        
        # Use the dedicated reply serializer
        serializer = ChatMessageReplySerializer(
            data=request.data,
            context={
                'request': request,
                'channel': original_message.channel,
                'reply_to': original_message
            }
        )
        
        if serializer.is_valid():
            # Create the reply message
            reply_message = serializer.save()
            
            # Create notification for original message owner
            if original_message.user != request.user:
                Notification.objects.create(
                    user=original_message.user,
                    notification_type='chat_reply',
                    title=f"New reply to your message",
                    message=f"{request.user.username} replied to your message",
                    community=original_message.channel.community,
                    channel=original_message.channel,
                    chat_message=reply_message
                )
            
            return Response(ChatMessageSerializer(reply_message, context={'request': request}).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ChannelViewSet(viewsets.ModelViewSet):
    queryset = Channel.objects.all()
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Only show channels from communities the user has joined
        user_communities = Community.objects.filter(members__user=self.request.user)
        return Channel.objects.filter(community__in=user_communities)
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        channel = self.get_object()
        messages = channel.chat_messages.all().order_by('created_at')
        page = self.paginate_queryset(messages)
        
        if page is not None:
            serializer = ChatMessageSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        channel = self.get_object()
        members = channel.community.members.filter(is_online=True)
        serializer = UserSerializer(members, many=True)
        return Response(serializer.data)
    