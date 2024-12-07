import { Agent, AgentFunction } from 'swarmjs-node';
import * as logger from 'winston';
import { ContentGenerator } from './contentGenerator';

// Configure logging
logger.configure({
    level: 'info',
    format: logger.format.simple(),
    transports: [
        new logger.transports.Console()
    ]
});

// Define interfaces and types
interface CodeSnippet {
    snippet: string;
    description: string;
    importance_score: number;
}

interface GeneratedSnippet {
    snippet: CodeSnippet;
    image_path: string;
}

enum ContentType {
    CODE = "code",
    DIAGRAM = "diagram",
    TEXT = "text"
}

const receiveImportantCodeSnippets: AgentFunction = {
    name: 'receive_important_code_snippets',
    func: async ({ snippets }): Promise<string> => {
        logger.info('Received important code snippets for processing.');
        
        try {
            const contentGenerator = new ContentGenerator('dracula');
            
            logger.info('Received snippets:', snippets);
            const codeSnippetsWithImages: GeneratedSnippet[] = [];

            for (const snippet of snippets) {
                logger.info(`Processing snippet: ${snippet.description}`);
                try {
                    const image_path = await contentGenerator.generateCodeImage(snippet.snippet);
                    logger.info(`Generated image: ${image_path}`);
                    codeSnippetsWithImages.push({ snippet, image_path });
                } catch (e) {
                    logger.error(`Failed to generate image: ${(e as Error).message}`);
                }
            }

            logger.info('Generated images:', codeSnippetsWithImages);

            return JSON.stringify(codeSnippetsWithImages);
        } catch (error) {
            logger.error('Error processing snippets:', error);
            throw new Error(`Failed to process snippets: ${(error as Error).message}`);
        }
    },
    descriptor: {
        name: 'receive_important_code_snippets',
        description: 'Processes the received code snippets and generates images.',
        parameters: {
            snippets: {
                type: 'array',
                required: true,
                description: 'Array of code snippets to process',
                items: {
                    type: 'object',
                    required: true,
                    description: 'A code snippet object containing the snippet text, description, and importance score',
                    properties: {
                        snippet: {
                            type: 'string',
                            required: true,
                            description: 'The actual code snippet text'
                        },
                        description: {
                            type: 'string',
                            required: true,
                            description: 'Description of what the code snippet does'
                        },
                        importance_score: {
                            type: 'number',
                            required: true,
                            description: 'Numerical score (1-10) indicating the importance of the snippet'
                        }
                    }
                }
            }
        }
    }
};

const receiveThread: AgentFunction = {
    name: 'receive_thread',
    func: ({ twitter_thread }): string => {
        try {
            logger.info('Received Twitter thread for processing');
            return twitter_thread;
        } catch (error) {
            logger.error('Error processing Twitter thread:', error);
            throw new Error(`Failed to process Twitter thread: ${(error as Error).message}`);
        }
    },
    descriptor: {
        name: 'receive_thread',
        description: 'Receives and processes a Twitter thread',
        parameters: {
            twitter_thread: {
                type: 'string',
                required: true,
                description: 'The Twitter thread content'
            }
        }
    }
};

// Create the main agent
const codeReviewAgent = new Agent({
    name: 'Code Review Assistant',
    model: 'gpt-4o-mini',
    instructions: `You are a Code Review Assistant, tasked with analyzing TypeScript/JavaScript scripts to identify and extract the most important code snippets for educational and social media purposes.

Your responsibilities include:

1. Analyzing the Code: Review the provided script to understand its structure and functionality.
2. Extracting Important Snippets: Identify key functions, classes, or code blocks that are essential for understanding the script.
3. Generating Descriptions: For each extracted snippet, provide a brief description of its purpose.
4. Preparing for Visualization: Pass the extracted snippets to the ContentGenerator tool to create image snapshots suitable for tutorials and social media posts.

Please follow these steps:
1. When you receive the full script, analyze it thoroughly
2. Generate 2-3 of the most important code snippets
3. For each snippet, ensure you include:
   - The code snippet itself
   - A clear description
   - An importance score (1-10)
4. Pass the snippets to receive_important_code_snippets
5. When you receive the response:
   - Parse the returned JSON string to get the generated images and snippets
   - Use this information to create an engaging Twitter thread
   - Send the thread to receive_thread

6. After you have received the thread, send it to the user

// Define interfaces and types
interface CodeSnippet {
    snippet: string;
    description: string;
    importance_score: number;
}

For the Twitter thread:
- Start with an engaging introduction
- Present each snippet with its description and generated image
- Include relevant code insights and tips
- End with a call to action or learning point

Ensure that each snippet is relevant, well-described, and suitable for visual representation.`,
    functions: [receiveImportantCodeSnippets, receiveThread]
});

// Export the modules
export {
    ContentGenerator,
    codeReviewAgent,
    receiveImportantCodeSnippets,
    receiveThread,
    ContentType
};