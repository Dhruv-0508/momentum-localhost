from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, prioritize_task

router = DefaultRouter()
router.register(r'tasks', TaskViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('prioritize/', prioritize_task, name='prioritize_task'),
]