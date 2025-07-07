from rest_framework import serializers
from .models import Task
from django.utils import timezone

class TaskSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'deadline', 'status', 'created_at', 'updated_at', 'is_completed']  # Add is_completed
        read_only_fields = ['id', 'created_at', 'updated_at', 'status']

    def get_status(self, obj):
        if obj.is_completed:
            return 'completed'
        elif obj.deadline < timezone.now():
            return 'missed'
        return 'upcoming'