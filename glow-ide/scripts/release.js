require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const REPO_OWNER = "Gmast2662";  // ← Change this to your GitHub username
const REPO_NAME = "Glow-Coding-Program";   // ← Change this to your repo name

function run(cmd, cwd = process.cwd()) {
    console.log(`\n➤ ${cmd}`);
    try {
        execSync(cmd, { cwd, stdio: 'inherit' });
    } catch (e) {
        console.error(`✗ Command failed: ${cmd}`);
        process.exit(1);
    }
}

function getVersion() {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version;
}

function updateConfigVersion(version) {
    const configPath = path.join(__dirname, '..', 'glow-config.js');
    let config = fs.readFileSync(configPath, 'utf8');
    config = config.replace(/version:\s*["'][\d.]+["']/, `version: "${version}"`);
    fs.writeFileSync(configPath, config, 'utf8');
    console.log(`✓ Updated glow-config.js to v${version}`);
}

async function createGitHubRelease(version) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.error('✗ GITHUB_TOKEN not found!');
        console.error('  Create a .env file in glow-ide/ with:');
        console.error('    GITHUB_TOKEN=ghp_yourTokenHere');
        console.error('  Or set it manually:');
        console.error('    $env:GITHUB_TOKEN = "ghp_yourTokenHere"');
        process.exit(1);
    }

    console.log(`\n➤ Creating GitHub release v${version}...`);

    // Import fetch dynamically
    const fetch = (await import('node-fetch')).default;

    // Create release
    const releaseRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Glow-Release-Script'
        },
        body: JSON.stringify({
            tag_name: `v${version}`,
            name: `Glow v${version}`,
            body: `Release ${version}`,
            draft: false,
            prerelease: false
        })
    });

    if (!releaseRes.ok) {
        const error = await releaseRes.text();
        console.error('✗ Failed to create release:', error);
        process.exit(1);
    }

    const release = await releaseRes.json();
    console.log(`✓ Created release: ${release.html_url}`);

    // Upload installer
    const installerName = `Glow Setup ${version}.exe`;
    const installerPath = path.join(__dirname, '..', 'dist-installer', installerName);

    if (!fs.existsSync(installerPath)) {
        console.error(`✗ Installer not found: ${installerPath}`);
        console.error('  Run npm run build first!');
        process.exit(1);
    }

    console.log(`\n➤ Uploading ${installerName}...`);
    const installerData = fs.readFileSync(installerPath);
    console.log(`✓ Read installer file (${(installerData.length / 1024 / 1024).toFixed(2)} MB)`);

    console.log(`Release upload_url: ${release.upload_url}`);
    const uploadUrl = release.upload_url.split('{')[0] + `?name=Glow-${version}.exe`;
    console.log(`Final upload URL: ${uploadUrl}`);

    // Use Node's https for large file uploads
    const https = require('https');
    const urlParse = require('url');

    return new Promise((resolve, reject) => {
        const uploadOptions = urlParse.parse(uploadUrl);
        uploadOptions.method = 'POST';
        uploadOptions.headers = {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': installerData.length,
            'User-Agent': 'Glow-Release-Script'
        };
        uploadOptions.timeout = 60000;

        const uploadReq = https.request(uploadOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Upload response status: ${res.statusCode}`);
                if (res.statusCode >= 400) {
                    console.error('✗ Failed to upload installer:', body);
                    reject(new Error(`Upload failed: ${res.statusCode}`));
                } else {
                    console.log(`✓ Uploaded installer!`);
                    resolve(release.html_url);
                }
            });
        });

        uploadReq.on('error', (err) => {
            console.error('✗ Upload request error:', err.message);
            reject(err);
        });

        uploadReq.write(installerData);
        uploadReq.end();
    });
}

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Glow Auto-Release Script             ║');
    console.log('╚════════════════════════════════════════╝\n');

    const version = getVersion();
    console.log(`📦 Version: ${version}\n`);

    // Step 1: Update glow-config.js
    updateConfigVersion(version);

    // Step 2: Build the language (if needed)
    const langPath = path.join(__dirname, '..', '..', 'glow-language-new');
    if (fs.existsSync(path.join(langPath, 'src'))) {
        console.log('\n➤ Building glow-language-new...');
        run('npm run build', langPath);
    }

    // Step 3: Build the installer
    console.log('\n➤ Building Windows installer...');
    run('npm run build', path.join(__dirname, '..'));

    // Step 4: Git commit and push
    console.log('\n➤ Committing to git...');
    const rootPath = path.join(__dirname, '..', '..');
    run('git add .', rootPath);
    run(`git commit -m "Release v${version}"`, rootPath);
    run('git push', rootPath);

    // Step 5: Create GitHub release
    const releaseUrl = await createGitHubRelease(version);

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ✓ Release Complete!                  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`\n🎉 Version ${version} is live!`);
    console.log(`🔗 ${releaseUrl}\n`);
    console.log('Users will receive update notifications within 5 minutes.\n');
}

main().catch(err => {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
});