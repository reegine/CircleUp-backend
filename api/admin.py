from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import *

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('is_staff', 'is_active', 'date_joined')
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'profile_pic', 'background_pic', 'bio', 'location')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'first_name', 'last_name', 'password1', 'password2', 'is_staff', 'is_active')}
        ),
    )
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)

class OTPAdmin(admin.ModelAdmin):
    list_display = ('email', 'otp_code', 'created_at', 'is_used')
    list_filter = ('is_used', 'created_at')
    search_fields = ('email', 'otp_code')
    readonly_fields = ('created_at',)

class CommunityMemberInline(admin.TabularInline):
    model = CommunityMember
    extra = 1
    raw_id_fields = ('user',)

class ChannelInline(admin.TabularInline):
    model = Channel
    extra = 1
    raw_id_fields = ('created_by',)

class CommunityAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_by', 'location', 'created_at', 'member_count', 'is_public')
    list_filter = ('is_public', 'created_at', 'location')
    search_fields = ('name', 'bio', 'created_by__username', 'created_by__email')
    readonly_fields = ('created_at', 'invite_link')
    inlines = [CommunityMemberInline, ChannelInline]
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'

class CommunityMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'community', 'role', 'joined_at', 'is_online')
    list_filter = ('role', 'is_online', 'joined_at', 'community')
    search_fields = ('user__username', 'user__email', 'community__name')
    raw_id_fields = ('user', 'community')

class ChannelAdmin(admin.ModelAdmin):
    list_display = ('name', 'community', 'channel_type', 'is_restricted', 'created_by', 'created_at')
    list_filter = ('channel_type', 'is_restricted', 'created_at', 'community')
    search_fields = ('name', 'description', 'community__name', 'created_by__username')
    raw_id_fields = ('community', 'created_by')

class LikeInline(admin.TabularInline):
    model = Like
    extra = 0
    raw_id_fields = ('user',)

class ReactionInline(admin.TabularInline):
    model = Reaction
    extra = 0
    raw_id_fields = ('user',)

class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'community', 'posted_by', 'caption', 'created_at']  # Changed 'channel' to 'community'
    list_filter = ['created_at', 'community', 'posted_by']  # Changed 'channel__community' to 'community', removed 'channel'
    search_fields = ['caption', 'posted_by__username', 'community__name']
    raw_id_fields = ['posted_by', 'community']  # Changed 'channel' to 'community'
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 20

class LikeAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'post__caption')
    raw_id_fields = ('user', 'post')

class ReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'reaction_type', 'created_at')
    list_filter = ('reaction_type', 'created_at')
    search_fields = ('user__username', 'post__caption')
    raw_id_fields = ('user', 'post')

class EventParticipantInline(admin.TabularInline):
    model = EventParticipant
    extra = 1
    raw_id_fields = ('user',)

class EventAdmin(admin.ModelAdmin):
    list_display = ('name', 'community', 'date', 'time', 'location', 'created_by', 'created_at', 'participant_count')
    list_filter = ('date', 'created_at', 'community')
    search_fields = ('name', 'description', 'community__name', 'created_by__username')
    readonly_fields = ('created_at',)
    raw_id_fields = ('community', 'channel', 'created_by')
    inlines = [EventParticipantInline]
    
    def participant_count(self, obj):
        return obj.participants.count()
    participant_count.short_description = 'Participants'

class EventParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'joined_at')
    list_filter = ('joined_at', 'event')
    search_fields = ('user__username', 'event__name')
    raw_id_fields = ('user', 'event')

class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'title_preview', 'community', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('user__username', 'title', 'message', 'community__name')
    readonly_fields = ('created_at',)
    raw_id_fields = ('user', 'community', 'channel', 'post')
    
    def title_preview(self, obj):
        return obj.title[:50] + '...' if len(obj.title) > 50 else obj.title
    title_preview.short_description = 'Title'

# Register all models
admin.site.register(User, CustomUserAdmin)
admin.site.register(OTP, OTPAdmin)
admin.site.register(Community, CommunityAdmin)
admin.site.register(CommunityMember, CommunityMemberAdmin)
admin.site.register(Channel, ChannelAdmin)
admin.site.register(Post, PostAdmin)
admin.site.register(Like, LikeAdmin)
admin.site.register(Reaction, ReactionAdmin)
admin.site.register(Event, EventAdmin)
admin.site.register(EventParticipant, EventParticipantAdmin)
admin.site.register(Notification, NotificationAdmin)