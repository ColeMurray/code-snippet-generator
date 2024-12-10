import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class ContentGenerator {
    private preset_name: string | undefined;
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly cdnDomain: string;

    constructor(preset_name?: string) {
        this.preset_name = preset_name;
        
        // Initialize S3 client
        this.s3Client = new S3Client({
            region: process.env.BAWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.BAWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.BAWS_SECRET_ACCESS_KEY || ''
            }
        });
        
        this.bucketName = process.env.BAWS_S3_BUCKET || '';
        this.cdnDomain = process.env.CDN_DOMAIN || '';
        
        if (!this.bucketName) {
            throw new Error('AWS_S3_BUCKET environment variable is required');
        }
    }

    private async uploadToS3(filePath: string, fileName: string): Promise<string> {
        const fileContent = fs.readFileSync(filePath);
        const key = `generated-images/${fileName}`;
        
        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileContent,
            ContentType: 'image/png'
        }));

        // Return CDN URL if configured, otherwise return S3 URL
        if (this.cdnDomain) {
            return `https://${this.cdnDomain}/${key}`;
        }
        return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    }

    async generateCodeImage(code: string, preset_name?: string): Promise<string> {
        try {
            console.log('Generating code image...');
            console.log('Creating temporary directory...');
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-'));
            const tempFile = path.join(tempDir, 'code_snippet.py');
            const outputUuid = uuidv4();
            
            console.log(`Writing code to temporary file: ${tempFile}`);
            fs.writeFileSync(tempFile, code);
            
            const command = ['carbon-now', tempFile, '--save-to', tempDir];
            
            if (preset_name || this.preset_name) {
                const selectedPreset = 'openai'//preset_name || this.preset_name || 'dracula';
                console.log(`Using preset: ${selectedPreset}`);
                command.push('-p', selectedPreset);
            }

            
            command.push('--config', path.join(process.cwd(), 'src', 'app', 'api', 'code_snippet_generator', 'carbon-now.json'));
            

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
            const generatedFilePath = path.join(tempDir, files[0]);

            console.log('Uploading image to S3...');
            const imageUrl = await this.uploadToS3(generatedFilePath, fileName);

            console.log('Cleaning up temporary directory...');
            fs.rmSync(tempDir, { recursive: true });
            
            console.log('Code image generation complete');
            return imageUrl;
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

                process.on('close', async (code) => {
                    if (code !== 0) {
                        reject(new Error('Mermaid CLI failed'));
                        return;
                    }

                    try {
                        const fileName = `${outputUuid}.png`;
                        const imageUrl = await this.uploadToS3(outputPath, fileName);
                        
                        fs.rmSync(tempDir, { recursive: true });
                        resolve(imageUrl);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } catch (e) {
            throw new Error(`Failed to generate diagram: ${(e as Error).message}`);
        }
    }
} 