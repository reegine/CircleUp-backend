# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Admin & API
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # hapus baris ini kalau tidak punya app api

    # ===== PAGES (no .html) =====
     path('', TemplateView.as_view(template_name='circleup/login.html'), name='login'),
    path('home/',             TemplateView.as_view(template_name='circleup/home.html'),        name='home'),
    path('explore/',     TemplateView.as_view(template_name='circleup/explore.html'),     name='explore'),
    path('notifications/', TemplateView.as_view(template_name='circleup/notifications.html'), name='notifications'),
    path('chat/',        TemplateView.as_view(template_name='circleup/chat.html'),        name='chat'),
    path('feeds/',       TemplateView.as_view(template_name='circleup/feeds.html'),       name='feeds'),
    path('event-info/',  TemplateView.as_view(template_name='circleup/event-info.html'),  name='event_info'),
    path('members/',     TemplateView.as_view(template_name='circleup/members.html'),     name='members'),
    path('about/',       TemplateView.as_view(template_name='circleup/about.html'),       name='about'),
    path('forgot-password/',  TemplateView.as_view(template_name='circleup/forgot-password.html'),  name='forgot_password'),
    path('verify-otp/',       TemplateView.as_view(template_name='circleup/verify-otp.html'),       name='verify_otp'),
    path('reset-password/',   TemplateView.as_view(template_name='circleup/reset-password.html'),   name='reset_password'),
    path('register/',         TemplateView.as_view(template_name='circleup/register.html'),         name='register'),
    path('profile/',          TemplateView.as_view(template_name='circleup/profile-and-edit.html'), name='profile'),
    path('change-password/', TemplateView.as_view(template_name='circleup/change-password.html'), name='change_password'),
    path('login/',          TemplateView.as_view(template_name='circleup/login.html'), name='login'),
]

# Static/media saat development (aman dibiarkan)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
