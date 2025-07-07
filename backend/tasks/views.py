from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Task
from .serializers import TaskSerializer
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get_serializer(self, *args, **kwargs):
        kwargs['partial'] = True  # Enable partial updates for PUT requests
        return super().get_serializer(*args, **kwargs)

    def perform_update(self, serializer):
        logger.info(f"Performing update with validated data: {serializer.validated_data}")
        try:
            instance = serializer.save()
            logger.info(f"Updated instance data: {instance.__dict__}")
            # Refresh from database to confirm
            instance.refresh_from_db()
            logger.info(f"Refreshed instance data: {instance.__dict__}")
            if 'is_completed' in serializer.validated_data:
                if instance.is_completed != serializer.validated_data['is_completed']:
                    instance.is_completed = serializer.validated_data['is_completed']
                    instance.save(update_fields=['is_completed'])
                    logger.info(f"Forced is_completed to {instance.is_completed}")
                    instance.refresh_from_db()  # Confirm after force
                    logger.info(f"Final instance data: {instance.__dict__}")
        except Exception as e:
            logger.error(f"Error in perform_update: {str(e)}")
            raise

@api_view(['GET'])
def prioritize_task(request):
    tasks = Task.objects.filter(is_completed=False, deadline__gte=timezone.now())
    if not tasks:
        return Response({'most_important_task': None})

    urgency_keywords = ['urgent', 'important', 'critical', 'priority']
    max_score = 0
    mit = None

    for task in tasks:
        score = 0
        title_lower = task.title.lower()
        for keyword in urgency_keywords:
            if keyword in title_lower:
                score += 10
        time_diff = (task.deadline - timezone.now()).total_seconds() / 3600
        if time_diff < 24:
            score += 20
        elif time_diff < 168:
            score += 10
        if score > max_score:
            max_score = score
            mit = task

    serializer = TaskSerializer(mit)
    return Response({'most_important_task': serializer.data})