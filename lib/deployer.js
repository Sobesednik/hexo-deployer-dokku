const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const hexoFs = require('hexo-fs');

function copyFile(from, to) {
    return hexoFs.copyFile(from, to)
        .then(() => to);
}

function ensurePath(fullPath) {
    return hexoFs.ensurePath(fullPath)
        .then(() => fullPath);
}

function init(baseDir, dirName) {
    const fullPath = path.join(baseDir, dirName);
    return ensurePath(fullPath)
        .then((destPath) => {
            const dockerfile = 'Dockerfile';
            const nginx = 'nginx.vh.default.conf';

            const dockerfileFrom = path.join(__dirname, '..', 'etc', dockerfile);
            const dockerfileTo = path.join(destPath, dockerfile);
            const nginxFrom = path.join(__dirname, '..', 'etc', nginx);
            const nginxTo = path.join(destPath, nginx);

            return Promise.all([
                copyFile(dockerfileFrom, dockerfileTo),
                copyFile(nginxFrom, nginxTo),
            ])
                .then(() => destPath);
        });
}

function git(args, dir) {
	return new Promise((resolve, reject) => {
        const git = cp.spawn('git', args, { cwd: dir });
        git.on('close', (code) => {
            if (code !== 0) {
                return reject(`git exited with code ${code}`);
            }
            return resolve(dir);
        });
        git.stdout.on('data', data => console.log(data.toString().trim()));
        git.stderr.on('data', data => console.log(data.toString().trim()));
    });
}

function printError() {
    const text = `
You have to configure the deployment settings in _config.yml first!

Example:
  deploy:
    type: dokku
    repo: <dokku@docker.me:hexo>

For more help, you can check the docs: http://hexo.io/docs/deployment.html
`.trim();
    console.log(text);
}

function copyFolder(from, to) {
    return hexoFs.copyDir(from, to)
        .then(() => to);
}

function deployer(args) {
    const baseDir = this.base_dir;
    const publicDir = this.public_dir;

    const repo = args.repo || args.repository || process.env.HEXO_DEPLOYER_REPO;

    if (!repo) {
        printError();
        return;
    }

    return init(baseDir, 'deploy_dokku')
        .then(destPath => git(['init', '-q'], destPath))
        .then(destPath => copyFolder(publicDir, destPath))
        .then(destPath => git(['add', '-A'], destPath))
        .then(destPath => git(['commit', '-m', `update ${new Date()}`], destPath))
        .then(destPath => git(['push', '--set-upstream', repo, 'master', '--force'], destPath))
        .catch(console.error);
}

module.exports = deployer;

