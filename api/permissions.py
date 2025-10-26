from rest_framework import permissions

class IsCommunityAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'community'):
            community = obj.community
        else:
            community = obj
        
        membership = community.members.filter(user=request.user).first()
        return membership and membership.role in ['admin', 'moderator']

class IsChannelAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # For POST, check if user is admin of the channel's community
        if request.method == 'POST':
            channel_id = request.data.get('channel')
            if channel_id:
                from .models import Channel
                try:
                    channel = Channel.objects.get(id=channel_id)
                    membership = channel.community.members.filter(user=request.user).first()
                    return membership and membership.role in ['admin', 'moderator']
                except Channel.DoesNotExist:
                    return False
        return True