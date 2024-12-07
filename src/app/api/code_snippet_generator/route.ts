import { codeReviewAgent } from './agent';
import { Swarm, Response as SwarmResponse } from 'swarmjs-node';

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

const createJsonResponse = (body: any, status: number) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const formatMessages = (messages: Message[]) => {
  return messages.map((msg: Message) => {
    const formattedMsg: any = {
      role: msg.role,
      content: msg.content
    };

    if (msg.name) {
      formattedMsg.name = msg.name;
    }

    if (msg.tool_calls) {
      formattedMsg.tool_calls = msg.tool_calls;
    }

    if (msg.function_call) {
      formattedMsg.function_call = msg.function_call;
    }

    if (msg.tool_call_id) {
      formattedMsg.tool_call_id = msg.tool_call_id;
    }

    return formattedMsg;
  });
};

const extractImagePaths = (response: SwarmResponse) => {
  return response.messages[response.messages.length - 1].content.match(/\/generated-images\/[\w-]+\.png/g) || [];
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return createJsonResponse({ message: 'Messages array is required' }, 400);
    }

    const client = new Swarm();
    const formattedMessages = formatMessages(messages);

    console.log('Running agent with messages:', messages);
    console.log('Agent:', codeReviewAgent);

    const response = await client.run({
      agent: codeReviewAgent,
      messages: formattedMessages, 
      debug: true
    });

    console.log('Agent response:', response);

    const images = extractImagePaths(response as SwarmResponse);

    return createJsonResponse({
      response,
      images
    }, 200);

  } catch (error) {
    console.error('Error processing request:', error);
    return createJsonResponse({
      message: 'An error occurred while processing your request'
    }, 500);
  }
}