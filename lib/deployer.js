const Git = require('./git').Git;
const path = require('path');
const hexoFs = require('hexo-fs');

function copyFile(from, to) {
    return hexoFs.copyFile(from, to)
        .then(() => to);
}

function ensurePath(fullPath) {
    return hexoFs.ensurePath(fullPath)
        .then(() => fullPath);
}

function mkdir(dir, log) {
    if (typeof log === 'function') {
        log({
            mkdir: {
                data: dir,
                status: 'begin',
            },
        });
    }
    return hexoFs.mkdirs(dir)
        .then(() => dir)
        .then(data => Promise.all([
            data,
            log({
                mkdir: {
                    data,
                    status: 'end',
                }
            }),
        ]))
        .then(res => res[0]);
}

function log(data) {
    console.log(data);
}

// Create a directory in base_dir and copy Dockerfile and
// nginx.vh.default.conf in it (from etc directory in project root.
// @param {string} dokkuBase - the base directory for dokku, i.e., `hexo-blog/.dokku-deploy`
// @return {Promise} A promise resolved with full folder path.
function init(dokkuBase) {
    return mkdir(dokkuBase, log)
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

const REPO_EXPECTED_ERROR = `
You have to configure the deployment settings in _config.yml first!

Example:
  deploy:
    type: dokku
    repo: <dokku@docker.me:hexo>

For more help, you can check the docs: http://hexo.io/docs/deployment.html
`.trim();

// print error due to incomplete configuration
function printConfigError(errorText, logFn) {
    logFn(errorText);
}

function copyFolder(from, to) {
    return hexoFs.copyDir(from, to)
        .then(() => to);
}

const LOCAL_DOKKU_DEPLOY_DIR_NAME = '.deploy_dokku';

function getDokkuBase(base_dir, dokkuBase) {
    return path.join(base_dir, dokkuBase);
}

function deployer(args) {
    const baseDir = this.base_dir;
    const publicDir = this.public_dir;
    const log = this.log;

    return Promise.resolve()
        .then(() => {
            if (!baseDir) {
                throw new Error('base_dir is not found in context');
            }

            if (!publicDir) {
                throw new Error('public_dir is not found in context');
            }

            if (typeof log !== 'object') {
                throw new Error('log object is not found in context');
            }

            if (typeof args !== 'object') {
                throw new Error('args object is not given');
            }

            const logError = ('error' in log && typeof log.error === 'function') ? log.error : console.log;
            const logInfo = ('info' in log && typeof log.info === 'function') ? log.info : console.log;

            const repo = args.repo || args.repository || process.env.HEXO_DEPLOYER_REPO;
            if (!repo) {
                printConfigError(REPO_EXPECTED_ERROR, logError);
                return;
            }

            const dokkuBase = getDokkuBase(baseDir, LOCAL_DOKKU_DEPLOY_DIR_NAME);
            return deploy(dokkuBase, publicDir, repo, logInfo, logError);
        });
}

function deploy(dokkuBase, publicDir, repo, logInfo, logError) {
    const dokkuGit = new Git(dokkuBase);
    const git = dokkuGit.run.bind(dokkuGit);
    const logGit = logGitRes.bind(null, logInfo, logError);

    return init(dokkuBase)
        .then(() => git(['init']))
        .then(logGit)
        .then(() => git(['remote', 'add', 'dokku', repo]))
        .then(logGit)
        .then(() => copyFolder(publicDir, dokkuBase))
        .then(data => logInfo('copied folder', data))
        .then(() => git(['add', '-A']))
        .then(logGit)
        .then(() => git(['commit', '-m', `Update on ${new Date()}`]))
        .then(logGit)
        .then(() => git(['push', 'dokku', 'master', '--force']))
        .then(logGit)
        .catch(logError);
}

function logGitRes(logInfo, logError, res) {
    if (typeof logInfo === 'function' && res.stdout) {
        logInfo(res.stdout);
    }
    if (typeof logError === 'function' && res.stderr) {
        logError(res.stderr);
    }
    return res;
}

deployer.REPO_EXPECTED_ERROR = REPO_EXPECTED_ERROR;
deployer.LOCAL_DOKKU_DEPLOY_DIR_NAME = LOCAL_DOKKU_DEPLOY_DIR_NAME;

module.exports = deployer;

