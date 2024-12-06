import { Agent, AgentFunction } from 'swarmjs-node';
import { runDemoLoop } from 'swarmjs-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import * as logger from 'winston';

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

class ContentGenerator {
    private preset_name: string | undefined;

    constructor(preset_name?: string) {
        this.preset_name = preset_name;
    }

    async generateCodeImage(code: string, preset_name?: string): Promise<string> {
        try {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-'));
            const tempFile = path.join(tempDir, 'code_snippet.ts');
            const outputUuid = uuidv4();

            logger.info(`Generating image for code snippet: ${outputUuid} ${code}`);
            
            fs.writeFileSync(tempFile, code);
            
            const command = ['carbon-now', tempFile, '--save-to', tempDir];
            
            if (preset_name || this.preset_name) {
                command.push('-p', preset_name || this.preset_name || 'dracula');
            }

            return new Promise((resolve, reject) => {
                const process = spawn(command[0], command.slice(1));
                
                process.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error('Carbon CLI failed'));
                        return;
                    }

                    const files = fs.readdirSync(tempDir)
                        .filter(file => file.endsWith('.png'));

                    if (files.length === 0) {
                        reject(new Error('No image was generated'));
                        return;
                    }

                    const finalPath = `${outputUuid}.png`;
                    fs.copyFileSync(
                        path.join(tempDir, files[0]),
                        finalPath
                    );

                    fs.rmSync(tempDir, { recursive: true });
                    resolve(finalPath);
                });
            });
        } catch (e) {
            throw new Error(`Failed to generate code snapshot: ${(e as Error).message}`);
        }
    }

    async generateDiagramImage(diagram_code: string): Promise<string> {
        try {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-'));
            const tempFile = path.join(tempDir, 'diagram.mmd');
            const configFile = path.join(tempDir, 'config.json');
            const outputPath = path.join(tempDir, 'diagram.png');

            // Write diagram code
            fs.writeFileSync(tempFile, diagram_code);

            // Create mermaid configuration
            const config = {
                theme: "default",
                background: "#ffffff",
                outputFormat: "png",
                height: 1200,
                backgroundColor: "#ffffff"
            };

            fs.writeFileSync(configFile, JSON.stringify(config));

            const command = [
                'mmdc',
                '-w', '2048',
                '-i', tempFile,
                '-o', outputPath,
                '-c', configFile,
                '-b', 'transparent'
            ];

            return new Promise((resolve, reject) => {
                const process = spawn(command[0], command.slice(1));

                process.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error('Mermaid CLI failed'));
                        return;
                    }

                    const finalPath = 'diagram.png';
                    fs.copyFileSync(outputPath, finalPath);
                    
                    fs.rmSync(tempDir, { recursive: true });
                    resolve(finalPath);
                });
            });
        } catch (e) {
            throw new Error(`Failed to generate diagram: ${(e as Error).message}`);
        }
    }
}

const receiveImportantCodeSnippets: AgentFunction = {
    name: 'receive_important_code_snippets',
    func: async ({ snippetsJson }): Promise<string> => {
        logger.info('Received important code snippets for processing.');
        
        try {
            const contentGenerator = new ContentGenerator('dracula');
            
            const snippets: CodeSnippet[] = JSON.parse(snippetsJson)['items'];
            logger.info('Received snippets:', snippets);
            const codeSnippetsWithImages: GeneratedSnippet[] = [];

            for (let [idx, snippet] of snippets.entries()) {
                logger.info(`Processing snippet ${idx + 1}: ${snippet.description}`);
                try {
                    const image_path = await contentGenerator.generateCodeImage(snippet.snippet);
                    logger.info(`Generated image for snippet ${idx + 1}: ${image_path}`);
                    codeSnippetsWithImages.push({ snippet, image_path });
                } catch (e) {
                    logger.error(`Failed to generate image for snippet ${idx + 1}: ${(e as Error).message}`);
                }
            }

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
            snippetsJson: {
                type: 'string',
                required: true,
                description: 'JSON string containing array of code snippets to process. Expected format { "items": [{ snippet: string, description: string, importance_score: number }]}'
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
4. Convert your snippets array to a JSON string and pass it to receive_important_code_snippets
5. When you receive the response:
   - Parse the returned JSON string to get the generated images and snippets
   - Use this information to create an engaging Twitter thread
   - Send the thread to receive_thread

Important: Always serialize arrays to JSON strings before passing them to functions, and parse JSON strings when receiving them back. This is required due to the framework's limitations with complex types.

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