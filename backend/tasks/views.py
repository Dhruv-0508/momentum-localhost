from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Task
from .serializers import TaskSerializer
from django.utils import timezone
import logging
from groq import Groq
import os
import json
import re

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
            if 'is_completed' in serializer.validated_data:
                if instance.is_completed != serializer.validated_data['is_completed']:
                    instance.is_completed = serializer.validated_data['is_completed']
                    instance.save(update_fields=['is_completed'])
                    logger.info(f"Forced is_completed to {instance.is_completed}")
                    instance.refresh_from_db()
                    logger.info(f"Final instance data: {instance.__dict__}")
        except Exception as e:
            logger.error(f"Error in perform_update: {str(e)}")
            raise

@api_view(['GET'])
def prioritize_task(request):
    tasks = Task.objects.filter(is_completed=False, deadline__gte=timezone.now())
    if not tasks:
        return Response({'most_important_task': None})

    # Initialize Groq client
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    # Prepare task data
    task_data = [
        {
            "title": task.title,
            "description": task.description or "",
            "deadline": task.deadline.isoformat(),
            "current_time": timezone.now().isoformat()
        }
        for task in tasks
    ]

    prompt = f"""
    You are an AI task prioritization assistant. Analyze the following tasks and determine the most important one based on urgency (keywords like 'urgent', 'important', 'critical'), deadline proximity, and task description relevance. Return a JSON object with the task index (0-based) of the most important task and a brief explanation.

    Tasks: {task_data}

    Response format:
    {{
        "most_important_task_index": int,
        "reason": string
    }}
    """

    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",  # ✅ Use supported Groq model
            messages=[
                {"role": "system", "content": "You are a task prioritization expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=200
        )

        result = getattr(response.choices[0].message, "content", "").strip()
        logger.info(f"Groq result content:\n{result}")

        # Extract JSON object from response
        match = re.search(r"\{[\s\S]*?\}", result)
        if not match:
            raise ValueError("Failed to extract JSON from Groq response.")

        json_str = match.group(0)
        prioritization = json.loads(json_str)

        mit_index = prioritization["most_important_task_index"]
        mit = tasks[mit_index]
        serializer = TaskSerializer(mit)
        return Response({
            "most_important_task": serializer.data,
            "reason": prioritization["reason"]
        })

    except Exception as e:
        logger.error(f"Error with Groq API: {str(e)}")

        # Fallback: rule-based prioritization
        urgency_keywords = ['urgent', 'important', 'critical', 'priority']
        max_score = 0
        mit = None
        current_time = timezone.now()

        for task in tasks:
            score = 0
            title_lower = task.title.lower()
            desc_lower = task.description.lower() if task.description else ''
            for keyword in urgency_keywords:
                if keyword in title_lower or keyword in desc_lower:
                    score += 10
            time_diff = (task.deadline - current_time).total_seconds() / 3600
            if time_diff < 24:
                score += 20
            elif time_diff < 168:
                score += 10
            if score > max_score:
                max_score = score
                mit = task

        serializer = TaskSerializer(mit)
        return Response({
            "most_important_task": serializer.data if mit else None,
            "reason": f"Fallback: Highest score {max_score} based on keywords and deadline."
        })
