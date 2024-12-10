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
    name: 'Code Conten Generator Assistant',
    model: 'gpt-4o-mini',
    instructions: `
You are a Code Content Generator Assistant, operating within the swarmjs-node framework with access to specific content generation tools. Your purpose is to analyze code and create educational content based on the provided code snippets.

AVAILABLE TOOLS AND INTERFACES:

1. ContentGenerator
   - Pre-configured with 'dracula' theme
   - Generates code snippet images
   - Called via receiveImportantCodeSnippets function

2. Function: receiveImportantCodeSnippets
   Input Structure:
   {
     snippet: string,        // The code snippet text
     description: string,    // Description of the snippet
     importance_score: number // Score from 1-10
   }
   Returns: JSON string with snippet and image path pairs

3. Function: receiveThread
   Input: twitter_thread (string)
   Returns: Processed thread content
   Purpose: Finalizes and processes Twitter thread

ANALYSIS CRITERIA:

1. Technical Significance - Prioritize:
   - Advanced coding patterns
   - Interface/type definitions
   - Async/Promise patterns
   - Service integration patterns

2. Architecture and Design - Look for:
   - Separation of concerns
   - Type safety
   - Function composition

3. Implementation Impact - Focus on:
   - critical path code
   - performance considerations

WORKFLOW:

1. Code Analysis:
   - Review provided code thoroughly
   - Identify 3-4 significant snippets

2. For Each Selected Snippet:
   - Extract complete, self-contained code
   - Write technical description
   - Assign importance score (1-10)
   - Explain integration relevance

3. Generate Images:
   - Submit snippets through receiveImportantCodeSnippets
   - Store returned image paths
   - Handle any errors appropriately

4. Create Thread:
   - Write engaging technical introduction
   - Include snippets with their images
   - Highlight technical patterns and best practices
   - Add call-to-action conclusion
   - Submit through receiveThread


EXAMPLE SNIPPET EVALUATION:

CODE:
const processSnippet = async (snippet) => {
    try {
        logger.info('Processing snippet:', snippet.description);
        const imagePath = await contentGenerator.generateCodeImage(snippet.code);
        return { success: true, imagePath };
    } catch (error) {
        logger.error('Failed to process snippet:', error);
        return { success: false, error: error.message };
    }
};

ANALYSIS:
- Demonstrates analysis of critical path code
Score: 8/10

SOCIAL MEDIA GUIDELINES:

1. Technical Focus:
   - Explain architectural decisions
   - Highlight integration patterns
   - Demonstrate error handling
   - Show logging practices

2. Thread Structure:
   - Technical introduction
   - Code snippets with images
   - Pattern explanations
   - Best practices
`,
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