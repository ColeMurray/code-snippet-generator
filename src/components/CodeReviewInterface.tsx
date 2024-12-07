'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Code, AlertCircle, Loader } from 'lucide-react';

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface FunctionCall {
  name: string;
  arguments: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  function_call?: FunctionCall;
  tool_call_id?: string;
  images?: string[];
  error?: boolean;
}

const CodeReviewInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      role: 'user',
      content: inputValue
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/code_snippet_generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response.messages?.[data.response.messages.length - 1]?.content || data.response,
        images: data.images || []
      };

      if (data.response.messages?.[data.response.messages.length - 1]?.tool_calls) {
        assistantMessage.tool_calls = data.response.messages[data.response.messages.length - 1].tool_calls;
      }

      if (data.response.messages?.[data.response.messages.length - 1]?.function_call) {
        assistantMessage.function_call = data.response.messages[data.response.messages.length - 1].function_call;
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'An error occurred while processing your request.',
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (message: Message) => {
    return (
      <>
        {message.error && (
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Error</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.tool_calls && (
          <div className="mt-2 text-sm text-gray-600">
            <div className="font-medium">Tool Calls:</div>
            {message.tool_calls.map((tool, index) => (
              <div key={tool.id} className="mt-1">
                <div>Function: {tool.function.name}</div>
                <pre className="bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                  {tool.function.arguments}
                </pre>
              </div>
            ))}
          </div>
        )}
        {message.function_call && (
          <div className="mt-2 text-sm text-gray-600">
            <div className="font-medium">Function Call:</div>
            <div className="mt-1">
              <div>Function: {message.function_call.name}</div>
              <pre className="bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                {message.function_call.arguments}
              </pre>
            </div>
          </div>
        )}
        {message.images?.map((image, imgIndex) => (
          <img
            key={imgIndex}
            src={image}
            alt={`Code snippet ${imgIndex + 1}`}
            className="mt-2 rounded-md max-w-full"
          />
        ))}
      </>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center space-x-2">
          <Code className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Code Review Assistant</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.error
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-white shadow-sm border border-gray-200'
                }`}
              >
                {renderMessageContent(message)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg px-4 py-2">
                <Loader className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your code or message here..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white rounded-lg px-6 py-2 flex items-center space-x-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CodeReviewInterface;