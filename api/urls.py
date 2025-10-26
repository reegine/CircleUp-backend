from django.urls import path, include
from .views import *
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'communities', CommunityViewSet)
router.register(r'posts', PostViewSet)
router.register(r'events', EventViewSet)
router.register(r'notifications', NotificationViewSet)
router.register(r'channels', ChannelViewSet)
router.register(r'chat-messages', ChatMessageViewSet)

urlpatterns = [
    path('', api_root, name='api-root'),
    path('', include(router.urls)),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/jwt/blacklist/', TokenBlacklistView.as_view(), name='token_blacklist'),
    path('generate-otp/', GenerateOTPView.as_view(), name='generate_otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    path('home/', HomeView.as_view(), name='home'),
]

# Add media URLs in development
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)