import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { agentTypesService } from '../services/agentTypesService.js';

const router = express.Router();

// GET /downloads/:agentName-:platform-:arch(.zip)?
router.get('/:agentName-:platform-:arch', async (req, res) => {
  try {
    let { agentName, platform, arch } = req.params;
    const isZip = req.query.format === 'zip';
    const agentTypeId = req.query.agentTypeId as string;

    // Add .exe extension for Windows binaries
    const extension = platform === 'windows' ? '.exe' : '';
    const binaryFilename = `${agentName}-${platform}-${arch}${extension}`;

    // Construct binary path
    // In Docker, binaries are mounted to /app/agent-binaries
    // In development, they're in ../../../apps/agents/dnapulse-agent/build
    const baseBinaryPath = fs.existsSync('/app/agent-binaries')
      ? path.join('/app/agent-binaries', binaryFilename)
      : path.join(process.cwd(), '../../../apps/agents/dnapulse-agent/build', binaryFilename);

    console.log('Download request:', {
      agentName,
      platform,
      arch,
      baseBinaryPath,
      isZip,
      agentTypeId,
    });

    if (!fs.existsSync(baseBinaryPath)) {
      console.error('Binary not found:', baseBinaryPath);
      return res.status(404).json({
        error: 'Binary not found',
        path: baseBinaryPath,
        message:
          'The requested agent binary does not exist. Please build it first using the Makefile.',
      });
    }

    // If .zip requested, package binary + config template
    if (isZip) {
      // Create temp dir
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnapulse-agent-'));
      const binaryDest = path.join(tmpDir, binaryFilename);
      const configPath = path.join(tmpDir, 'agent.yaml');

      // Copy binary
      fs.copyFileSync(baseBinaryPath, binaryDest);

      // Create config template with API_KEY placeholder and agent_type_id
      const configTemplate = [
        '# DNA Pulse Agent Configuration',
        '# Edit the API key below before running the agent.',
        '',
        'agent:',
        `  name: "${agentName}-server-01"`,
        `  type: "${agentName}"`,
        `  type_id: "${agentTypeId || ''}"  # Agent Type ID (required for registration)`,
        '  version: "1.0.0"',
        '  platform: "linux"',
        '',
        'ingestion:',
        '  url: "http://localhost:19071"',
        '  api_key: "YOUR_API_KEY_HERE"',
        '',
        'collection:',
        '  enabled: true',
        '  interval: 30s',
        '  sources:',
        '    - type: "system_metrics"',
        '      enabled: true',
        '',
        '# After editing this file, you can register the agent with:',
        '#   ./linux-resource-monitor-linux-amd64 -config ./agent.yaml -register',
        '',
      ].join('\n');
      fs.writeFileSync(configPath, configTemplate, 'utf-8');

      const zipFilename = `${agentName}-${platform}-${arch}.zip`;
      const zipPath = path.join(os.tmpdir(), zipFilename);

      // Create zip using system zip command
      const zip = spawn('zip', ['-j', zipPath, binaryDest, configPath]);

      zip.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(zipPath)) {
          console.error('Zip command failed with code', code);
          return res.status(500).json({ error: 'Failed to create zip package' });
        }

        res.download(zipPath, zipFilename, (err) => {
          try {
            // Cleanup temp files
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(binaryDest)) fs.unlinkSync(binaryDest);
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
            if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
          } catch (cleanupErr) {
            console.error('Cleanup error after zip download:', cleanupErr);
          }

          if (err) {
            console.error('Download zip error:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Download failed', details: err.message });
            }
          }
        });
      });

      zip.on('error', (err) => {
        console.error('Zip process error:', err);
        return res
          .status(500)
          .json({ error: 'Failed to create zip package', details: err.message });
      });

      return;
    }

    // Default: send raw binary download
    res.download(baseBinaryPath, binaryFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed', details: err.message });
        }
      }
    });
  } catch (error: any) {
    console.error('Download route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /downloads/:agentTypeId/install.sh
router.get('/:agentTypeId/install.sh', async (req, res) => {
  try {
    const { agentTypeId } = req.params;

    // Get agent type from DB
    const agentType = await agentTypesService.getById(agentTypeId);

    if (!agentType) {
      return res.status(404).json({ error: 'Agent type not found' });
    }

    // Return install script
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="${agentType.name}-install.sh"`);
    res.send(agentType.installScript);
  } catch (error: any) {
    console.error('Install script error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
