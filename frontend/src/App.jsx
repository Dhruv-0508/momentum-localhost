import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import { formatDistanceToNow } from "date-fns";

import "react-datepicker/dist/react-datepicker.css";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [mit, setMit] = useState(null);
  const [mitReason, setMitReason] = useState(""); // NEW
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchMIT();
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks/`);
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch {
      setError("Failed to load tasks.");
    }
  };

  const fetchMIT = async () => {
    try {
      const response = await fetch(`${API_URL}/prioritize/`);
      const data = await response.json();
      setMit(data.most_important_task);
      setMitReason(data.reason || ""); // NEW
      setError(null);
    } catch {
      setError("Failed to load MIT.");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          deadline: selectedDate.toISOString(),
        }),
      });
      if (!response.ok) throw new Error();
      setNewTask({ title: "", description: "" });
      setSelectedDate(new Date());
      fetchTasks();
      fetchMIT();
    } catch {
      setError("Failed to create task.");
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      const taskToUpdate = tasks.find((t) => t.id === id);
      if (!taskToUpdate) throw new Error("Task not found in local state");

      const fullUpdate = {
        ...taskToUpdate,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const response = await fetch(`${API_URL}/tasks/${id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullUpdate),
      });

      const text = await response.text();
      if (!response.ok) {
        try {
          const errorData = JSON.parse(text);
          throw new Error(`Failed to update task: ${JSON.stringify(errorData)}`);
        } catch {
          throw new Error(`Failed to update task: Server error - ${text}`);
        }
      }

      const updatedTaskResponse = await fetch(`${API_URL}/tasks/${id}/`);
      const updatedTask = await updatedTaskResponse.json();
      setTasks(tasks.map((t) => (t.id === id ? updatedTask : t)));
      fetchMIT();
    } catch (error) {
      console.error("Error updating task:", error);
      setError(`Failed to update task: ${error.message}`);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await fetch(`${API_URL}/tasks/${id}/`, { method: "DELETE" });
      fetchTasks();
      fetchMIT();
    } catch {
      setError("Failed to delete task.");
    }
  };

  const buckets = {
    upcoming: tasks.filter((t) => t.status === "upcoming"),
    completed: tasks.filter((t) => t.status === "completed"),
    missed: tasks.filter((t) => t.status === "missed"),
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-4xl font-bold text-center">🚀 Momentum</h1>

        {error && (
          <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>
        )}

        {mit && (
          <Card className="bg-yellow-50 border border-yellow-400">
            <CardHeader>
              <CardTitle>Most Important Task</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{mit.title}</p>
                  <p className="text-sm text-gray-600">{mit.description}</p>
                  <p className="text-xs text-gray-500">
                    Due{" "}
                    {formatDistanceToNow(new Date(mit.deadline), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Badge className="bg-yellow-500 text-white">MIT</Badge>
              </div>
              {mitReason && (
                <p className="text-sm text-gray-700 italic">
                  🧠 Why this task? {mitReason}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask({ ...newTask, title: e.target.value })
                }
                required
              />
              <Textarea
                placeholder="Task description (optional)"
                value={newTask.description}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
              />
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring focus:ring-indigo-200 focus:border-indigo-500"
                  dateFormat="EEE, MMM d, yyyy"
                  minDate={new Date()}
                  showPopperArrow={false}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition duration-200"
              >
                + Add Task
              </Button>
            </form>
          </CardContent>
        </Card>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upcoming">🕒 Upcoming</TabsTrigger>
            <TabsTrigger value="completed">✅ Completed</TabsTrigger>
            <TabsTrigger value="missed">❌ Missed</TabsTrigger>
          </TabsList>
          {["upcoming", "completed", "missed"].map((bucket) => (
            <TabsContent key={bucket} value={bucket} className="space-y-4 mt-4">
              {buckets[bucket].length === 0 ? (
                <p className="text-center text-gray-500">No tasks.</p>
              ) : (
                buckets[bucket].map((task) => (
                  <Card key={task.id}>
                    <CardContent className="flex justify-between items-start gap-4 p-4">
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-sm text-gray-600">
                          {task.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          Due{" "}
                          {formatDistanceToNow(new Date(task.deadline), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 min-w-[180px]">
                        {task.status !== "completed" && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              handleUpdateTask(task.id, {
                                is_completed: true,
                              })
                            }
                            className="flex-1 text-green-500"
                          >
                            Mark Done
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-red-500 flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default App;
