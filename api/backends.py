from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Authenticate against either email or username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        
        try:
            # Try to fetch user by email or username
            user = User.objects.get(
                Q(email=username) | Q(username=username)
            )
        except User.DoesNotExist:
            # Run the default password hasher once to reduce timing difference
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            # If multiple users found, get the first one
            user = User.objects.filter(
                Q(email=username) | Q(username=username)
            ).first()
        
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None