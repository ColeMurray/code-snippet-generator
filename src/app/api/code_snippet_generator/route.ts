import { codeReviewAgent } from './agent';
import { Swarm, Response as SwarmResponse } from 'swarmjs-node';

interface Message {
  role: string;
  content: string;
  images?: string[];
  error?: boolean;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ message: 'Messages array is required' }), 
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const client = new Swarm();

    console.log('Running agent with messages:', messages);

    // Convert messages to the format expected by the agent
    const formattedMessages = messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await client.run({
      agent: codeReviewAgent, 
      messages: formattedMessages,
      debug: true
    });

    // Extract any generated image paths from the response
    const images = (response as SwarmResponse).messages[-1]["content"].match(/(?:\/[\w-]+\.png)/g) || [];

    console.log('Agent response:', response);

    return new Response(
      JSON.stringify({
        response: response,
        images: images
      }), 
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        message: 'An error occurred while processing your request'
      }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}