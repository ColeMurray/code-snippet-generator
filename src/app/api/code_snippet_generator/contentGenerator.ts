import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export class ContentGenerator {
    private preset_name: string | undefined;
    private readonly outputDir: string;

    constructor(preset_name?: string) {
        this.preset_name = preset_name;
        // Create the output directory in public/generated-images
        this.outputDir = path.join(process.cwd(), 'public', 'generated-images');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generateCodeImage(code: string, preset_name?: string): Promise<string> {
        try {
            console.log('Generating code image...');
            console.log('Creating temporary directory...');
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-'));
            const tempFile = path.join(tempDir, 'code_snippet.ts');
            const outputUuid = uuidv4();
            
            console.log(`Writing code to temporary file: ${tempFile}`);
            fs.writeFileSync(tempFile, code);
            
            const command = ['carbon-now', tempFile, '--save-to', tempDir];
            
            if (preset_name || this.preset_name) {
                const selectedPreset = preset_name || this.preset_name || 'dracula';
                console.log(`Using preset: ${selectedPreset}`);
                command.push('-p', selectedPreset);
            }

            console.log('Executing carbon-now command:', command.join(' '));
            const result = spawnSync(command[0], command.slice(1));

            if (result.error) {
                console.error('Error executing carbon-now:', result.error);
                throw result.error;
            }

            if (result.status !== 0) {
                const errorMsg = `Carbon CLI failed with status ${result.status}`;
                console.error(errorMsg);
                if (result.stderr) {
                    console.error('stderr:', result.stderr.toString());
                }
                throw new Error(errorMsg);
            }

            console.log('Looking for generated PNG files...');
            const files = fs.readdirSync(tempDir)
                .filter(file => file.endsWith('.png'));

            if (files.length === 0) {
                const errorMsg = 'No image was generated';
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            console.log(`Found ${files.length} PNG file(s)`);
            const fileName = `${outputUuid}.png`;
            const finalPath = path.join(this.outputDir, fileName);
            console.log(`Copying image to final location: ${finalPath}`);
            fs.copyFileSync(
                path.join(tempDir, files[0]),
                finalPath
            );

            console.log('Cleaning up temporary directory...');
            fs.rmSync(tempDir, { recursive: true });
            
            console.log('Code image generation complete');
            return `/generated-images/${fileName}`; // Return the path relative to public directory
        } catch (e) {
            console.error('Failed to generate code snapshot:', e);
            throw new Error(`Failed to generate code snapshot: ${(e as Error).message}`);
        }
    }

    async generateDiagramImage(diagram_code: string): Promise<string> {
        try {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-'));
            const tempFile = path.join(tempDir, 'diagram.mmd');
            const configFile = path.join(tempDir, 'config.json');
            const outputPath = path.join(tempDir, 'diagram.png');
            const outputUuid = uuidv4();

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

                    const fileName = `${outputUuid}.png`;
                    const finalPath = path.join(this.outputDir, fileName);
                    fs.copyFileSync(outputPath, finalPath);
                    
                    fs.rmSync(tempDir, { recursive: true });
                    resolve(`/generated-images/${fileName}`); // Return the path relative to public directory
                });
            });
        } catch (e) {
            throw new Error(`Failed to generate diagram: ${(e as Error).message}`);
        }
    }
} 